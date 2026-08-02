import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
events=json.loads((ROOT/'data/seed/t3q_mock_event_master_seed.json').read_text(encoding='utf-8'))['events']
passages=json.loads((ROOT/'data/seed/t3q_mock_passages_seed.json').read_text(encoding='utf-8'))['passages']
scenarios=json.loads((ROOT/'data/seed/t3q_mock_search_scenarios_seed.json').read_text(encoding='utf-8'))['scenarios']
assert len(scenarios)==5
for row in scenarios:
    found=[p for p in passages if p['admin_code']==row['admin_code'] and (not row['schema_types'] or p['schema_type'] in row['schema_types'])]
    assert found
    assert all(p['ref_disaster_event_id'] in {e['event_id'] for e in events} for p in found)
print('OK T3Q mock search preview fixtures')
