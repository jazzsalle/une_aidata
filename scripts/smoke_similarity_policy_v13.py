import json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
e=json.loads((ROOT/'data/seed/damage_recovery_events_seed.json').read_text(encoding='utf-8'))
p=json.loads((ROOT/'data/seed/similarity_weight_profiles_seed.json').read_text(encoding='utf-8'))
assert len(e['records'])==15
assert sum(1 for x in e['records'] if x['data_status']=='actual_backed')==9
assert sum(1 for x in e['records'] if x['data_status']=='synthetic_demo')==6
for profile in p['profiles']:
 assert sum(profile['weights'].values())==100
print('PASS v1.3 events/profiles:',len(e['records']),len(p['profiles']))
