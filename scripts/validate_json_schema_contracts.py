#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker, RefResolver

ROOT=Path(__file__).resolve().parents[1]
SCHEMA_DIR=ROOT/'contracts/schemas'
SEED_DIR=ROOT/'data/seed'

SCHEMAS={p.name:json.loads(p.read_text(encoding='utf-8')) for p in SCHEMA_DIR.glob('*.schema.json')}
STORE={}
for name,s in SCHEMAS.items():
    STORE[name]=s
    STORE[(SCHEMA_DIR/name).as_uri()]=s
    if s.get('$id'): STORE[s['$id']]=s

def load_seed(name): return json.loads((SEED_DIR/name).read_text(encoding='utf-8'))
def validate(schema_name,obj,label):
    schema=SCHEMAS[schema_name]
    Draft202012Validator.check_schema(schema)
    resolver=RefResolver(base_uri=(SCHEMA_DIR/schema_name).as_uri(),referrer=schema,store=STORE)
    errors=sorted(Draft202012Validator(schema,resolver=resolver,format_checker=FormatChecker()).iter_errors(obj),key=lambda e:list(e.absolute_path))
    return [(label+'.'+'.'.join(map(str,e.absolute_path)),e.message) for e in errors]

def main():
    checks=[]
    cur=load_seed('current_situations_seed.json')
    for i,x in enumerate(cur['situations']):
        checks.append(('current-situation.schema.json',x,f'current_situations[{i}]'))
        for j,o in enumerate(x['observations']): checks.append(('observation.schema.json',o,f'current_situations[{i}].observations[{j}]'))
    dmg=load_seed('damage_recovery_events_seed.json')
    for i,x in enumerate(dmg['records']):
        checks.append(('damage-recovery-record.schema.json',x,f'damage_records[{i}]'))
        for j,e in enumerate(x.get('evidence',[])): checks.append(('evidence.schema.json',e,f'damage_records[{i}].evidence[{j}]'))
    ev=load_seed('t3q_mock_event_master_seed.json')
    for i,x in enumerate(ev['events']): checks.append(('t3q-event-master.schema.json',x,f't3q_events[{i}]'))
    ps=load_seed('t3q_mock_passages_seed.json')
    for i,x in enumerate(ps['passages']): checks.append(('t3q-passage.schema.json',x,f't3q_passages[{i}]'))
    rel=load_seed('t3q_mock_ontology_relations_seed.json')
    for i,x in enumerate(rel['relations']): checks.append(('ontology-relation.schema.json',x,f'ontology_relations[{i}]'))
    checks.append(('t3q-mock-search-scenarios.schema.json',load_seed('t3q_mock_search_scenarios_seed.json'),'t3q_scenarios'))
    checks.append(('t3q-integration-readiness.schema.json',load_seed('t3q_integration_readiness_seed.json'),'t3q_readiness'))
    checks.append(('t3q-cq-coverage.schema.json',load_seed('t3q_cq_coverage_seed.json'),'t3q_cq_coverage'))
    proc=load_seed('response_procedures_seed.json')
    for i,x in enumerate(proc['procedures']): checks.append(('procedure-step.schema.json',x,f'procedures[{i}]'))
    sat=load_seed('satellite_assets_seed.json')
    for i,x in enumerate(sat['assets']): checks.append(('satellite-asset.schema.json',x,f'satellite_assets[{i}]'))
    rep=load_seed('report_draft_seed.json')
    for i,x in enumerate(rep['reports']): checks.append(('report-draft.schema.json',x,f'reports[{i}]'))
    pri=load_seed('priority_areas_seed.json')
    for i,x in enumerate(pri['results']): checks.append(('priority-area.schema.json',x,f'priority_results[{i}]'))
    w=load_seed('similarity_weight_profiles_seed.json')
    for i,x in enumerate(w['profiles']): checks.append(('similarity-weight-profile.schema.json',x,f'weight_profiles[{i}]'))
    checks.append(('provider-contract.schema.json',load_seed('provider_contracts_seed.json'),'provider_contracts'))
    for fn in ['mock_flood_risk_areas_seed.json','mock_dangerous_reservoirs_seed.json','mock_storm_flood_improvement_districts_seed.json']:
        checks.append(('mock-spatial-feature-collection.schema.json',load_seed(fn),fn))
    # Runtime outputs generated in the baseline
    p=ROOT/'tests/provider/provider_conformance_result.json'
    if p.exists(): checks.append(('provider-conformance-result.schema.json',json.loads(p.read_text(encoding='utf-8')),'provider_conformance_result'))
    runtime=ROOT/'tests/runtime/runtime_regression_result.json'
    if runtime.exists():
        data=json.loads(runtime.read_text(encoding='utf-8'))
        # Discover factor summaries wherever present.
        def walk(x,path='runtime'):
            if isinstance(x,dict):
                if {'profile_id','event_similarity_score','comparison_coverage','confidence_status','factors','graph_similarity_status'}<=set(x):
                    checks.append(('similarity-result.schema.json',x,path))
                for k,v in x.items(): walk(v,f'{path}.{k}')
            elif isinstance(x,list):
                for i,v in enumerate(x): walk(v,f'{path}[{i}]')
        walk(data)
    failures=[]
    counts={}
    for schema,obj,label in checks:
        errs=validate(schema,obj,label)
        counts[schema]=counts.get(schema,0)+1
        failures.extend((schema,*e) for e in errs)
    if failures:
        print(f'FAIL JSON Schema contracts: {len(failures)} errors / {len(checks)} objects')
        for row in failures[:80]: print(' | '.join(row))
        if len(failures)>80: print(f'... {len(failures)-80} more')
        return 1
    print(f'PASS JSON Schema contracts: {len(checks)} objects / {len(counts)} schemas')
    for k in sorted(counts): print(f'  {k}: {counts[k]}')
    return 0
if __name__=='__main__': sys.exit(main())
