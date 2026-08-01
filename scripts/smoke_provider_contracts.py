import json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=json.loads((ROOT/'data/seed/provider_contracts_seed.json').read_text(encoding='utf-8'))
assert {r['domain'] for r in p['providers']}=={'event','risk','observation','spatial'}
for r in p['providers']:
 assert r['future_api_content'] and r['common_model'] and r['env_key']
print('PASS provider contracts:',len(p['providers']))
