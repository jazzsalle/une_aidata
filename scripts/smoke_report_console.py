#!/usr/bin/env python3
"""보고서 페이지(`/report`) 콘솔 에러 0 · 선택근거·초안검증 흐름 자동 검증.

- `VITE_USE_SEED_DIRECTLY=true`(+VWorld 키 미설정)로 vite dev 서버를 띄우고
  Playwright(chromium)로 /evidence 근거선택 → /report 유사도·대응비교·Passage·
  초안검증·저장·복원 시나리오를 수행한다.
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
PORT = 5185
BASE = f'http://127.0.0.1:{PORT}'
EVIDENCE_TITLE = '위성영상·침수흔적·피해복구 근거 | 재난안전 AI 대응지원'
REPORT_TITLE = '상황보고서 초안 작성 | 재난안전 AI 대응지원'
SEED_REFERENCE_BADGE = 'Seed 참고사례 · T3Q 실데이터 아님'
SIMILARITY_SUMMARY_PATTERN = re.compile(r'사건 유사도 \d+(\.\d+)?점 · 비교범위 \d+(\.\d+)?% · 신뢰 \S+ · 데이터상태 \S+')

INPUT_TEXTS = {
    'overview': '요천 수위 상승에 따른 호우 상황 개요 (스모크 입력)',
    'conditions': '3시간 강우 95mm · 요천 수위 상승 경향 (스모크 입력)',
    'actions': '저지대 도로 사전통제·취약가구 안내 완료 (스모크 입력)',
    'damage': '현장 확인 결과 현재까지 피해 신고 없음 (스모크 입력)',
}
INPUT_WARNINGS = {
    'overview': '상황 개요가 미입력',
    'conditions': '현재 조건이 미입력',
    'actions': '담당자 조치결과가 미입력',
    'damage': '피해현황이 미확인으로 남아',
}
TEXTAREA_SELECTORS = {
    'overview': '#report-overview textarea',
    'conditions': '#report-conditions textarea',
    'actions': '#report-actions textarea',
    'damage': '#report-damage textarea',
}


def load_expectations() -> dict[str, object]:
    sets = json.loads((SEED_DIR / 'satellite_evidence_sets_seed.json').read_text(encoding='utf-8'))['sets']
    if not sets:
        raise RuntimeError('satellite_evidence_sets_seed.json에 증거세트가 없습니다')
    first_set = sets[0]
    situations = json.loads((SEED_DIR / 'current_situations_seed.json').read_text(encoding='utf-8'))['situations']
    situation = situations[0]
    records = json.loads((SEED_DIR / 'damage_recovery_events_seed.json').read_text(encoding='utf-8'))['records']
    matched = [row for row in records if row.get('admin_code') == situation['admin_code']]
    if not matched:
        raise RuntimeError(f'damage_recovery_events_seed.json에 admin_code {situation["admin_code"]} 사례가 없습니다')
    first_record = matched[0]
    evidence = first_record.get('evidence') or []
    if not evidence:
        raise RuntimeError(f'첫 사례 {first_record.get("event_id")}에 evidence가 없습니다')
    first_evidence = evidence[0]
    required_checks = (situation.get('user_input') or {}).get('required_checks') or []
    return {
        'evidence_set_id': first_set['evidence_set_id'],
        'is_target_region': bool(first_set['area']['is_target_region']),
        'situation_id': situation['situation_id'],
        'event_name': first_record['event_name'],
        'passage_id': first_evidence.get('passage_id') or first_evidence.get('evidence_id'),
        'comparison_rows': max(len(required_checks), 1),
        'first_required_check': required_checks[0] if required_checks else '현재 확인사항 미입력',
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
    is_target_region = bool(expect['is_target_region'])
    situation_id = str(expect['situation_id'])
    event_name = str(expect['event_name'])
    passage_id = str(expect['passage_id'])
    comparison_rows = int(expect['comparison_rows'])  # type: ignore[arg-type]
    first_required_check = str(expect['first_required_check'])

    if not port_free():
        print(f'FAIL: 포트 {PORT} 이미 사용 중입니다. 기존 dev 서버를 종료 후 재실행하세요.')
        return 1

    log_path = Path(tempfile.gettempdir()) / f'smoke_report_console_vite_{PORT}.log'
    proc = start_dev_server(log_path)
    console_errors: list[str] = []
    page_errors: list[str] = []
    api_requests: list[str] = []
    external_requests: list[str] = []
    downloads: list[str] = []
    steps = StepRecorder()
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
            page.on('download', lambda download: downloads.append(download.suggested_filename))

            def on_request(request) -> None:
                parsed = urlparse(request.url)
                if parsed.netloc == f'127.0.0.1:{PORT}':
                    if parsed.path == '/api' or parsed.path.startswith('/api/'):
                        api_requests.append(request.url)
                else:
                    external_requests.append(request.url)

            page.on('request', on_request)

            def validation_text() -> str:
                return page.locator('section.draft-validation').inner_text()

            def wait_warning_gone(fragment: str) -> None:
                page.wait_for_function(
                    "fragment => { const el = document.querySelector('section.draft-validation'); return !!el && !el.textContent.includes(fragment); }",
                    arg=fragment,
                )

            def step_prepare_evidence() -> None:
                page.goto(f'{BASE}/evidence', wait_until='load')
                page.wait_for_function('title => document.title === title', arg=EVIDENCE_TITLE)
                page.wait_for_selector('.evidence-page')
                # 증거세트 반영
                page.wait_for_function(
                    'Array.from(document.querySelectorAll("button")).some(b => b.textContent.includes("6개 타일·상대변화 근거를 보고서에 반영") && !b.disabled)'
                )
                page.locator('section[aria-labelledby="satellite-title"] button', has_text='6개 타일·상대변화 근거를 보고서에 반영').click()
                page.wait_for_selector('section[aria-labelledby="satellite-title"] .selection-status:has-text("현재 보고서 근거로 선택됨")')
                # 침수흔적도 포함 유지
                toggle = page.locator('.evidence-map-section .evidence-action-row button')
                toggle.click()
                page.wait_for_selector('.evidence-map-section .selection-status:has-text("보고서 근거로 선택됨")')
                if toggle.get_attribute('aria-pressed') != 'true':
                    raise AssertionError('침수흔적도 토글 on 후 aria-pressed=true 아님')
                # 유사사례 카드 1건 선택 (첫 카드)
                cards = page.locator('.damage-event-card')
                if cards.count() < 1:
                    raise AssertionError('피해·대응·복구 사례 카드가 없습니다')
                card = cards.first
                card_name = card.locator('header strong').inner_text()
                if card_name != event_name:
                    raise AssertionError(f'첫 사례 카드 이름 불일치: {card_name} (기대 {event_name})')
                card.locator('footer button').click()
                page.wait_for_function(
                    'document.querySelector(".damage-event-card footer button")?.getAttribute("aria-pressed") === "true"'
                )

            steps.run('S1 /evidence 증거세트 반영·침수흔적 포함·유사사례 1건 선택', step_prepare_evidence)

            def step_navigate_report() -> None:
                page.locator('.global-nav a[href="/report"]').click()
                page.wait_for_function('title => document.title === title', arg=REPORT_TITLE)
                if urlparse(page.url).path != '/report':
                    raise AssertionError(f'/report 경로가 아님: {page.url}')
                page.wait_for_selector('.report-selected-evidence')
                items = '\n'.join(page.locator('.report-selected-evidence ul li').all_inner_texts())
                for fragment in (f'증거세트 {evidence_set_id} 선택됨', '침수흔적도: 포함', '과거 피해·복구 사례: 1건'):
                    if fragment not in items:
                        raise AssertionError(f'선택 근거 요약에 "{fragment}" 없음: {items}')
                # Seed 초안 로드 완료 대기 (상황 개요 prefill)
                page.wait_for_function(
                    "sel => { const el = document.querySelector(sel); return !!el && el.value.trim().length > 0; }",
                    arg=TEXTAREA_SELECTORS['overview'],
                )

            steps.run('S2 /report 이동 · 선택 근거(증거세트·침수흔적·사례 1건) 반영 확인', step_navigate_report)

            def step_similarity_summary() -> None:
                page.wait_for_selector('.report-event-detail')
                heading = page.locator('.report-event-detail h4').first.inner_text()
                if event_name not in heading:
                    raise AssertionError(f'선택 사례명 "{event_name}" 미표시: {heading}')
                meta = page.locator('.report-event-detail .event-meta').first.inner_text()
                if not SIMILARITY_SUMMARY_PATTERN.search(meta):
                    raise AssertionError(f'유사도 요약 형식 불일치: {meta}')
                badge = page.locator('.report-event-detail .seed-badge')
                if badge.count() < 1:
                    raise AssertionError('Seed 참고사례 배지가 없습니다')
                badge_text = badge.first.inner_text()
                if SEED_REFERENCE_BADGE not in badge_text:
                    raise AssertionError(f'배지 문구 불일치: {badge_text}')

            steps.run('S3 유사도 요약 표시 + "Seed 참고사례 · T3Q 실데이터 아님" 배지', step_similarity_summary)

            def step_comparison_table() -> None:
                page.wait_for_selector('.report-event-detail .comparison-table')
                table = page.locator('.report-event-detail .comparison-table').first
                caption = table.locator('caption').inner_text()
                if '과거 참고정보 · 담당자 확인 필요' not in caption:
                    raise AssertionError(f'대응비교 표 caption 프레이밍 불일치: {caption}')
                headers = table.locator('thead th').all_inner_texts()
                if '현재 확인사항' not in headers or '과거 조치' not in headers:
                    raise AssertionError(f'대응비교 표 열 제목 불일치: {headers}')
                rows = table.locator('tbody tr')
                if rows.count() < 1:
                    raise AssertionError('대응비교 표에 행이 없습니다')
                if rows.count() != comparison_rows:
                    raise AssertionError(f'대응비교 행수 불일치: {rows.count()} (기대 {comparison_rows})')
                first_check = rows.first.locator('th[scope="row"]').inner_text()
                if first_check != first_required_check:
                    raise AssertionError(f'첫 행 현재 확인사항 불일치: {first_check} (기대 {first_required_check})')
                note = page.locator('.report-selected-evidence .safety-note', has_text='과거 참고정보이며 권고 조치나 자동 결정이 아닙니다')
                if note.count() < 1:
                    raise AssertionError('"과거 참고정보 · 담당자 확인 필요" 프레이밍 safety-note 없음')
                if '담당자 확인이 필요합니다' not in note.first.inner_text():
                    raise AssertionError(f'safety-note 담당자 확인 문구 없음: {note.first.inner_text()}')

            steps.run('S4 대응비교 표 ≥1행(현재 확인 vs 과거 조치) + 과거 참고정보 프레이밍', step_comparison_table)

            def step_passage_evidence() -> None:
                page.wait_for_selector('.report-event-detail .report-passage-list')
                passage_items = '\n'.join(page.locator('.report-event-detail .report-passage-list li').all_inner_texts())
                if '근거 Passage:' not in passage_items:
                    raise AssertionError(f'Passage 목록에 "근거 Passage:" 없음: {passage_items}')
                if passage_id not in passage_items:
                    raise AssertionError(f'Passage 목록에 passage_id {passage_id} 없음: {passage_items}')
                preview = page.locator('.report-preview .report-preview-doc').inner_text()
                if '근거 Passage:' not in preview:
                    raise AssertionError('markdown 미리보기에 "근거 Passage:" 부착 없음')
                if passage_id not in preview:
                    raise AssertionError(f'markdown 미리보기에 passage_id {passage_id} 없음')

            steps.run('S5 Passage 근거 목록 passage_id 표시 + 미리보기 "근거 Passage:" 부착', step_passage_evidence)

            def step_draft_validation() -> None:
                panel = page.locator('section.draft-validation')
                if panel.count() != 1:
                    raise AssertionError('section.draft-validation 패널이 1개가 아닙니다')
                if panel.get_attribute('role') != 'status':
                    raise AssertionError('draft-validation role=status 아님')
                # 초기 상태: 미입력 항목 경고 존재 (Seed 초안은 조치결과가 비어 있음)
                initial = validation_text()
                if INPUT_WARNINGS['actions'] not in initial:
                    raise AssertionError(f'초기 경고에 "{INPUT_WARNINGS["actions"]}" 없음: {initial}')
                # 4개 입력을 모두 비워 미입력 경고 4건 노출 확인
                for key in ('overview', 'conditions', 'actions', 'damage'):
                    page.locator(TEXTAREA_SELECTORS[key]).fill('')
                for key, fragment in INPUT_WARNINGS.items():
                    page.wait_for_function(
                        "fragment => { const el = document.querySelector('section.draft-validation'); return !!el && el.textContent.includes(fragment); }",
                        arg=fragment,
                    )
                # 항목별 입력 시 해당 경고 실시간 소멸
                for key in ('overview', 'conditions', 'actions', 'damage'):
                    page.locator(TEXTAREA_SELECTORS[key]).fill(INPUT_TEXTS[key])
                    wait_warning_gone(INPUT_WARNINGS[key])
                # 잔여 경고는 근거 선택 상태로 판정: 대상지역 외 증거세트면 1건, 아니면 0건
                remaining = page.locator('.draft-validation-list li').all_inner_texts()
                if is_target_region:
                    if remaining:
                        raise AssertionError(f'경고 0건 기대인데 잔여 경고 존재: {remaining}')
                    if not page.locator('.draft-validation-ok').count():
                        raise AssertionError('경고 0건인데 draft-validation-ok 미표시')
                else:
                    if len(remaining) != 1 or '대상지역 외 표본' not in remaining[0]:
                        raise AssertionError(f'대상지역 외 증거세트 잔여 경고 1건 기대 불일치: {remaining}')

            steps.run('S6 초안 검증 패널: 미입력 경고 노출 → 입력 시 실시간 소멸(잔여는 근거상태로 판정)', step_draft_validation)

            def step_save_and_download_ready() -> None:
                page.locator('.report-actions button', has_text='브라우저에 저장').click()
                page.wait_for_function(
                    "() => { const el = document.querySelector('.sr-only[aria-live=\"polite\"]'); return !!el && el.textContent.includes('보고서 초안을 이 브라우저에 저장했습니다.'); }"
                )
                stored = page.evaluate('key => localStorage.getItem(key)', f'une-disaster-report:{situation_id}')
                if not stored:
                    raise AssertionError(f'localStorage에 une-disaster-report:{situation_id} 없음')
                saved = json.loads(stored)
                if saved.get('overview') != INPUT_TEXTS['overview']:
                    raise AssertionError(f'저장된 overview 불일치: {saved.get("overview")}')
                # Markdown 다운로드는 클릭하지 않고 버튼 활성 상태만 확인 (파일 저장 부작용 최소화)
                download_button = page.locator('.report-actions button.primary', has_text='Markdown 다운로드')
                if download_button.count() != 1:
                    raise AssertionError('Markdown 다운로드 버튼이 1개가 아닙니다')
                if download_button.is_disabled():
                    raise AssertionError('Markdown 다운로드 버튼이 비활성 상태입니다')
                if downloads:
                    raise AssertionError(f'다운로드가 발생하지 않아야 하는데 발생: {downloads}')

            steps.run('S7 브라우저 저장 → 상태 메시지·localStorage 확인 + 다운로드 버튼 활성(클릭 없음)', step_save_and_download_ready)

            def step_reload_persistence() -> None:
                stored = page.evaluate('key => localStorage.getItem(key)', f'une-disaster-report-evidence:{situation_id}')
                if not stored:
                    raise AssertionError(f'localStorage에 une-disaster-report-evidence:{situation_id} 없음')
                page.reload(wait_until='load')
                page.wait_for_function('title => document.title === title', arg=REPORT_TITLE)
                page.wait_for_selector('.report-selected-evidence')
                page.wait_for_function(
                    "id => { const el = document.querySelector('.report-selected-evidence ul'); return !!el && el.textContent.includes(`증거세트 ${id} 선택됨`) && el.textContent.includes('침수흔적도: 포함') && el.textContent.includes('과거 피해·복구 사례: 1건'); }",
                    arg=evidence_set_id,
                )
                for key in ('overview', 'conditions', 'actions', 'damage'):
                    page.wait_for_function(
                        "([sel, text]) => { const el = document.querySelector(sel); return !!el && el.value === text; }",
                        arg=[TEXTAREA_SELECTORS[key], INPUT_TEXTS[key]],
                    )

            steps.run('S8 reload 후 localStorage 복원: 선택 근거 + 4개 입력값 유지', step_reload_persistence)

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

    print('=== 보고서 페이지 콘솔 스모크 시나리오 결과 ===')
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
        print('FAIL: smoke_report_console')
        return 1
    print('PASS: smoke_report_console (console errors 0 · page errors 0 · /api requests 0)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
