#!/usr/bin/env python3
from __future__ import annotations
import re, sys
from pathlib import Path
import yaml

ROOT=Path(__file__).resolve().parents[1]
API_ROOT=ROOT/'api'
SPEC_PATH=ROOT/'contracts/openapi/poc-backend.yaml'
METHODS={'GET','POST','PUT','PATCH','DELETE'}

def actual_routes():
    out=set()
    for path in API_ROOT.rglob('*.ts'):
        text=path.read_text(encoding='utf-8')
        rel=path.relative_to(API_ROOT).with_suffix('')
        route='/api/'+'/'.join(rel.parts)
        for method in re.findall(r'export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(',text):
            out.add((method,route))
    return out

def spec_routes(spec):
    out=set(); incomplete=[]
    for route,item in (spec.get('paths') or {}).items():
        if not isinstance(item,dict): continue
        for method,op in item.items():
            if method.upper() not in METHODS: continue
            out.add((method.upper(),route))
            if not isinstance(op,dict) or not op.get('operationId') or not op.get('summary') or not op.get('responses'):
                incomplete.append((method.upper(),route))
            else:
                r200=(op['responses'].get('200') or {})
                content=(r200.get('content') or {}).get('application/json') or {}
                if not content.get('schema'):
                    incomplete.append((method.upper(),route))
    return out,incomplete

def main():
    spec=yaml.safe_load(SPEC_PATH.read_text(encoding='utf-8'))
    assert spec.get('openapi')=='3.0.3', 'OpenAPI 3.0.3 required'
    actual=actual_routes(); declared,incomplete=spec_routes(spec)
    missing=sorted(actual-declared); phantom=sorted(declared-actual)
    if missing or phantom or incomplete:
        print('FAIL OpenAPI contract')
        if missing: print('missing:',missing)
        if phantom: print('phantom:',phantom)
        if incomplete: print('incomplete:',sorted(set(incomplete)))
        return 1
    operation_ids=[]
    for item in spec['paths'].values():
        for method,op in item.items():
            if method.upper() in METHODS: operation_ids.append(op['operationId'])
    if len(operation_ids)!=len(set(operation_ids)):
        print('FAIL duplicate operationId')
        return 1
    print(f'PASS OpenAPI semantic contract: {len(actual)} actual routes = {len(declared)} operations; incomplete=0')
    return 0
if __name__=='__main__': sys.exit(main())
