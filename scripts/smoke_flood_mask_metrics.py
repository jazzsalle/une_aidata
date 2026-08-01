from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
d=json.loads((ROOT/'data/seed/flood_mask_metrics_seed.json').read_text(encoding='utf-8'))
assert d['metric_scope']=='PIXEL_RELATIVE_ONLY'
assert d['geographic_area_calculation'] is False
assert d['is_prediction'] is False
assert [x['phase'] for x in d['phases']]==['PRE','EVENT','POST']
assert all(x['total_pixels']==65536 for x in d['phases'])
assert d['phases'][0]['net_water_pixels_from_pre']==0
assert d['phases'][1]['water_pixels']>=d['phases'][0]['water_pixels']
assert d['phases'][2]['water_pixels']>=d['phases'][1]['water_pixels']
print('PASS: flood mask pixel metrics')
