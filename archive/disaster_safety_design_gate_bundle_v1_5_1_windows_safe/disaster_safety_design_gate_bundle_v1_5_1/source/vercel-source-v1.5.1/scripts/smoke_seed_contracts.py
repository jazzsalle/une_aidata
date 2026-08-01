from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / 'data/seed'
errors: list[str] = []

allowed = {'actual','actual_backed','open_api','t3q_supplied','derived','scenario','scenario_input','mock','synthetic_demo','provisional','not_available'}

current = json.loads((SEED / 'current_situations_seed.json').read_text(encoding='utf-8'))
if len(current.get('situations', [])) < 3:
    errors.append('current_situations_seed: 3개 지역 시나리오가 필요합니다.')

priority = json.loads((SEED / 'priority_areas_seed.json').read_text(encoding='utf-8'))
for result in priority.get('results', []):
    if result.get('official_risk_score') is not False:
        errors.append(f"priority result {result.get('situation_id')}: official_risk_score must be false")
    for area in result.get('areas', []):
        if area.get('operator_confirmation_required') is not True:
            errors.append(f"priority area {area.get('spatial_object_id')}: confirmation required")

records = json.loads((SEED / 'damage_recovery_events_seed.json').read_text(encoding='utf-8'))
for record in records.get('records', []):
    if record.get('is_prediction') is not False:
        errors.append(f"damage record {record.get('record_id')}: is_prediction must be false")
    if record.get('data_status') not in allowed:
        errors.append(f"damage record {record.get('record_id')}: invalid data_status")

procedures = json.loads((SEED / 'response_procedures_seed.json').read_text(encoding='utf-8'))
for step in procedures.get('procedures', []):
    if step.get('official_for_target_municipality') is not False:
        errors.append(f"procedure {step.get('procedure_id')}: must not be official for target municipality")

for source_root in [ROOT / 'apps/web/src', ROOT / 'apps/api']:
    for path in source_root.rglob('*'):
        if path.is_file() and path.suffix.lower() in {'.ts', '.tsx', '.cs'}:
            text = path.read_text(encoding='utf-8', errors='ignore').lower()
            if 'cctv' in text:
                errors.append(f'CCTV implementation token found: {path.relative_to(ROOT)}')

if errors:
    print('\n'.join(errors))
    sys.exit(1)
print('OK: Seed safety and scope smoke tests passed')
