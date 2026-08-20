from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
# 침수흔적 POC seed 는 2026-08-21 제거 — 행안부 실자료(reference/flood)로 대체됐다(메타 반영 P4).
s=json.loads((root/'data/seed/satellite_assets_seed.json').read_text(encoding='utf-8'))
for a in s['assets']:
    url=(root/'apps/web/public'/a['image_url'].lstrip('/'))
    thumb=(root/'apps/web/public'/a['thumbnail_url'].lstrip('/'))
    assert url.exists(), url
    assert thumb.exists(), thumb
print('spatial assets: OK')
