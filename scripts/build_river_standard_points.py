"""전국하천표준데이터(공공데이터포털 표준데이터셋)를 지도 마커와 검색 목록으로 반입한다.

    입력  전국하천표준데이터/전국하천표준데이터.json
    출력  apps/web/public/reference/rivers/RIVER_STD_POINTS_{admin}.geojson  (마커)
          apps/web/public/reference/rivers/river_standard_catalog.json       (검색·목록)

**이 자료의 위경도는 거의 비어 있다.** 전국 2,558건 중 시점·종점 좌표를 가진 것은 194건뿐이고,
대상 6개 지역으로 좁히면 부산 17건 + 의왕 1건 = 18건이다(남원 352건·영천 25건은 전부 좌표 없음,
구미·인제는 레코드 자체가 없다). 그래서 마커는 **좌표를 실제로 가진 건만** 만든다.

좌표가 없는 건을 지도에서 지우지는 않는다 — 카탈로그에 `has_coordinate: false` 로 남겨 검색·목록에서
계속 보이게 한다. 주소를 지오코딩해 좌표를 만들어 넣지 않는다. 그렇게 하면 실제 관측좌표와 파생좌표가
화면에서 구분되지 않고, `official_data=true` 표기가 사실이 아니게 된다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from river_regions import REGIONS  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / '전국하천표준데이터' / '전국하천표준데이터.json'
DEST = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'

PROVIDER = '공공데이터포털 전국하천표준데이터'
# 마커로 만들 두 지점. 표준데이터는 하천 1건에 시점·종점 좌표를 따로 준다.
ENDPOINTS = (
    ('start', '시점', '시점위치', '시점위치(위도)', '시점위치(경도)'),
    ('end', '종점', '종점위치', '종점위치(위도)', '종점위치(경도)'),
)


def text(record: dict, key: str) -> str:
    return (record.get(key) or '').strip()


def region_of(record: dict):
    """지역 판정. 표준데이터에는 행정코드가 없고 주소·기관명 문자열뿐이다.

    관할기관과 하천 위치가 다를 수 있어(예: 의왕에서 시작하는 하천을 수원시가 제출) 어느 쪽으로
    걸렸는지 `match_basis` 에 남긴다. 화면에서 '왜 이 지역 목록에 있는지'를 설명할 수 있어야 한다.
    """
    for region in REGIONS:
        for keyword in region.match_keywords:
            for field, basis in (('제공기관명', '제공기관'), ('관리기관명', '관리기관'),
                                 ('시점위치', '시점위치'), ('종점위치', '종점위치')):
                if keyword in text(record, field):
                    return region, basis
    return None, ''


def coordinate(record: dict, lat_key: str, lon_key: str):
    lat, lon = text(record, lat_key), text(record, lon_key)
    if not lat or not lon:
        return None
    try:
        values = (round(float(lon), 6), round(float(lat), 6))
    except ValueError:
        return None
    # 한반도 밖 좌표는 자릿수 오류로 본다. 조용히 옮기지 말고 버린다.
    if not (124.0 <= values[0] <= 132.0 and 33.0 <= values[1] <= 39.0):
        return None
    return values


def catalog_row(record: dict, region, basis: str, points: list[dict]) -> dict:
    row = {
        'river_code': text(record, '하천코드'),
        'name': text(record, '하천명'),
        'river_class': text(record, '하천구분명'),
        'admin_code': region.admin,
        'admin_name': region.name,
        'match_basis': basis,
        'start_point': text(record, '시점위치'),
        'end_point': text(record, '종점위치'),
        'has_coordinate': bool(points),
        'provider': PROVIDER,
        'official_data': True,
        'value_status': 'actual',
    }
    for key, field in (('length_km', '하천길이'), ('design_flood_m3s', '하천계획홍수량'),
                       ('design_flood_level_m', '하천계획홍수위'), ('design_width_m', '하천계획하폭')):
        value = text(record, field)
        if value:
            row[key] = value
    for key, field in (('tributary_1', '제1지류명'), ('tributary_2', '제2지류명'),
                       ('management_org', '관리기관명'), ('supply_org', '제공기관명'),
                       ('reference_date', '데이터기준일자'), ('designation_basis', '하천지정근거명')):
        value = text(record, field)
        if value:
            row[key] = value
    if points:
        row['points'] = [{'role': point['properties']['point_role'],
                          'lon': point['geometry']['coordinates'][0],
                          'lat': point['geometry']['coordinates'][1]} for point in points]
    return row


def main() -> int:
    records = json.loads(SRC.read_text(encoding='utf-8-sig'))['records']
    by_region: dict[str, list[dict]] = {region.admin: [] for region in REGIONS}
    catalog: dict[str, list[dict]] = {region.admin: [] for region in REGIONS}

    for record in records:
        region, basis = region_of(record)
        if region is None:
            continue
        points = []
        for role, role_label, location_key, lat_key, lon_key in ENDPOINTS:
            position = coordinate(record, lat_key, lon_key)
            if not position:
                continue
            code = text(record, '하천코드')
            props = {
                'river_code': code,
                'name': text(record, '하천명'),
                'river_class': text(record, '하천구분명'),
                'point_role': role_label,
                'location': text(record, location_key),
                'admin_code': region.admin,
                'admin_name': region.name,
                'source_layer': 'RIVER_STANDARD',
                'semantic': 'river-standard-point',
                'provider': PROVIDER,
                'official_data': True,
                'value_status': 'actual',
            }
            for key, field in (('length_km', '하천길이'), ('management_org', '관리기관명'),
                               ('supply_org', '제공기관명'), ('reference_date', '데이터기준일자')):
                value = text(record, field)
                if value:
                    props[key] = value
            points.append({
                'type': 'Feature',
                'id': f'RIVERSTD:{region.admin}:{code}:{role}',
                'properties': props,
                'geometry': {'type': 'Point', 'coordinates': list(position)},
            })
        by_region[region.admin].extend(points)
        catalog[region.admin].append(catalog_row(record, region, basis, points))

    DEST.mkdir(parents=True, exist_ok=True)
    total_points = 0
    for region in REGIONS:
        features = by_region[region.admin]
        total_points += len(features)
        out = DEST / f'RIVER_STD_POINTS_{region.admin}.geojson'
        out.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                                  ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        rows = catalog[region.admin]
        with_coord = sum(1 for row in rows if row['has_coordinate'])
        print(f'  {region.name} ({region.admin}): 표준데이터 {len(rows):,}건 · 좌표보유 {with_coord:,}건 '
              f'· 마커 {len(features):,}개')

    catalog_path = DEST / 'river_standard_catalog.json'
    catalog_path.write_text(json.dumps({
        'dataset': 'river_standard_catalog',
        'provider': PROVIDER,
        'source_file': SRC.name,
        'note': '위경도는 원자료가 보유한 건만 있다. 좌표 미보유 건은 has_coordinate=false 로 남기며 지오코딩으로 만들어 넣지 않는다.',
        'regions': [{'admin_code': region.admin, 'admin_name': region.name,
                     'rivers': catalog[region.admin]} for region in REGIONS],
    }, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'  river_standard_catalog.json: 총 {sum(len(v) for v in catalog.values()):,}건 '
          f'· 마커 합계 {total_points:,}개 · {catalog_path.stat().st_size // 1024:,} KB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
