#!/usr/bin/env python3
from __future__ import annotations
import re, sys
from pathlib import Path
import yaml

ROOT=Path(__file__).resolve().parents[1]
ROUTES_ROOT=ROOT/'server/routes'
CATCH_ALL=ROOT/'api/[[...path]].ts'
SPEC_PATH=ROOT/'contracts/openapi/poc-backend.yaml'
METHODS={'GET','POST','PUT','PATCH','DELETE'}

def handler_routes():
    """server/routes/**.ts에서 export된 HTTP 메서드를 스캔해 (METHOD, /api/...) 경로를 유도한다."""
    out=set()
    for path in ROUTES_ROOT.rglob('*.ts'):
        text=path.read_text(encoding='utf-8')
        rel=path.relative_to(ROUTES_ROOT).with_suffix('')
        route='/api/'+'/'.join(rel.parts)
        for method in re.findall(r'export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(',text):
            out.add((method,route))
    return out

def table_routes():
    """api/[[...path]].ts 라우팅 테이블('METHOD /api/path': handler)을 파싱한다."""
    text=CATCH_ALL.read_text(encoding='utf-8')
    out=set()
    for method,route in re.findall(r"'(GET|POST|PUT|PATCH|DELETE)\s+(/api/[^']+)'\s*:",text):
        entry=(method,route)
        assert entry not in out, f'duplicate routing table entry: {method} {route}'
        out.add(entry)
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

def diff(label_a,a,label_b,b):
    """a-b, b-a 차이를 (설명, 목록) 튜플 리스트로 반환한다."""
    issues=[]
    only_a=sorted(a-b); only_b=sorted(b-a)
    if only_a: issues.append((f'{label_a}에만 존재({label_b} 누락)',only_a))
    if only_b: issues.append((f'{label_b}에만 존재({label_a} 누락)',only_b))
    return issues

def main():
    spec=yaml.safe_load(SPEC_PATH.read_text(encoding='utf-8'))
    assert spec.get('openapi')=='3.0.3', 'OpenAPI 3.0.3 required'
    assert CATCH_ALL.exists(), 'api/[[...path]].ts catch-all missing'
    handlers=handler_routes(); table=table_routes(); declared,incomplete=spec_routes(spec)
    issues=[]
    issues+=diff('handler(server/routes)',handlers,'routing-table(api/[[...path]].ts)',table)
    issues+=diff('routing-table(api/[[...path]].ts)',table,'openapi(poc-backend.yaml)',declared)
    issues+=diff('handler(server/routes)',handlers,'openapi(poc-backend.yaml)',declared)
    if issues or incomplete:
        print('FAIL OpenAPI contract (3-way: handler / routing-table / spec)')
        for desc,items in issues: print(f'{desc}:',items)
        if incomplete: print('incomplete:',sorted(set(incomplete)))
        return 1
    operation_ids=[]
    for item in spec['paths'].values():
        for method,op in item.items():
            if method.upper() in METHODS: operation_ids.append(op['operationId'])
    if len(operation_ids)!=len(set(operation_ids)):
        print('FAIL duplicate operationId')
        return 1
    print(f'PASS OpenAPI semantic contract: {len(handlers)} handler routes = {len(table)} routing-table entries = {len(declared)} operations; incomplete=0')
    return 0
if __name__=='__main__': sys.exit(main())
