import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
files=['mock_flood_risk_areas.geojson','mock_dangerous_reservoirs.geojson','mock_storm_flood_improvement_districts.geojson']
for name in files:
    data=json.loads((ROOT/'data/seed'/name).read_text(encoding='utf-8'))
    assert data['type']=='FeatureCollection' and data['metadata']['runtime_policy']=='MOCK_ONLY'
    assert len(data['features'])==3
    for f in data['features']:
        p=f['properties'];assert p['data_status']=='mock' and p['official_data'] is False and p['is_prediction'] is False
        assert p['ref_disaster_event_id'].startswith('EVT::') and p['display_badges']
print('OK mock GIS 3 layers')
