from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
situations=json.load(open(root/'data/seed/current_situations_seed.json',encoding='utf-8'))['situations']
districts=json.load(open(root/'data/reference/districts.json',encoding='utf-8'))['districts']
for s in situations:
    rows=[d for d in districts if d['admin_code']==s['admin_code']]
    assert rows, s['admin_code']
    assert any(o['type'].startswith('RAINFALL') for o in s['observations'])
    assert all(d.get('district_code') for d in rows)
print('PASS: 3개 지역 현재조건·위험지구 Seed 입력 검증')
