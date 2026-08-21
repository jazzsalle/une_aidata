"""위험지역 점 자료 3종(붕괴위험지역·위험저수지·풍수해개선지구)을 지도 레이어로 반입한다.

    입력  GIS_data/{붕괴위험지역·위험저수지·풍수해개선지구}.geojson  (2026-08-21 사용자 제공)
    출력  apps/web/public/reference/risk/RISK_{COLLAPSE|RESERVOIR|STORM_IMPROVE}.geojson

원자료는 EPSG:4326 Point 에 연번·주소·위험유형 세 속성뿐이다. 전국 합계 4,834점으로 파일이
작아(각 1 MB 미만) 관측소 레이어와 같은 방식 — **전국 한 파일, 레이어를 켤 때 로드** — 를 쓴다.
시군구별로 자르지 않는다.

원자료에 출처·기준일 표기가 없다. 값을 지어내지 않는다 — `official_data: false` 와
'출처·공개등급 확인 필요' 표기를 유지하고, 확인되면 이 스크립트의 SOURCE 만 바꿔 다시 뽑는다.
(v1.1 규칙의 '검증 전 활성화 금지'는 사용자 제공·반영 지시(2026-08-21)로 해제하되, 공식자료
표기는 확인 전까지 하지 않는다.)

검증: 좌표가 대한민국 범위(경도 124~132.5 · 위도 32.5~39.5)를 벗어나면 버리고 개수를 보고한다.
주소가 빈 점도 버린다 — 팝업에 보여줄 것이 없다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from source_data import GIS_DATA, REPO, require  # noqa: E402

OUT_DIR = REPO / 'apps' / 'web' / 'public' / 'reference' / 'risk'
KR_BBOX = (124.0, 32.5, 132.5, 39.5)
SOURCE = '사용자 제공 위험지역 점 자료(2026-08-21 수령) — 출처·공개등급 확인 필요'

LAYERS = [
    ('붕괴위험지역', 'RISK_COLLAPSE', 'COLLAPSE'),
    ('위험저수지', 'RISK_RESERVOIR', 'RESERVOIR'),
    ('풍수해개선지구', 'RISK_STORM_IMPROVE', 'STORM'),
]


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for src_name, out_name, prefix in LAYERS:
        path = require(GIS_DATA / f'{src_name}.geojson', f'{src_name} 원자료')
        payload = json.loads(path.read_text(encoding='utf-8'))
        kept = []
        dropped_bbox = dropped_addr = 0
        for feature in payload.get('features', []):
            geometry = feature.get('geometry') or {}
            props = feature.get('properties') or {}
            if geometry.get('type') != 'Point':
                continue
            lon, lat = geometry['coordinates'][:2]
            if not (KR_BBOX[0] <= lon <= KR_BBOX[2] and KR_BBOX[1] <= lat <= KR_BBOX[3]):
                dropped_bbox += 1
                continue
            address = str(props.get('주소') or '').strip()
            if not address:
                dropped_addr += 1
                continue
            serial = props.get('연번')
            kept.append({
                'type': 'Feature',
                'id': f'{prefix}:{serial}',
                'geometry': {'type': 'Point', 'coordinates': [round(lon, 6), round(lat, 6)]},
                'properties': {
                    'id': f'{prefix}:{serial}',
                    'serial': serial,
                    'risk_type': str(props.get('위험유형') or src_name),
                    'address': address,
                    'data_kind': 'risk_point',
                    'official_data': False,
                    'is_prediction': False,
                    'source': SOURCE,
                    'display_badges': ['출처·공개등급 확인 필요'],
                },
            })
        out = OUT_DIR / f'{out_name}.geojson'
        out.write_text(json.dumps({'type': 'FeatureCollection', 'features': kept},
                                  ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        note = []
        if dropped_bbox:
            note.append(f'범위 밖 {dropped_bbox}')
        if dropped_addr:
            note.append(f'주소 없음 {dropped_addr}')
        print(f'{out_name}: {len(kept):,}점 · {out.stat().st_size / 1024:.0f} KB'
              + (f' · 버림({", ".join(note)})' if note else ''))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
