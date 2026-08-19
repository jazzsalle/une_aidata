"""지도 하천 검색용 색인을 만든다. 반입이 끝난 자료에서 이름만 모은다.

    입력  apps/web/public/reference/rivers/river_region_catalog.json
          apps/web/public/reference/rivers/LSMD_SOCHUN_{시군구}.geojson  (전국 188개)
          apps/web/public/reference/rivers/river_network_catalog.json
    출력  apps/web/public/reference/rivers/river_search_index.json

검색할 때마다 시군구 GeoJSON(최대 3.6 MB)을 받게 하지 않으려고 만든다. 색인에는 이름과
찾아갈 위치만 담고 형상은 담지 않는다.

**폴리곤이 아니라 하천 단위로 담는다.** 소하천구역은 한 하천이 고시구간·좌우안으로 쪼개져
들어와서(전국 116,758 폴리곤) 폴리곤마다 넣으면 색인이 20 MB 를 넘고 같은 이름이 수십 번
나온다. 시군구+하천명으로 묶으면 19,684건이다.

`nav`(경도, 위도)는 **화면 이동 전용 좌표**다. 묶인 폴리곤 전체 bbox 의 중심이라 자료가 가진
값이 아니다. `nav_kind` 로 그 성격을 구분해 두며 화면에 위치값으로 표시하면 안 된다.

국가·지방하천은 하천망도 카탈로그에서 온다. 이들은 여러 시군구에 걸쳐 있어 한 지역에
배정할 수 없으므로 `admin` 을 비우고 `scope='nationwide'` 로 표시한다 — 결과를 고르면
지역을 바꾸지 않고 그 하천 위치로만 움직인다. 대신 지나는 시군구 전부를 `admins` 에 담는다.
청계천이 전국에 14개(지방하천 5 · 소하천 9)라 시군구 없이는 어느 청계천인지 고를 수 없다.
시군구를 골랐을 때 그 시군구를 지나는 것만 거르고, 화면에 '종로구 외 3곳' 처럼 적는 데 쓴다.
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DIR = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'


def ring_points(geometry, out: list) -> list:
    stack = [geometry['coordinates']]
    while stack:
        item = stack.pop()
        if item and isinstance(item[0], (int, float)):
            out.append(item)
        else:
            stack.extend(item)
    return out


def main() -> int:
    catalog_path = DIR / 'river_region_catalog.json'
    if not catalog_path.exists():
        print(f'{catalog_path.name} 이 없다. scripts/build_sochun_layers.py 를 먼저 실행하라.')
        return 1
    regions = json.loads(catalog_path.read_text(encoding='utf-8'))['regions']

    entries: list[dict] = []
    for row in regions:
        code = row['code']
        path = DIR / f'LSMD_SOCHUN_{code}.geojson'
        if not path.exists():
            continue
        grouped: dict[str, dict] = {}
        for feature in json.loads(path.read_text(encoding='utf-8'))['features']:
            name = feature['properties'].get('stream_name')
            if not name:
                # 이름이 원자료에서 읽히지 않은 구역은 검색어로 찾을 방법이 없다. 색인에 넣지 않는다.
                continue
            bucket = grouped.setdefault(name, {'points': [], 'ids': [], 'notified': set()})
            ring_points(feature['geometry'], bucket['points'])
            bucket['ids'].append(feature['id'])
            notified = feature['properties'].get('notified_on')
            if notified:
                bucket['notified'].add(notified)
        for name, bucket in sorted(grouped.items()):
            lons = [p[0] for p in bucket['points']]
            lats = [p[1] for p in bucket['points']]
            pieces = len(bucket['ids'])
            # 시군구명은 넣지 않는다 — 화면이 admin 으로 지역을 적으므로(다른 지역 결과에만) 여기 또 적으면
            # '포천시 포천시' 처럼 겹친다. 구역 수·고시일처럼 이 행에만 있는 것을 적는다.
            parts = []
            if pieces > 1:
                parts.append(f'구역 {pieces}개')
            if bucket['notified']:
                parts.append(f'고시 {max(bucket["notified"])}')
            detail = ' · '.join(parts)
            entries.append({
                'name': name,
                'kind': '소하천구역',
                'source_id': 'lsmd-sochun',
                'admin': code,
                'scope': 'region',
                'feature_id': bucket['ids'][0],
                'nav': [round((min(lons) + max(lons)) / 2, 6), round((min(lats) + max(lats)) / 2, 6)],
                'nav_kind': 'extent',
                'detail': detail,
            })

    # 하천코드별로 국가기본도 경계·실폭 조각이 있는 시군구와 조각 수. 검색 결과를 골랐을 때 어느
    # 시군구로 옮길지 정하는 근거다 — 하천망도가 말하는 '지나는 시군구' 와 국가기본도에 조각이 실제로
    # 있는 시군구는 다르다. 반포천은 하천망도로는 동작구·서초구인데 동작구 구간은 복개라 국가기본도
    # 조각이 서초구에만 있다. 조각이 있는 곳으로 가야 화면에 뭐가 보인다.
    pieces: dict[str, Counter] = defaultdict(Counter)
    for layer in ('TN_RIVER_BNDRY', 'TN_RIVER_BT'):
        for path in DIR.glob(f'{layer}_*.geojson'):
            code = path.stem[len(layer) + 1:]
            for feature in json.loads(path.read_text(encoding='utf-8'))['features']:
                river_code = feature['properties'].get('river_code')
                if river_code:
                    pieces[str(river_code)][code] += 1

    network_path = DIR / 'river_network_catalog.json'
    if network_path.exists():
        for river in json.loads(network_path.read_text(encoding='utf-8'))['rivers']:
            # admins 는 조각이 많은 시군구부터. 조각이 없는 시군구(복개·미도시 구간)는 뒤로 간다.
            counted = pieces.get(str(river['river_code']), Counter())
            admins = sorted(river.get('admin_codes') or [], key=lambda c: (-counted.get(c, 0), c))
            entries.append({
                'name': river['river_name'],
                'kind': river['river_class'],
                'source_id': 'river-network',
                'admin': '',
                'admins': admins,
                'scope': 'nationwide',
                'feature_id': river['river_code'],
                # 이동 좌표는 bbox 중심(nav)이 아니라 폴리곤 내부점(label_point)이다. 한강 bbox 중심은
                # 경기 광주 산속이지만 내부점은 반드시 하천 위에 있다. 시군구를 골랐을 때는 화면이
                # 그 시군구의 국가기본도 조각으로 맞추므로 이 좌표는 다른 지역 하천으로 갈 때만 쓴다.
                'nav': river.get('label_point') or river['nav'],
                'nav_kind': 'interior' if river.get('label_point') else river['nav_kind'],
                'detail': f'하천코드 {river["river_code"]}',
            })

    out = DIR / 'river_search_index.json'
    out.write_text(json.dumps({
        'dataset': 'river_search_index',
        'note': ('nav 는 화면 이동 전용 좌표다. nav_kind=extent 는 형상 bbox 중심(자료값 아님)이다. '
                 'scope=nationwide 는 여러 시군구에 걸친 하천이라 지역에 배정하지 않은 항목이며, '
                 '고르면 지역을 바꾸지 않고 그 위치로만 움직인다.'),
        'regions': [{'admin_code': row['code'], 'admin_name': f'{row["sido"]} {row["sgg"]}'}
                    for row in regions if row['sido'] and row['sgg']],
        'entries': entries,
    }, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    by_scope: dict[str, int] = {}
    for entry in entries:
        by_scope[entry['scope']] = by_scope.get(entry['scope'], 0) + 1
    print(f'  river_search_index.json: {len(entries):,}건 · {out.stat().st_size / 1024:,.0f} KB · {by_scope}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
