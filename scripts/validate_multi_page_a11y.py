from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
checks = {
    'routes': ROOT / 'apps/web/src/hooks/useRoute.ts',
    'header': ROOT / 'apps/web/src/components/AppHeader.tsx',
    'page_heading': ROOT / 'apps/web/src/components/PageHeading.tsx',
    'dashboard': ROOT / 'apps/web/src/pages/DashboardPage.tsx',
    'evidence': ROOT / 'apps/web/src/pages/EvidencePage.tsx',
    'report': ROOT / 'apps/web/src/pages/ReportPage.tsx',
    'checklist': ROOT / 'tests/accessibility/multi-page-a11y-checklist.md',
}
for name, path in checks.items():
    assert path.exists(), f'missing {name}: {path}'

routes = checks['routes'].read_text(encoding='utf-8')
for path in ["path: '/'", "path: '/evidence'", "path: '/report'"]:
    assert path in routes, f'missing route {path}'

header = checks['header'].read_text(encoding='utf-8')
for token in ['skip-link', 'aria-label="주요 메뉴"', 'aria-current']:
    assert token in header, f'missing header accessibility token: {token}'

heading = checks['page_heading'].read_text(encoding='utf-8')
for token in ['document.title', 'tabIndex={-1}', '.focus()']:
    assert token in heading, f'missing route focus/title token: {token}'

satellite = (ROOT / 'apps/web/src/components/SatelliteComparison.tsx').read_text(encoding='utf-8')
# 영상만으로 정보를 전달하지 않도록 이미지 대체텍스트와 텍스트 대안이 남아 있는지 확인한다.
# 중복이던 메타데이터 표는 제거했고(타일 카드가 단계·선정기준·선정편차·촬영시각·자료성격을 모두 표기),
# 표 대신 그 텍스트 대안이 실제로 존재하는지를 검사한다.
for token in ['width="256"', 'alt={`', 'figcaption', 'phase-selection-note', 'phase-rule-summary', 'role="status"']:
    assert token in satellite, f'missing satellite alternative: {token}'

report = (ROOT / 'apps/web/src/components/ReportEditor.tsx').read_text(encoding='utf-8')
for token in ['<label', 'aria-live="polite"', 'Markdown 다운로드', 'ndms']:
    assert token.lower() in report.lower(), f'missing report accessibility/safety: {token}'

print('multi-page accessibility structure: PASS')
