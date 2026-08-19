"""지도 지역 선택기가 쓰는 시군구 목록을 만든다.

    입력  apps/web/public/reference/rivers/{LSMD_SOCHUN,TN_RIVER_BNDRY,TN_RIVER_BT}_{시군구}.geojson
          data/reference/sgg_code_map.json
    출력  apps/web/public/reference/rivers/river_region_catalog.json

**반입된 자료가 하나라도 있는 시군구만 담는다.** 골랐는데 지도에 아무것도 없는 항목이
생기지 않게 하려는 것이다. 소하천구역만 보고 만들면 국가기본도 하천만 있는 시군구
(하천은 있는데 소하천이 없는 곳)가 목록에서 빠진다 — 그래서 세 레이어를 함께 본다.

`center` 는 형상 bbox 중심이라 자료가 가진 좌표가 아니다. 화면 이동 전용이며 위치값으로
표시하지 않는다. 소하천구역이 있으면 그것을 쓰고, 없으면 하천경계·실폭 차례로 쓴다 —
소하천구역이 그 시군구의 하천 분포를 가장 고르게 담고 있다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from source_data import REPO, require  # noqa: E402

DIR = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'
OUT = DIR / 'river_region_catalog.json'
SGG_MAP = REPO / 'data' / 'reference' / 'sgg_code_map.json'

#: 앞의 것을 먼저 써서 중심좌표를 정한다.
LAYERS = ('LSMD_SOCHUN', 'TN_RIVER_BNDRY', 'TN_RIVER_BT')


def sgg_names() -> dict:
    payload = json.loads(require(SGG_MAP, '시군구 코드표').read_text(encoding='utf-8'))
    names: dict = {}
    for entry in payload['entries']:
        for code in entry['codes']:
            names.setdefault(code, (entry['sido'], entry['sgg']))
    return names


def scan(prefix: str) -> dict:
    found: dict = {}
    for path in DIR.glob(f'{prefix}_*.geojson'):
        code = path.stem[len(prefix) + 1:]
        if code.isdigit():
            found[code] = path
    return found


def summary(path: Path) -> tuple:
    features = json.loads(path.read_text(encoding='utf-8'))['features']
    lons: list = []
    lats: list = []
    named = 0
    for feature in features:
        if feature['properties'].get('stream_name') or feature['properties'].get('river_name'):
            named += 1
        stack = [feature['geometry']['coordinates']]
        while stack:
            item = stack.pop()
            if item and isinstance(item[0], (int, float)):
                lons.append(item[0])
                lats.append(item[1])
            else:
                stack.extend(item)
    center = ([round((min(lons) + max(lons)) / 2, 6), round((min(lats) + max(lats)) / 2, 6)]
              if lons else None)
    return len(features), named, center


def main() -> int:
    names = sgg_names()
    layers = {prefix: scan(prefix) for prefix in LAYERS}
    codes = sorted(set().union(*(set(found) for found in layers.values())))
    print(f'자료가 있는 시군구 {len(codes)}개 · ' +
          ' · '.join(f'{prefix} {len(found)}' for prefix, found in layers.items()))

    rows = []
    unknown = []
    for code in codes:
        sido, sgg = names.get(code, (None, None))
        if not sgg:
            unknown.append(code)
        row = {'code': code, 'sido': sido, 'sgg': sgg, 'center': None}
        for prefix in LAYERS:
            path = layers[prefix].get(code)
            if not path:
                continue
            count, named, center = summary(path)
            key = {'LSMD_SOCHUN': 'sochun', 'TN_RIVER_BNDRY': 'boundary', 'TN_RIVER_BT': 'realwidth'}[prefix]
            row[f'{key}_count'] = count
            if prefix == 'LSMD_SOCHUN':
                row['sochun_named'] = named
            if row['center'] is None:
                row['center'] = center
        rows.append(row)

    if unknown:
        # 이름을 못 붙이면 선택기에 표시할 수 없다. 조용히 넘기지 않는다.
        print(f'  주의 코드표에 없는 시군구코드 {len(unknown)}개: {unknown}')

    OUT.write_text(json.dumps({
        'dataset': 'river_region_catalog',
        'built_by': 'scripts/build_river_region_catalog.py',
        'note': ('지도 지역 선택기가 쓰는 목록이다. 하천 자료가 하나라도 있는 시군구만 담는다. '
                 'center 는 형상 bbox 중심이라 자료가 가진 좌표가 아니며 화면 이동 전용이다.'),
        'regions': sorted(rows, key=lambda r: (r['sido'] or '', r['sgg'] or '', r['code'])),
    }, ensure_ascii=False, indent=1), encoding='utf-8')
    with_sochun = sum(1 for r in rows if r.get('sochun_count'))
    print(f'{OUT.name}: 시군구 {len(rows)} (소하천구역 보유 {with_sochun}) · {OUT.stat().st_size / 1024:,.0f} KB')
    return 1 if unknown else 0


if __name__ == '__main__':
    raise SystemExit(main())
