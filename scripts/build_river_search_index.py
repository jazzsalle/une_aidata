"""지도 하천 검색용 색인을 만든다. 반입이 끝난 GeoJSON 들에서 이름만 모은다.

    입력  apps/web/public/reference/rivers/{LSMD_SOCHUN,TN_RIVER_LABEL}_{admin}.geojson
    출력  apps/web/public/reference/rivers/river_search_index.json

검색할 때마다 지역별 GeoJSON(최대 3.5 MB)을 받게 하지 않으려고 만든다. 색인에는 이름과
찾아갈 위치만 담고 형상은 담지 않는다.

`nav`(경도, 위도)는 **화면 이동 전용 좌표**다. 폴리곤 자료에서는 형상 bbox 의 중심이라
자료가 가진 값이 아니다. 그래서 `nav_kind` 로 그 좌표가 실측인지 화면이동용인지 구분해 둔다 —
화면에 위치값으로 표시하면 안 되는 좌표다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from river_regions import REGIONS  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
DIR = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'


def coords_of(geometry, out=None):
    out = [] if out is None else out
    coordinates = geometry['coordinates']
    if geometry['type'] == 'Point':
        out.append(coordinates)
        return out
    stack = [coordinates]
    while stack:
        item = stack.pop()
        if item and isinstance(item[0], (int, float)):
            out.append(item)
        else:
            stack.extend(item)
    return out


def bbox_center(geometry):
    points = coords_of(geometry)
    if not points:
        return None
    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    return [round((min(lons) + max(lons)) / 2, 6), round((min(lats) + max(lats)) / 2, 6)]


def load(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))['features'] if path.exists() else []


def main() -> int:
    entries = []
    for region in REGIONS:
        for feature in load(DIR / f'LSMD_SOCHUN_{region.admin}.geojson'):
            name = feature['properties'].get('stream_name')
            if not name:
                # 이름이 원자료에서 읽히지 않은 구역은 검색어로 찾을 방법이 없다. 색인에 넣지 않는다.
                continue
            entries.append({
                'name': name, 'kind': '소하천구역', 'source_id': 'lsmd-sochun',
                'admin': region.admin, 'feature_id': feature['id'],
                'nav': bbox_center(feature['geometry']), 'nav_kind': 'extent',
                'detail': feature['properties'].get('notified_on', ''),
            })

        for feature in load(DIR / f'TN_RIVER_LABEL_{region.admin}.geojson'):
            entries.append({
                'name': feature['properties']['RIVER_NM'], 'kind': '국가기본도 하천',
                'source_id': 'ngii-centerline', 'admin': region.admin,
                'feature_id': feature['id'],
                'nav': feature['geometry']['coordinates'], 'nav_kind': 'actual',
                'detail': feature['properties'].get('river_class', ''),
            })

    out = DIR / 'river_search_index.json'
    out.write_text(json.dumps({
        'dataset': 'river_search_index',
        'note': 'nav 는 화면 이동 전용 좌표다. nav_kind=extent 는 형상 bbox 중심(자료값 아님), actual 은 원자료 좌표, none 은 이동 불가.',
        'regions': [{'admin_code': region.admin, 'admin_name': region.name} for region in REGIONS],
        'entries': entries,
    }, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    from collections import Counter
    print(f'  river_search_index.json: {len(entries):,}건 · {out.stat().st_size // 1024:,} KB')
    for admin, count in sorted(Counter(e['admin'] for e in entries).items()):
        kinds = Counter(e['source_id'] for e in entries if e['admin'] == admin)
        print(f'    {admin}: {count:,}건 {dict(kinds)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
