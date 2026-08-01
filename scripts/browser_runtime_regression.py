#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PREVIEW=ROOT/'preview'/'runtime-regression'
RESULT=PREVIEW/'runtime_regression_result.json'


def main() -> None:
    data=json.loads(RESULT.read_text(encoding='utf-8'))
    html=(PREVIEW/'index.html').read_text(encoding='utf-8')
    html=html.replace("fetch('./runtime_regression_result.json').then(r=>r.json())",f"Promise.resolve({json.dumps(data,ensure_ascii=False)})")
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':1000})
        page.set_content(html,wait_until='load')
        page.wait_for_selector('[data-situation]')
        assert page.locator('[data-situation]').count()==data['counts']['situations']
        for block in data['rankings']:
            section=page.locator(f'[data-situation="{block["situation_id"]}"]')
            assert section.locator('tbody tr').count()==15
            assert block['expected_top_event_id'] in section.locator('tbody tr').first.inner_text()
        page.get_by_role('button',name='CQ 5문').click()
        assert page.locator('#cq tbody tr').count()==5
        page.get_by_role('button',name='보고서 연계').click()
        assert page.locator('#report tbody tr').count()==data['counts']['situations']
        page.get_by_role('button',name='종합 결과').click()
        assert page.locator('#checks .pass').count()==5
        page.screenshot(path=str(PREVIEW/'runtime_regression_dashboard.png'),full_page=True)
        browser.close()
    print('PASS browser runtime regression dashboard')

if __name__=='__main__':
    main()
