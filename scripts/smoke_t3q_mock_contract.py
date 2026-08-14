import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
events=json.loads((ROOT/'data/seed/t3q_mock_event_master_seed.json').read_text(encoding='utf-8'))['events']
passages=json.loads((ROOT/'data/seed/t3q_mock_passages_seed.json').read_text(encoding='utf-8'))['passages']
relations=json.loads((ROOT/'data/seed/t3q_mock_ontology_relations_seed.json').read_text(encoding='utf-8'))['relations']
assert len(events)==15 and len(passages)==73 and len(relations)==73
ids={e['event_id'] for e in events}
assert all(re.match(r'^EVT::\d{8}-[A-Z_]+-\d{5}-\d{3}$',e['event_id']) for e in events)
assert all(p['data_status'] in {'actual_backed','synthetic_demo'} and not p['official_data'] and p['ref_disaster_event_id'] in ids for p in passages)
assert all(r['data_status'] in {'actual_backed','synthetic_demo'} for r in relations)
print('OK v1.3 Event/Passage/Relation contract')
