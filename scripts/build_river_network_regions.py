"""국가·지방하천이 어느 시군구를 지나는지 정해 카탈로그에 적는다.

    입력  GIS_data/(하천명 확인용) 국가하천_지방하천 하천망도(...)/{ntn_rvr,lcl_rvr}/*.shp
          GIS_data/행정구역/행정동_GIS정보/BND_ADM_DONG_PG.shp        (행정동 경계, EPSG:5186)
          GIS_data/행정구역/국가데이터처_법정동 연계정보_20250602.csv  (행정구역코드 → 시군구)
    출력  apps/web/public/reference/rivers/river_network_catalog.json  의 `admin_codes` 갱신

하천 등급별 목록(국가/지방/소하천)을 시군구 단위로 보여주려면 '이 시군구를 지나는 국가·지방하천'
을 알아야 한다. 하천망도에는 행정구역 정보가 없어서 공간판정으로 정한다.

**하천을 자르지 않는다.** 한 하천이 여러 시군구를 지나면 그 시군구를 전부 적는다 — 형상을
자르면 원자료에 없는 경계선을 만들게 되고, 목록에서는 '이 시군구에서 볼 수 있는 하천'이면
충분하다.

판정은 **하천 폴리곤과 행정동 경계가 교차하는가**다(shapely STRtree + intersects). 처음엔 하천
링 정점을 표본으로 찍어 행정동 안에 드는지 봤는데, 한강처럼 법정 하천구역 폴리곤의 정점이 강
한가운데를 따라가는 하천은 강 남안을 짧게 접하는 구(서초·동작·송파)가 빠졌다 — 정점이 그 구
안에 안 떨어진다. 교차 판정으로 바꾸니 한강이 19 → 26 시군구가 됐다. 하천망도는 EPSG:5179,
행정동 경계는 EPSG:5186 이라 하천 폴리곤을 5186 으로 변환해 본다.

행정동 경계의 기준일은 2025-06-30 으로 2026-06-30 개편 이전이다. 그래서 나온 시군구코드를
`data/reference/sgg_code_map.json` 으로 한 번 걸러 현행 코드로 바꾼다 — 그 표가 종전 코드를
현행 시군구의 별칭으로 갖고 있다.
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

import pyproj
import shapefile
from shapely.geometry import MultiPolygon, Polygon, shape as to_shape
from shapely.ops import transform
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from source_data import GIS_DATA, REPO, RIVER_NETWORK_LOCAL, RIVER_NETWORK_NATIONAL, require  # noqa: E402

DONG_SHP = GIS_DATA / '행정구역' / '행정동_GIS정보' / 'BND_ADM_DONG_PG'
LINK_CSV = GIS_DATA / '행정구역' / '국가데이터처_법정동 연계정보_20250602.csv'
CATALOG = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers' / 'river_network_catalog.json'
SGG_MAP = REPO / 'data' / 'reference' / 'sgg_code_map.json'

TO5186 = pyproj.Transformer.from_crs('EPSG:5179', 'EPSG:5186', always_xy=True).transform


def sgg_of_adm_cd() -> dict:
    """행정구역코드(8) → 시군구코드(5). 법정동 연계정보가 두 체계를 잇는다."""
    table: dict = {}
    with require(LINK_CSV, '법정동 연계정보').open(encoding='cp949', newline='') as handle:
        for row in csv.DictReader(handle):
            legal = (row.get('법정동코드') or '').strip()
            if len(legal) == 10 and legal.isdigit():
                table.setdefault((row.get('행정구역코드') or '').strip(), legal[:5])
    return table


def current_code() -> dict:
    """종전 시군구코드 → 현행 시군구코드. 코드표가 종전 코드를 별칭으로 갖고 있다."""
    payload = json.loads(require(SGG_MAP, '시군구 코드표').read_text(encoding='utf-8'))
    table: dict = {}
    for entry in payload['entries']:
        # 대표 코드(구는 시 코드 · 그 밖은 현행 코드). 하천 파일·행정경계와 같은 규칙이어야
        # 고양시(41280)를 골랐을 때 덕양구(41281)로 배정된 한강이 목록에 뜬다.
        for code in entry['codes']:
            table[code] = entry['primary_code']
    return table


def load_dongs(adm_to_sgg: dict):
    """행정동 폴리곤(shapely, EPSG:5186) 과 그 시군구코드. 섬처럼 여러 조각인 행정동은 MultiPolygon."""
    reader = shapefile.Reader(str(require(Path(str(DONG_SHP) + '.shp'), '행정동 경계').with_suffix('')),
                              encoding='cp949')
    geoms = []
    codes = []
    for shape, record in zip(reader.iterShapes(), reader.iterRecords()):
        code = adm_to_sgg.get((record['ADM_CD'] or '').strip())
        if not code:
            continue
        points = shape.points
        bounds = list(shape.parts) + [len(points)]
        polys = [Polygon(points[bounds[i]:bounds[i + 1]]) for i in range(len(shape.parts))
                 if bounds[i + 1] - bounds[i] >= 4]
        if not polys:
            continue
        geom = (MultiPolygon(polys) if len(polys) > 1 else polys[0]).buffer(0)
        geoms.append(geom)
        codes.append(code)
    return geoms, codes


def regions_of(shape, tree: STRtree, codes: list, promote: dict) -> list:
    """하천 폴리곤과 교차하는 행정동의 시군구코드. 형상이 깨진 링은 buffer(0) 으로 고친다."""
    geom = transform(TO5186, to_shape(shape.__geo_interface__)).buffer(0)
    if geom.is_empty:
        return []
    hits = tree.query(geom, predicate='intersects')
    return sorted({promote.get(codes[i], codes[i]) for i in hits})


def read_network(stem: Path):
    for suffix in ('.shp', '.dbf', '.shx'):
        require(Path(str(stem) + suffix), f'하천망도 {stem.name}{suffix}')
    return shapefile.Reader(shp=open(str(stem) + '.shp', 'rb'), dbf=open(str(stem) + '.dbf', 'rb'),
                            shx=open(str(stem) + '.shx', 'rb'), encoding='utf-8')


def main() -> int:
    adm_to_sgg = sgg_of_adm_cd()
    promote = current_code()
    geoms, codes = load_dongs(adm_to_sgg)
    tree = STRtree(geoms)
    print(f'행정동 {len(geoms):,} 폴리곤 · STRtree')

    assigned: dict = {}
    for stem in (RIVER_NETWORK_NATIONAL, RIVER_NETWORK_LOCAL):
        reader = read_network(stem)
        for record in reader.iterShapeRecords():
            code = str(record.record.as_dict().get('RIVCD_2') or '').strip()
            assigned[code] = regions_of(record.shape, tree, codes, promote)
        print(f'  {stem.name}: 누적 {len(assigned):,} 하천')

    payload = json.loads(CATALOG.read_text(encoding='utf-8'))
    missing = 0
    for river in payload['rivers']:
        codes = assigned.get(river['river_code'], [])
        river['admin_codes'] = codes
        if not codes:
            missing += 1
    payload['note'] += (' admin_codes 는 그 하천이 지나는 시군구다 — 하천을 자르지 않고 목록에서만 쓴다.')
    payload['region_assignment'] = {
        'basis': '행정동 경계(BND_ADM_DONG_PG, BASE_DATE 20250630) 와의 교차 판정(intersects)',
        'method': 'shapely STRtree · 하천 폴리곤 ∩ 행정동 폴리곤. 표본점 방식은 강 남안을 짧게 접하는 구를 놓쳤다.',
        'note': '경계 기준일이 2026-06-30 개편 이전이라 결과를 sgg_code_map 으로 현행 코드로 바꿨다.',
        'unassigned': missing,
    }
    CATALOG.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding='utf-8')

    spread: dict = defaultdict(int)
    for river in payload['rivers']:
        spread[len(river['admin_codes'])] += 1
    print(f'\n하천 {len(payload["rivers"]):,} · 시군구 미배정 {missing}')
    print('  지나는 시군구 수 분포:', dict(sorted(spread.items())[:8]))
    print(f'{CATALOG.name}: {CATALOG.stat().st_size / 1024:,.0f} KB')
    return 1 if missing > len(payload['rivers']) * 0.05 else 0


if __name__ == '__main__':
    raise SystemExit(main())
