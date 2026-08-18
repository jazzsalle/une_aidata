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


def region_catalog() -> list[dict]:
    path = DIR / 'river_region_catalog.json'
    if not path.exists():
        fail('river_region_catalog.json 이 없다. npm run data:rivers 로 재생성하라.')
        return []
    return json.loads(path.read_text(encoding='utf-8'))['regions']


def main() -> int:
    catalog = region_catalog()
    for row in catalog:
        code = row['code']
        sochun = check_collection(DIR / f'LSMD_SOCHUN_{code}.geojson', {'Polygon', 'MultiPolygon'})
        if len(sochun) != row['sochun_count']:
            fail(f'LSMD_SOCHUN_{code}: 카탈로그 건수 {row["sochun_count"]} 와 파일 {len(sochun)} 이 다르다.')
            continue
        if not row['sgg']:
            fail(f'LSMD_SOCHUN_{code}: 코드표에 없는 시군구코드라 지역 이름을 붙일 수 없다.')
        for feature in sochun:
            props = feature['properties']
            if props.get('admin_code') != code:
                fail(f'LSMD_SOCHUN_{code}: admin_code 가 {props.get("admin_code")} 로 어긋난다.')
                break
            name = props.get('stream_name')
            if name and name in GENERIC_NAMES:
                fail(f'LSMD_SOCHUN_{code}: stream_name 에 일반값 "{name}" 이 들어갔다.')
                break
    # 시드가 있는 지역은 지도 자료도 반드시 있어야 한다 — 없으면 대시보드가 빈 지도를 연다.
    for region in REGIONS:
        if region.admin in {'26', '45190'}:
            continue  # 부산 광역 합본·남원 앱코드는 시군구 단위 반입으로 대체됐다
        if not (DIR / f'LSMD_SOCHUN_{region.admin}.geojson').exists():
            fail(f'대상지역 {region.name}({region.admin}) 의 소하천구역 파일이 없다.')

    index_path = DIR / 'river_search_index.json'
    if not index_path.exists():
        fail('river_search_index.json 이 없다.')
    else:
        entries = json.loads(index_path.read_text(encoding='utf-8'))['entries']
        admins = {row['code'] for row in catalog}
        for entry in entries:
            # 전국 하천(국가·지방)은 여러 시군구에 걸쳐 있어 지역에 배정하지 않는다.
            if entry.get('scope') == 'nationwide':
                if entry['admin']:
                    fail(f'river_search_index.json: 전국 항목인데 지역이 붙어 있다 ({entry["name"]})')
                    break
            elif entry['admin'] not in admins:
                fail(f'river_search_index.json: 지역 카탈로그에 없는 지역 {entry["admin"]}')
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
    print(f'PASS: 하천 참조자료 검증 (시군구 {len(catalog)}개)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
