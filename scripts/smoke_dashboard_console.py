#!/usr/bin/env python3
"""대시보드(`/`) 콘솔 에러 0 자동 검증.

- `VITE_USE_SEED_DIRECTLY=true`(+VWorld 키 미설정)로 vite dev 서버를 띄우고
  Playwright(chromium)로 대시보드 핵심 시나리오를 수행한다.
- PASS 조건: console error 0건, pageerror 0건, `/api` 요청 0건, 시나리오 전 스텝 성공.
"""
from __future__ import annotations

import json
import os
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
PORT = 5183
BASE = f'http://127.0.0.1:{PORT}'
DASHBOARD_TITLE = '지도 기반 재난 상황판 | 재난안전 AI 대응지원'


def load_expectations() -> tuple[int, dict[str, str]]:
    situations = json.loads((SEED_DIR / 'current_situations_seed.json').read_text(encoding='utf-8'))['situations']
    priorities = json.loads((SEED_DIR / 'priority_areas_seed.json').read_text(encoding='utf-8'))['results']
    top_area_name = {row['situation_id']: row['areas'][0]['name'] for row in priorities if row.get('areas')}
    return len(situations), top_area_name


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
    situation_count, top_area_name = load_expectations()

    if not port_free():
        print(f'FAIL: 포트 {PORT} 이미 사용 중입니다. 기존 dev 서버를 종료 후 재실행하세요.')
        return 1

    log_path = Path(tempfile.gettempdir()) / f'smoke_dashboard_console_vite_{PORT}.log'
    proc = start_dev_server(log_path)
    console_errors: list[str] = []
    page_errors: list[str] = []
    api_requests: list[str] = []
    external_requests: list[str] = []
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

            def on_request(request) -> None:
                parsed = urlparse(request.url)
                if parsed.netloc == f'127.0.0.1:{PORT}':
                    if parsed.path == '/api' or parsed.path.startswith('/api/'):
                        api_requests.append(request.url)
                else:
                    external_requests.append(request.url)

            page.on('request', on_request)

            def wait_top_area(situation_id: str) -> None:
                page.wait_for_function(
                    "name => { const el = document.querySelector('.priority-card .priority-title strong'); return !!el && el.textContent === name; }",
                    arg=top_area_name[situation_id],
                )

            def step_enter() -> None:
                page.goto(f'{BASE}/', wait_until='load')
                page.wait_for_selector('.context-select select')
                page.wait_for_function(
                    'count => document.querySelectorAll(".context-select select option").length === count',
                    arg=situation_count,
                )
                page.wait_for_function('title => document.title === title', arg=DASHBOARD_TITLE)
                page.wait_for_selector('.priority-card')
                wait_top_area('SIT-NW-POC-001')

            steps.run('S1 / 진입·초기 로드·document.title 갱신', step_enter)

            def make_region_step(situation_id: str):
                def step() -> None:
                    page.locator('.context-select select').select_option(situation_id)
                    wait_top_area(situation_id)
                return step

            steps.run('S2 지역·상황 변경 → 41430 의왕(SIT-UW-POC-001)', make_region_step('SIT-UW-POC-001'))
            steps.run('S3 지역·상황 변경 → 47190 구미(SIT-GM-POC-001)', make_region_step('SIT-GM-POC-001'))
            steps.run('S4 지역·상황 변경 → 45190 남원(SIT-NW-POC-001)', make_region_step('SIT-NW-POC-001'))

            def step_apply_conditions() -> None:
                page.locator('label:has-text("3시간 강우") input').fill('95')
                page.locator('label:has-text("12시간 강우") input').fill('180')
                page.locator('label:has-text("수위") input').fill('3.2')
                page.locator('label:has-text("유량") input').fill('420')
                page.locator('label:has-text("현장징후") textarea').fill('제방 하부 누수 신고 접수')
                page.get_by_role('button', name='현재 조건 적용·재산정').click()
                page.wait_for_selector('.page-status:has-text("현재 조건을 적용하고")')
                if page.locator('#situation-panel-input .inline-error').count():
                    raise AssertionError(f'조건 적용 오류 표시: {page.locator("#situation-panel-input .inline-error").inner_text()}')

            steps.run('S5 조건 입력 후 현재 조건 적용·재산정', step_apply_conditions)

            def step_insight_tabs() -> None:
                page.get_by_role('tab', name='유사사례').click()
                page.wait_for_selector('#insight-panel-1 .event-card')
                page.get_by_role('tab', name='대응절차').click()
                page.wait_for_selector('#insight-panel-2 .procedure-card')
                page.get_by_role('tab', name='계획·근거').click()
                page.wait_for_selector('#insight-panel-3 .evidence-list')
                page.get_by_role('tab', name='현재 판단').click()
                page.wait_for_selector('#insight-panel-0 .notice-card.warning')

            steps.run('S6 InsightPanel 탭 전환(유사사례·대응절차·계획근거·현재판단)', step_insight_tabs)

            def step_map_highlight_existing() -> None:
                page.locator('.context-select select').select_option('SIT-NW-POC-001')
                wait_top_area('SIT-NW-POC-001')
                page.locator('.priority-card button', has_text='지도에서 보기').first.click()
                page.wait_for_timeout(2000)
                if page.locator('.map-highlight-notice').count():
                    raise AssertionError(f'존재하는 ID(NW-A-02)인데 미존재 안내 표시: {page.locator(".map-highlight-notice").inner_text()}')

            steps.run('S7 지도에서 보기 (45190 NW-A-02 · 존재 ID 하이라이트)', step_map_highlight_existing)

            def step_map_highlight_missing() -> None:
                page.locator('.context-select select').select_option('SIT-GM-POC-001')
                wait_top_area('SIT-GM-POC-001')
                page.locator('.priority-card button', has_text='지도에서 보기').first.click()
                notice = page.wait_for_selector('.map-highlight-notice')
                text = notice.inner_text() if notice else ''
                if 'GM-A-01' not in text:
                    raise AssertionError(f'GM-A-01 미존재 안내 문구 불일치: {text}')

            steps.run('S8 지도에서 보기 (47190 GM-A-01 · 미존재 ID 비차단 안내)', step_map_highlight_missing)

            def step_select_similar_event() -> None:
                page.get_by_role('tab', name='유사사례').click()
                cards = page.locator('#insight-panel-1 .event-card')
                count = cards.count()
                if count < 1:
                    raise AssertionError('유사사례 카드가 없습니다')
                target = cards.nth(1) if count > 1 else cards.first
                target.click()
                page.wait_for_selector('#insight-panel-1 .event-card.selected')
                page.wait_for_selector('.similar-event-detail')

            steps.run('S9 유사사례 선택·비교 상세 표시', step_select_similar_event)

            def step_t3q_mock_search() -> None:
                page.wait_for_function('document.querySelectorAll(".mock-search-controls select option").length > 0')
                page.locator('.mock-search-controls button', has_text='Mock 검색').click()
                page.wait_for_selector('.mock-search-results')
                page.wait_for_selector('.mock-search-results h3:has-text("Event Master")')
                if page.locator('.mock-search-panel .inline-error').count():
                    raise AssertionError(f'Mock 검색 오류 표시: {page.locator(".mock-search-panel .inline-error").inner_text()}')

            steps.run('S10 T3Q 구조 Mock 검색 실행·결과 표시', step_t3q_mock_search)

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

    print('=== 대시보드 콘솔 스모크 시나리오 결과 ===')
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
        print('FAIL: smoke_dashboard_console')
        return 1
    print('PASS: smoke_dashboard_console (console errors 0 · page errors 0 · /api requests 0)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
