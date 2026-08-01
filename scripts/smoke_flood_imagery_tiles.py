from pathlib import Path
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
seed=json.loads((ROOT/'data/seed/satellite_assets_seed.json').read_text(encoding='utf-8'))
assets=[a for a in seed['assets'] if a.get('event_id')=='POC-FLOOD-IMAGE-SAMPLE-001']
assert len(assets)==6, len(assets)
assert {a['phase'] for a in assets}=={'PRE','EVENT','POST'}
assert {a['asset_kind'] for a in assets}=={'SATELLITE','WATER_MASK'}
for a in assets:
    assert a['tile_size_px']==[256,256]
    assert a['display_mode']=='standalone_tile_card' and a['map_overlay_allowed'] is False
    assert a['official_data'] is False and a['data_status']=='mock' and a['shared_demo'] is True
    path=ROOT/'apps/web/public'/a['image_url'].lstrip('/')
    with Image.open(path) as im: assert im.size==(256,256), (path,im.size)
print('PASS: flood PRE/EVENT/POST 256x256 tiles')
