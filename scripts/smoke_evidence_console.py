#!/usr/bin/env python3
"""근거 페이지(`/evidence`) 콘솔 에러 0 · 근거선택 흐름 자동 검증.

- `VITE_USE_SEED_DIRECTLY=true`(+VWorld 키 미설정)로 vite dev 서버를 띄우고
  Playwright(chromium)로 /evidence → /report 근거선택 시나리오를 수행한다.
- PASS 조건: console error 0건, pageerror 0건, `/api` 요청 0건, 시나리오 전 스텝 성공.
"""
from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SEED_DIR = ROOT / 'apps' / 'web' / 'public' / 'seed'
PORT = 5184
BASE = f'http://127.0.0.1:{PORT}'
EVIDENCE_TITLE = '위성영상·침수흔적·피해복구 근거 | 재난안전 AI 대응지원'
REPORT_TITLE = '상황보고서 초안 작성 | 재난안전 AI 대응지원'
SELECTION_NOTE_PATTERN = re.compile(r'선정편차 [+\-]?\d+(\.\d+)?일 · .+')


def load_expectations() -> dict[str, object]:
    sets = json.loads((SEED_DIR / 'satellite_evidence_sets_seed.json').read_text(encoding='utf-8'))['sets']
    if not sets:
        raise RuntimeError('satellite_evidence_sets_seed.json에 증거세트가 없습니다')
    first = sets[0]
    situations = json.loads((SEED_DIR / 'current_situations_seed.json').read_text(encoding='utf-8'))['situations']
    return {
        'evidence_set_id': first['evidence_set_id'],
        'is_target_region': bool(first['area']['is_target_region']),
        'official_data': bool(first['official_data']),
        'first_situation_id': situations[0]['situation_id'],
    }


def port_free() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(('127.0.0.1', PORT)) != 0


def start_dev_server(log_path: Path) -> subprocess.Popen[bytes]:
    env = dict(os.environ)
    env['VITE_USE_SEED_DIRECTLY'] = 'true'
    env['VITE_VWORLD_MAP_KEY'] = ''  # seed-only 강하: .env에 키가 있어도 무시
    command = f'npm --workspace @une-disaster/web run dev -- --host 127.0.0.1 --port {PORT} --strictPort'
    log = open(log_path, 'wb')
    return subprocess.Popen(command, cwd=str(ROOT), env=env, shell=True, stdout=log, stderr=subprocess.STDOUT)


def wait_ready(proc: subprocess.Popen[bytes], timeout_sec: int = 90) -> None:
    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f'vite dev 서버가 조기 종료되었습니다 (exit {proc.returncode})')
        try:
            with urllib.request.urlopen(f'{BASE}/', timeout=2) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(0.5)
    raise RuntimeError(f'vite dev 서버 준비 대기 초과 ({timeout_sec}s)')


def stop_dev_server(proc: subprocess.Popen[bytes]) -> None:
    if proc.poll() is not None:
        return
    if os.name == 'nt':
        subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], capture_output=True)
    else:
        proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()


