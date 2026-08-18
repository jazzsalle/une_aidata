"""반입한 하천 참조자료(소하천구역·하천표준데이터 지점·검색 색인)를 검증한다.

전처리 산출물이 프런트 계약과 어긋난 채로 배포되는 것을 막는 게이트다. 확인하는 것:

  1. 대상 6개 지역마다 소하천구역·하천표준지점 파일이 있고 유효한 FeatureCollection 인가
  2. 좌표가 EPSG:4326 한반도 범위 안인가 (재투영 실수는 이 검사에서 잡힌다)
  3. 하천표준지점이 `official_data`·`value_status=actual`·Provider·기준일을 갖고 있는가
  4. 검색 색인의 `nav_kind` 와 `nav` 유무가 서로 맞는가
  5. 소하천 `stream_name` 이 '소하천구역' 같은 일반값으로 채워져 있지 않은가

**건수를 고정값으로 검사하지 않는다.** 원자료가 갱신되면 건수는 정당하게 바뀐다. 0건인 것은
지역에 따라 정상이므로(구미·인제는 하천표준데이터 레코드가 아예 없다) 실패로 보지 않는다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from river_regions import REGIONS  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
DIR = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'

KOREA_BBOX = (124.0, 33.0, 132.0, 39.0)
# stream_name 으로 새면 안 되는 값. 앞의 5개는 구분 라벨이고, 뒤의 4개는 '천'으로 끝나지만
# 하천명이 아닌 폐천 계열이다(포천시 '기존폐천' 1,383건 등). NDMS 소하천 전체 목록에 등재되지
# 않은 것만 넣는다 — scripts/build_sochun_layers.py 의 GENERIC + BLOCK 과 같은 뜻이며,
# 게이트는 검사 대상 모듈을 import 하지 않으므로 여기에 따로 적는다.
GENERIC_NAMES = {
    '소하천구역', '소하천예정지', '소하천', '구역', '예정지',
    '하천', '폐천', '기존폐천', '신생폐천',
}
failures: list[str] = []


def fail(message: str) -> None:
    failures.append(message)


def each_coordinate(geometry):
    stack = [geometry['coordinates']]
    while stack:
        item = stack.pop()
        if item and isinstance(item[0], (int, float)):
            yield item
        else:
            stack.extend(item)


def check_collection(path: Path, expect_types: set[str]) -> list[dict]:
    if not path.exists():
        fail(f'{path.name}: 파일이 없다. npm run data:rivers 로 재생성하라.')
        return []
    payload = json.loads(path.read_text(encoding='utf-8'))
    if payload.get('type') != 'FeatureCollection':
        fail(f'{path.name}: FeatureCollection 이 아니다.')
        return []
    features = payload.get('features', [])
    for feature in features:
        geometry = feature.get('geometry') or {}
        if geometry.get('type') not in expect_types:
            fail(f'{path.name}: 예상 밖 geometry {geometry.get("type")} (기대 {sorted(expect_types)})')
            break
        for lon, lat in each_coordinate(geometry):
            if not (KOREA_BBOX[0] <= lon <= KOREA_BBOX[2] and KOREA_BBOX[1] <= lat <= KOREA_BBOX[3]):
                fail(f'{path.name}: 좌표가 한반도 범위 밖이다 ({lon}, {lat}) — 재투영을 확인하라.')
                break
        else:
            continue
        break
    return features


def main() -> int:
    for region in REGIONS:
        sochun = check_collection(DIR / f'LSMD_SOCHUN_{region.admin}.geojson', {'Polygon', 'MultiPolygon'})
        for feature in sochun:
            props = feature['properties']
            if props.get('admin_code') != region.admin:
                fail(f'LSMD_SOCHUN_{region.admin}: admin_code 가 {props.get("admin_code")} 로 어긋난다.')
                break
            name = props.get('stream_name')
            if name and name in GENERIC_NAMES:
                fail(f'LSMD_SOCHUN_{region.admin}: stream_name 에 일반값 "{name}" 이 들어갔다.')
                break

        points = check_collection(DIR / f'RIVER_STD_POINTS_{region.admin}.geojson', {'Point'})
        for feature in points:
            props = feature['properties']
            missing = [key for key in ('name', 'point_role', 'provider', 'reference_date') if not props.get(key)]
            if missing:
                fail(f'RIVER_STD_POINTS_{region.admin}: 필수 속성 누락 {missing} ({feature.get("id")})')
                break
            if props.get('official_data') is not True or props.get('value_status') != 'actual':
                fail(f'RIVER_STD_POINTS_{region.admin}: 실제 연계값 표기가 없다 ({feature.get("id")}). '
                     'official_data=true · value_status=actual 이어야 한다.')
                break

    catalog_path = DIR / 'river_standard_catalog.json'
    if not catalog_path.exists():
        fail('river_standard_catalog.json 이 없다.')
    else:
        catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
        codes = {block['admin_code'] for block in catalog['regions']}
        expected = {region.admin for region in REGIONS}
        if codes != expected:
            fail(f'river_standard_catalog.json: 지역 구성이 다르다 {sorted(codes)} != {sorted(expected)}')
        for block in catalog['regions']:
            for row in block['rivers']:
                if row['has_coordinate'] != bool(row.get('points')):
                    fail(f'river_standard_catalog.json: has_coordinate 와 points 가 어긋난다 ({row.get("name")})')
                    break

    index_path = DIR / 'river_search_index.json'
    if not index_path.exists():
        fail('river_search_index.json 이 없다.')
    else:
        entries = json.loads(index_path.read_text(encoding='utf-8'))['entries']
        admins = {region.admin for region in REGIONS}
        for entry in entries:
            if entry['admin'] not in admins:
                fail(f'river_search_index.json: 대상 외 지역 {entry["admin"]}')
                break
            if (entry['nav'] is None) != (entry['nav_kind'] == 'none'):
                fail(f'river_search_index.json: nav 와 nav_kind 가 어긋난다 ({entry["name"]} · {entry["nav_kind"]})')
                break
            if not entry['name']:
                fail('river_search_index.json: 이름 없는 항목이 있다.')
                break

    if failures:
        print('FAIL: 하천 참조자료 검증')
        for message in failures:
            print(f'  - {message}')
        return 1
    print(f'PASS: 하천 참조자료 검증 (대상 {len(REGIONS)}개 지역)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
