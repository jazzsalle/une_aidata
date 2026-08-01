from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
d=json.loads((root/'data/seed/damage_recovery_events_seed.json').read_text(encoding='utf-8'))
assert len(d['records'])==15
assert sum(r['data_status']=='actual_backed' for r in d['records'])==9
assert sum(r['data_status']=='synthetic_demo' for r in d['records'])==6
for r in d['records']:
    assert r['is_prediction'] is False
    assert r['data_status'] in {'actual_backed','synthetic_demo'}
    assert r.get('conditions')
    assert isinstance(r.get('evidence'),list)
    assert r.get('provider_id') and r.get('source_type')
print('similar event seed v1.3: OK')
