from pathlib import Path
root=Path(__file__).resolve().parents[1]
app=(root/'apps/web/src/App.tsx').read_text()
report=(root/'apps/web/src/components/ReportEditor.tsx').read_text()
for token in ['ReportEvidenceSelection','saveReportEvidenceSelection','onSelectSatelliteEventSet','onToggleFloodTrace','onToggleEvent']:
    assert token in app, token
for token in ['현재 피해예측 아님','침수흔적도 Seed 근거','선택된 피해·변화 참고근거']:
    assert token in report, token
print('PASS report context')
