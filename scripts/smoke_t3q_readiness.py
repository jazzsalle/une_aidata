from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
readiness=json.loads((root/'data/seed/t3q_integration_readiness_seed.json').read_text(encoding='utf-8'))
coverage=json.loads((root/'data/seed/t3q_cq_coverage_seed.json').read_text(encoding='utf-8'))
fields=json.loads((root/'data/seed/t3q_field_contract_seed.json').read_text(encoding='utf-8'))
assert readiness['runtime_policy']=='MOCK_ONLY'
assert len(readiness['dimensions'])==6
ids={row['dimension_id'] for row in readiness['dimensions']}
assert {'RDY-IDENTITY','RDY-TAXONOMY','RDY-PASSAGE','RDY-CQ','RDY-SPATIAL','RDY-MCP'}<=ids
assert len(coverage['items'])==5
assert {row['cq_id'] for row in coverage['items']}=={'CQ-01','CQ-02','CQ-03','CQ-04','CQ-05'}
assert all(row['screen_outputs'] and row['fallback'] and row['runtime_state']=='mock' for row in coverage['items'])
field_names={row['field'] for row in fields['items']}
for required in {'event_id','ref_disaster_event_id','schema_type','taxonomy_codes','passage_id','lineage.document_page'}: assert required in field_names
for file in ['t3q-integration-readiness.schema.json','t3q-cq-coverage.schema.json','t3q-search-preview.schema.json']:
    json.loads((root/'contracts/schemas'/file).read_text(encoding='utf-8'))
assert (root/'server/routes/v1/t3q/readiness.ts').exists()
assert (root/'server/routes/v1/t3q/cq-coverage.ts').exists()
assert (root/'apps/web/src/components/T3qReadinessPanel.tsx').exists()
print('PASS: T3Q readiness/CQ coverage seed and contract validation')
