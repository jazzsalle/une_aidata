from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
a=json.loads((root/'data/seed/t3q_alignment_seed.json').read_text(encoding='utf-8'))
l=json.loads((root/'data/seed/layer_catalog_seed.json').read_text(encoding='utf-8'))
assert a['event_id']['canonical_pattern'].startswith('EVT::')
assert len(a['competency_questions'])==5
assert any(x['une_event_code']=='INUNDATION' and x['t3q_disaster_type']=='FLOOD' for x in a['code_mapping'])
ids={x['layer_id'] for x in l['layers']}
for expected in {'L-FLOOD-RISK-AREA','L-DANGEROUS-RESERVOIR','L-STORM-FLOOD-IMPROVEMENT'}: assert expected in ids
for name in ['t3q-passage.schema.json','t3q-event-master.schema.json','ontology-relation.schema.json']:
    assert (root/'contracts/schemas'/name).exists()
print('T3Q alignment smoke test passed')