class StepRecorder:
    def __init__(self) -> None:
        self.results: list[tuple[str, bool, str]] = []

    def run(self, name: str, fn) -> bool:
        try:
            fn()
        except Exception as error:  # 스텝 실패를 은폐하지 않고 기록 후 계속 진행
            self.results.append((name, False, f'{type(error).__name__}: {error}'))
            return False
        self.results.append((name, True, ''))
        return True

    @property
    def failed(self) -> list[tuple[str, bool, str]]:
        return [row for row in self.results if not row[1]]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # type: ignore[union-attr]
    except Exception:
        pass
    expect = load_expectations()
    evidence_set_id = str(expect['evidence_set_id'])
    first_situation_id = str(expect['first_situation_id'])

    if not port_free():
        print(f'FAIL: 포트 {PORT} 이미 사용 중입니다. 기존 dev 서버를 종료 후 재실행하세요.')
        return 1

    log_path = Path(tempfile.gettempdir()) / f'smoke_evidence_console_vite_{PORT}.log'
    proc = start_dev_server(log_path)
    console_errors: list[str] = []
    page_errors: list[str] = []
    api_requests: list[str] = []
    external_requests: list[str] = []
    steps = StepRecorder()
    selected_event_name: dict[str, str] = {}
    try:
        wait_ready(proc)
        with sync_playwright() as p:
            launch_kwargs = {'headless': True, 'args': ['--no-sandbox']}
            if Path('/usr/bin/chromium').exists():
                launch_kwargs['executable_path'] = '/usr/bin/chromium'
            browser = p.chromium.launch(**launch_kwargs)
            page = browser.new_page(viewport={'width': 1600, 'height': 1000})
            page.set_default_timeout(20000)
            page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
            page.on('pageerror', lambda error: page_errors.append(str(error)))

            def on_request(request) -> None:
                parsed = urlparse(request.url)
                if parsed.netloc == f'127.0.0.1:{PORT}':
                    if parsed.path == '/api' or parsed.path.startswith('/api/'):
                        api_requests.append(request.url)
                else:
                    external_requests.append(request.url)

            page.on('request', on_request)

            def step_enter() -> None:
                page.goto(f'{BASE}/evidence', wait_until='load')
                page.wait_for_function('title => document.title === title', arg=EVIDENCE_TITLE)
                page.wait_for_selector('.evidence-page')
                page.wait_for_function('document.querySelectorAll(".context-select select option").length > 0')
                heading = page.locator('h1').inner_text()
                if heading != '위성영상·침수흔적·피해복구 근거':
                    raise AssertionError(f'h1 불일치: {heading}')

            steps.run('S1 /evidence 직접 진입·document.title 갱신', step_enter)

            def step_tiles() -> None:
                page.wait_for_function('document.querySelectorAll(".phase-tile-pair img").length === 6')
                page.wait_for_function(
                    'Array.from(document.querySelectorAll(".phase-tile-pair img")).every(img => img.complete && img.naturalWidth > 0)'
                )
                sizes = page.evaluate(
                    'Array.from(document.querySelectorAll(".phase-tile-pair img")).map(img => `${img.getAttribute("width")}x${img.getAttribute("height")}`)'
                )
                if sizes != ['256x256'] * 6:
                    raise AssertionError(f'256×256 속성 불일치: {sizes}')
                broken = page.evaluate(
                    'Array.from(document.querySelectorAll(".phase-tile-pair img")).filter(img => img.src.includes("placeholder")).map(img => img.src)'
                )
                if broken:
                    raise AssertionError(f'Placeholder로 대체된 타일 존재: {broken}')

            steps.run('S2 위성영상·수계마스크 256×256 타일 6개 로드(naturalWidth>0)', step_tiles)

            def step_selection_notes() -> None:
                page.wait_for_function('document.querySelectorAll(".phase-selection-note").length === 3')
                notes = page.locator('.phase-selection-note').all_inner_texts()
                for note in notes:
                    if not SELECTION_NOTE_PATTERN.search(note):
                        raise AssertionError(f'선정편차·사유 형식 불일치: {note}')
                    if '가장 가까운 유효 후보' not in note and 'EVENT 유효구간' not in note:
                        raise AssertionError(f'selection_reason 문구 불일치: {note}')

            steps.run('S3 phase-selection-note 3건 · 선정편차·selection_reason 표시', step_selection_notes)

            def step_mock_badges() -> None:
                badge = page.locator('section[aria-labelledby="satellite-title"] .seed-badge').inner_text()
                if '대상지역 외' not in badge or '공식자료 아님' not in badge:
                    raise AssertionError(f'위성 섹션 mock 배지 불일치: {badge}')
                alert = page.locator('.evidence-set-alert strong').inner_text()
                if '대상지역 외' not in alert:
                    raise AssertionError(f'증거세트 대상지역 안내 불일치: {alert}')
                if not page.locator('.seed-badge', has_text='실제 NDMS 자료 아님').count():
                    raise AssertionError('피해·복구 섹션 "실제 NDMS 자료 아님" 배지 없음')
                safety = page.locator('section[aria-labelledby="satellite-title"] .safety-note').inner_text()
                if '부산·인제·영천 자료가 아니며' not in safety:
                    raise AssertionError(f'safety-note 문구 불일치: {safety}')

            steps.run('S4 mock 배지(대상지역 외·공식자료 아님·실제 NDMS 자료 아님) 표시', step_mock_badges)

            def step_select_satellite_set() -> None:
                button = page.locator('section[aria-labelledby="satellite-title"] button', has_text='6개 타일 근거를 보고서에 반영')
                page.wait_for_function(
                    'Array.from(document.querySelectorAll("button")).some(b => b.textContent.includes("6개 타일 근거를 보고서에 반영") && !b.disabled)'
                )
                button.click()
                page.wait_for_selector('section[aria-labelledby="satellite-title"] .selection-status:has-text("현재 보고서 근거로 선택됨")')
                page.wait_for_selector('.page-status:has-text("보고서 근거에 반영했습니다")')

            steps.run('S5 위성 증거세트 6개 타일 "보고서에 반영" → 선택 상태 표시', step_select_satellite_set)

            def step_toggle_flood_trace() -> None:
                section = page.locator('.evidence-map-section')
                toggle = section.locator('.evidence-action-row button')
                toggle.click()  # on
                page.wait_for_selector('.evidence-map-section .selection-status:has-text("보고서 근거로 선택됨")')
                if toggle.get_attribute('aria-pressed') != 'true':
                    raise AssertionError('침수흔적도 토글 on 후 aria-pressed=true 아님')
                if '침수흔적도 근거 제외' not in toggle.inner_text():
                    raise AssertionError(f'침수흔적도 토글 on 라벨 불일치: {toggle.inner_text()}')
                toggle.click()  # off
                page.wait_for_function(
                    'document.querySelector(".evidence-map-section .evidence-action-row button")?.getAttribute("aria-pressed") === "false"'
                )
                if section.locator('.selection-status').count():
                    raise AssertionError('침수흔적도 토글 off 후에도 선택 상태 표시가 남아있음')
                toggle.click()  # on (보고서 검증용으로 유지)
                page.wait_for_selector('.evidence-map-section .selection-status:has-text("보고서 근거로 선택됨")')

            steps.run('S6 침수흔적도 근거 토글 on→off→on · aria-pressed·상태 표시', step_toggle_flood_trace)

            def step_toggle_similar_event() -> None:
                cards = page.locator('.damage-event-card')
                if cards.count() < 1:
                    raise AssertionError('피해·대응·복구 사례 카드가 없습니다')
                card = cards.first
                selected_event_name['value'] = card.locator('header strong').inner_text()
                toggle = card.locator('footer button')
                if '보고서 참고사례로 반영' not in toggle.inner_text():
                    raise AssertionError(f'유사사례 토글 초기 라벨 불일치: {toggle.inner_text()}')
                toggle.click()  # on
                page.wait_for_function(
                    'document.querySelector(".damage-event-card footer button")?.getAttribute("aria-pressed") === "true"'
                )
                if '보고서 근거에서 제외' not in toggle.inner_text():
                    raise AssertionError(f'유사사례 토글 on 라벨 불일치: {toggle.inner_text()}')
                page.wait_for_selector('.page-status:has-text("과거 피해·대응·복구 사례 선택을 보고서에 반영했습니다")')

            steps.run('S7 유사사례(피해·대응·복구) 카드 "보고서 참고사례로 반영" 토글', step_toggle_similar_event)

            def step_navigate_report() -> None:
                page.locator('.global-nav a[href="/report"]').click()
                page.wait_for_function('title => document.title === title', arg=REPORT_TITLE)
                if urlparse(page.url).path != '/report':
                    raise AssertionError(f'/report 경로가 아님: {page.url}')
                page.wait_for_selector('.report-selected-evidence')
                items = page.locator('.report-selected-evidence ul li').all_inner_texts()
                text = '\n'.join(items)
                if f'증거세트 {evidence_set_id} 선택됨' not in text:
                    raise AssertionError(f'증거세트 반영 표시 없음: {text}')
                if '침수흔적도: 포함' not in text:
                    raise AssertionError(f'침수흔적도 포함 표시 없음: {text}')
                if '과거 피해·복구 사례: 1건' not in text:
                    raise AssertionError(f'과거 사례 1건 표시 없음: {text}')
                if not page.locator('.report-selected-evidence .safety-note', has_text='시범 대상지역 자료가 아닙니다').count():
                    raise AssertionError('대상지역 외 증거세트 safety-note 없음')
                preview = page.locator('.report-preview .report-preview-doc').inner_text()
                for fragment in (f'PRE·EVENT·POST 증거세트 {evidence_set_id}', '6개 타일', '침수흔적도 Seed 근거 포함 (공식 침수범위 아님)'):
                    if fragment not in preview:
                        raise AssertionError(f'초안 미리보기에 "{fragment}" 없음')
                event_name = selected_event_name.get('value')
                if event_name and event_name not in preview:
                    raise AssertionError(f'초안 미리보기에 선택 사례 "{event_name}" 없음')

            steps.run('S8 내비게이션으로 /report 이동 · 선택 근거(증거세트·침수흔적·사례) 반영 확인', step_navigate_report)

            def step_reload_persistence() -> None:
                stored = page.evaluate('key => localStorage.getItem(key)', f'une-disaster-report-evidence:{first_situation_id}')
                if not stored:
                    raise AssertionError(f'localStorage에 une-disaster-report-evidence:{first_situation_id} 없음')
                page.reload(wait_until='load')
                page.wait_for_function('title => document.title === title', arg=REPORT_TITLE)
                page.wait_for_selector('.report-selected-evidence')
                page.wait_for_function(
                    "id => { const el = document.querySelector('.report-selected-evidence ul'); return !!el && el.textContent.includes(`증거세트 ${id} 선택됨`) && el.textContent.includes('침수흔적도: 포함') && el.textContent.includes('과거 피해·복구 사례: 1건'); }",
                    arg=evidence_set_id,
                )

            steps.run('S9 reload 후 localStorage 복원으로 선택 근거 유지', step_reload_persistence)

            page.wait_for_timeout(1000)  # 잔여 비동기 콘솔 메시지 수집 여유
            browser.close()
    except Exception as error:
        print(f'FAIL: 시나리오 실행 중단 - {type(error).__name__}: {error}')
        if log_path.exists():
            tail = log_path.read_text(encoding='utf-8', errors='replace').splitlines()[-25:]
            print('--- vite dev log tail ---')
            for line in tail:
                print(line)
        stop_dev_server(proc)
        return 1
    finally:
        stop_dev_server(proc)

    print('=== 근거 페이지 콘솔 스모크 시나리오 결과 ===')
    for name, ok, detail in steps.results:
        print(f'[{"PASS" if ok else "FAIL"}] {name}{" - " + detail if detail else ""}')
    print(f'console errors: {len(console_errors)}, page errors: {len(page_errors)}, /api requests: {len(api_requests)}')
    print(f'외부 도메인 요청: {len(external_requests)}건 (VWorld 키 미설정 seed-only 기대값 0)')

    failed = bool(steps.failed) or console_errors or page_errors or api_requests
    if console_errors:
        print('--- console errors ---')
        for item in console_errors:
            print(f'  {item}')
    if page_errors:
        print('--- page errors ---')
        for item in page_errors:
            print(f'  {item}')
    if api_requests:
        print('--- /api requests (0건이어야 함) ---')
        for item in api_requests:
            print(f'  {item}')
    if external_requests:
        print('--- external requests ---')
        for item in external_requests:
            print(f'  {item}')
    if failed:
        print('FAIL: smoke_evidence_console')
        return 1
    print('PASS: smoke_evidence_console (console errors 0 · page errors 0 · /api requests 0)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
