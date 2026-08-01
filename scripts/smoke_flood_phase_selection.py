from datetime import datetime, timedelta
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
d=json.loads((ROOT/'data/seed/satellite_assets_seed.json').read_text(encoding='utf-8'))
basis=d['phase_selection_policy']['event_time_basis']
start=datetime.fromisoformat(basis['event_start_at']);end=datetime.fromisoformat(basis['event_end_at'])
assets=[x for x in d['assets'] if x.get('event_id')=='POC-FLOOD-IMAGE-SAMPLE-001' and x.get('asset_kind')=='SATELLITE']
by={x['phase']:datetime.fromisoformat(x['acquired_at']) for x in assets}
assert by['PRE']<start
assert start<=by['EVENT']<=end+timedelta(days=2)
assert by['POST']>end+timedelta(days=2)
assert abs((by['PRE']-(start-timedelta(days=12))).total_seconds())/86400<1
assert abs((by['POST']-(end+timedelta(days=12))).total_seconds())/86400<1
print('PASS: flood phase selection seed timing')
