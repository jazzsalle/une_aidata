from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
f=json.loads((root/'data/seed/flood_traces_seed.geojson').read_text(encoding='utf-8'))
assert f['type']=='FeatureCollection' and len(f['features'])==3
for x in f['features']:
    assert x['properties']['official_data'] is False
    assert x['properties']['is_prediction'] is False
s=json.loads((root/'data/seed/satellite_assets_seed.json').read_text(encoding='utf-8'))
for a in s['assets']:
    url=(root/'apps/web/public'/a['image_url'].lstrip('/'))
    thumb=(root/'apps/web/public'/a['thumbnail_url'].lstrip('/'))
    assert url.exists(), url
    assert thumb.exists(), thumb
print('spatial assets: OK')
