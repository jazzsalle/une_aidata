from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
required=[
 'server/providers/hrfcoHydrology.ts',
 'server/providers/kmaNowcast.ts',
 'server/providers/uneRag.ts',
 'api/v1/observations/hydrology.ts',
 'api/v1/integrations/une-rag-probe.ts',
 'data/seed/hydrology_station_candidates_seed.json',
]
missing=[item for item in required if not (root/item).exists()]
assert not missing, f'missing: {missing}'
station=json.loads((root/'data/seed/hydrology_station_candidates_seed.json').read_text())
assert len(station['stations'])==3
assert all(row['official_station_code'] is None for row in station['stations'])
assert all(row['verification_status']=='pending' for row in station['stations'])
hrfco=(root/'server/providers/hrfcoHydrology.ts').read_text()
assert 'official_station_code' in hrfco
assert 'USER_INPUT_OR_SCENARIO' not in hrfco
assert "value_status: 'actual'" in hrfco and 'official_data: true' in hrfco
rag=(root/'server/providers/uneRag.ts').read_text()
for token in ['UNE_RAG_OPENAPI_PATH','UNE_RAG_RESPONSE_ARRAY_PATH','UNE_RAG_QUERY_FIELD','probeUneRagOpenApi']:
    assert token in rag, token
map_adapter=(root/'apps/web/src/features/map/VWorldMapAdapter.ts').read_text()
assert "type BaseMapType = 'base' | 'satellite'" in map_adapter
assert 'setBaseMap(type' in map_adapter
print('PASS integration adapters and safety guards')
