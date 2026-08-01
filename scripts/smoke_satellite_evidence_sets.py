#!/usr/bin/env python3
from pathlib import Path
import json,hashlib
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
reg=json.loads((ROOT/'data/seed/satellite_evidence_sets_seed.json').read_text(encoding='utf-8'))
assets=json.loads((ROOT/'data/seed/satellite_assets_seed.json').read_text(encoding='utf-8'))['assets']
by={a['asset_id']:a for a in assets}
assert reg['sets'], 'evidence set missing'
for s in reg['sets']:
 assert len(s['asset_ids'])==6
 assert s['map_overlay_allowed'] is False and s['base_map']=='VWorld 2D'
 assert s['official_data'] is False and s['is_prediction'] is False
 assert s['area']['is_target_region'] is False
 seen=set()
 for m in s['integrity']['assets']:
  aid=m['asset_id']; assert aid in by and aid in s['asset_ids']; seen.add(aid)
  f=ROOT/'apps/web/public'/m['file']; assert f.exists(),f
  im=Image.open(f); assert im.size==(256,256),(aid,im.size)
  h=hashlib.sha256(f.read_bytes()).hexdigest(); assert h==m['sha256'],aid
  assert by[aid]['map_overlay_allowed'] is False
 assert seen==set(s['asset_ids'])
print('PASS satellite evidence sets',len(reg['sets']))
