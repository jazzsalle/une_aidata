"""소하천구역(연속주제) SHP 에서 대상 6개 지역만 잘라 EPSG:4326 GeoJSON 으로 반입한다.

    입력  GIS_data/소하천_소하천구역(연속주제)+브이월드/LSMD_CONT_UJ301_{시도}.zip
    출력  apps/web/public/reference/rivers/LSMD_SOCHUN_{시군구코드}.geojson  (전국 188개)
          apps/web/public/reference/rivers/river_region_catalog.json      (지역 선택기용 목록)

**전국 시군구 단위로 낸다.** 파일명의 코드는 원자료 `COL_ADM_SE`(현행 행정표준코드)이고,
지도는 고른 시군구 파일 하나만 받는다(중앙값 424 KB · 최대 3.6 MB). 대상지역 6곳만 반입하던
때와 달리 시드가 없는 시군구도 하천은 볼 수 있다.

원자료는 국토교통부 연속지적 계열 배포본이고 좌표계는 **EPSG:5186(Korea 2000 / Central Belt 2010)**
이다. 같은 폴더의 `_5174_` 파일은 구 측지계(Korean 1985)라 쓰지 않는다 — 데이텀 변환이 한 단계
더 붙고 그만큼 어긋날 여지가 생긴다. 실측으로 5186 가정을 확인했다(기장 129.222/35.272,
의왕 126.956/37.317, 구미 128.175/36.255, 남원 127.419/35.435, 인제 128.287/38.040).

**이름을 만들어내지 않는다.** 원자료에는 소하천명 전용 필드가 없고 `ALIAS`(별칭)·`REMARK`(비고)
자유기술에 섞여 온다. 전국 116,758 폴리곤 기준으로 이름이 `REMARK` 에만 있는 것이 62.4%,
둘 다 4.1%+29.0%, 어디에도 없는 것이 4.5% 다 — `ALIAS` 는 '소하천예정지' 47,768건처럼 일반값이
대부분이라 그것만 보면 3분의 2를 잃는다. 그래서 `ALIAS` 를 먼저 보고 실패하면 `REMARK` 를 본다.
아래 규칙으로 실제 하천명이 읽히는 경우에만 `stream_name` 을 붙이고, 나머지는 붙이지 않는다.
원문은 `alias_raw`·`remark_raw` 로 항상 남긴다.
"""
from __future__ import annotations

import io
import json
import re
import sys
import zipfile
from pathlib import Path

import numpy as np
import pyproj
import shapefile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_river_web_layers import rdp  # noqa: E402  단순화 알고리즘은 국가기본도 반입과 같은 것을 쓴다.
from river_regions import REGIONS  # noqa: E402  대상지역 6곳은 중심좌표 표기에만 쓴다.

from source_data import REPO, SOCHUN_ZONE_DIR, require  # noqa: E402

SRC_DIR = SOCHUN_ZONE_DIR
DEST = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'

SRC_CRS = 'EPSG:5186'
EXPECTED_PRJ = ('Korea 2000', 'Central Belt 2010')
TO4326 = pyproj.Transformer.from_crs(SRC_CRS, 'EPSG:4326', always_xy=True).transform

PRECISION = 6
TOLERANCE_M = 2.0

# `ALIAS`/`REMARK` 에서 하천명이 아닌 부분. 이 낱말만 남으면 이름이 없는 것으로 본다.
GENERIC = ('소하천구역', '소하천예정지', '소하천', '구역', '예정지')
# '천'으로 끝나지만 하천명이 아닌 값. 폐천 계열을 그대로 두면 포천시 '기존폐천' 1,383건처럼
# 서로 다른 구역이 하천 하나로 뭉쳐 보인다. NDMS 소하천 전체 목록에 같은 이름이 등재돼 있지
# 않은 것만 넣는다 — '구하천'은 전북 완주군·남원시에 실제로 등재된 하천명이라 넣지 않는다.
BLOCK = frozenset({'하천', '폐천', '기존폐천', '신생폐천', '소하천'})
# 인제는 '3-01 소재골천 소하천구역' 처럼 고시번호 + 하천명 + 구분 형태로 들어온다.
NOTICE_NO = re.compile(r'^\s*\d+\s*-\s*\d+\s*')
# '운수천(001-2)' 처럼 하천명 뒤에 붙는 고시 일련번호.
SERIAL_IN_PAREN = re.compile(r'\(\s*\d{1,4}(?:-\d{1,4})?\s*\)')
# '큰터골천 예정지03' 의 뒤쪽.
PLANNED_SUFFIX = re.compile(r'예정지\s*\d*')
# 소하천명은 '…천'(드물게 '…강')으로 끝난다.
NAME_SHAPE = re.compile(r'[가-힣A-Za-z0-9]{1,12}(?:천|강|川)')
# '웅곡천_무을면', '소하천(운수천)' 처럼 구분자로 이어 붙여 오는 경우가 많다.
SPLIT = re.compile(r'[()\[\]_/,\s]+')


def stream_name_of(alias: str) -> str:
    """원문에서 실제 하천명이 읽힐 때만 돌려준다. 못 읽으면 빈 문자열이며 추정하지 않는다.

    원문은 '웅곡천_무을면', '운수천(001-2)', '소하천(운수천)', '골말1천_소하천예정지' 처럼
    하천명 앞뒤로 고시번호·행정구역·구분이 붙어 온다. 붙어 있는 것을 떼어낼 뿐 없는 이름을
    만들지 않는다 — 떼어낸 뒤에도 하천명 형태가 아니면 빈 문자열이다.
    """
    text = SERIAL_IN_PAREN.sub(' ', (alias or '').strip())
    text = NOTICE_NO.sub('', text)
    text = PLANNED_SUFFIX.sub(' ', text)
    text = text.replace('소하천정비법_', ' ')
    candidates = [
        part for part in SPLIT.split(text)
        if part and part not in GENERIC and part not in BLOCK and NAME_SHAPE.fullmatch(part)
    ]
    if candidates:
        # '소하천(운수천)' 처럼 조각이 여럿 남으면 가장 긴 것이 하천명이다.
        return max(candidates, key=len)
    found = NAME_SHAPE.search(text)
    if found and found.group(0) not in GENERIC and found.group(0) not in BLOCK:
        return found.group(0)
    return ''


def read_shapefile(province: str):
    path = require(SRC_DIR / f'LSMD_CONT_UJ301_{province}.zip', f'소하천구역 {province}')
    archive = zipfile.ZipFile(path)
    member: dict[str, str] = {}
    for info in archive.infolist():
        # zip 헤더의 한글 파일명은 cp437 로 잘못 적혀 오는 경우가 많다. 확장자만 알면 되므로 복원해 둔다.
        try:
            name = info.filename.encode('cp437').decode('cp949')
        except Exception:
            name = info.filename
        member[Path(name).suffix.lower()] = info.filename
    prj = archive.read(member['.prj']).decode('utf-8', 'replace')
    if not all(token in prj for token in EXPECTED_PRJ):
        raise ValueError(f'{path.name} 의 좌표계가 {SRC_CRS} 가정과 다르다: {prj[:120]}')
    return shapefile.Reader(
        shp=io.BytesIO(archive.read(member['.shp'])),
        dbf=io.BytesIO(archive.read(member['.dbf'])),
        shx=io.BytesIO(archive.read(member['.shx'])),
        encoding='cp949',
    )


def rings_of(shape):
    """pyshp 의 parts 를 링 단위로 자른다. 폴리곤 1건이 여러 링(외곽+구멍·다중부)을 갖는다."""
    points = shape.points
    bounds = list(shape.parts) + [len(points)]
    return [points[bounds[i]:bounds[i + 1]] for i in range(len(shape.parts))]


def simplify_ring(ring):
    arr = np.array(ring, dtype=float)
    if len(arr) < 4:
        simplified = arr
    else:
        # 원자료가 이미 미터 좌표계라 그대로 허용오차를 미터로 준다(재투영 왕복이 없다).
        simplified = rdp(arr, TOLERANCE_M)
        if len(simplified) < 4:
            simplified = arr
    lon, lat = TO4326(simplified[:, 0], simplified[:, 1])
    out = [[round(float(a), PRECISION), round(float(b), PRECISION)] for a, b in zip(lon, lat)]
    if out[0] != out[-1]:
        out.append(out[0])
    return out if len(out) >= 4 else None


def signed_area(ring) -> float:
    arr = np.array(ring, dtype=float)
    x, y = arr[:, 0], arr[:, 1]
    return float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))) / 2


def build_geometry(shape):
    """외곽링 부호로 폴리곤을 나눈다(shapefile 규약: 외곽 시계방향, 구멍 반시계방향)."""
    polygons: list[list] = []
    for ring in rings_of(shape):
        simplified = simplify_ring(ring)
        if not simplified:
            continue
        if signed_area(ring) < 0 or not polygons:
            polygons.append([simplified])
        else:
            polygons[-1].append(simplified)
    if not polygons:
        return None
    if len(polygons) == 1:
        return {'type': 'Polygon', 'coordinates': polygons[0]}
    return {'type': 'MultiPolygon', 'coordinates': polygons}


def sgg_names() -> dict:
    """시군구코드 → (시도, 시군구). data/reference/sgg_code_map.json 이 정본이다."""
    path = REPO / 'data' / 'reference' / 'sgg_code_map.json'
    payload = json.loads(require(path, '시군구 코드표').read_text(encoding='utf-8'))
    names: dict = {}
    for entry in payload['entries']:
        for code in entry['codes']:
            # 한 코드가 여러 시군구에 걸리는 일은 없다(코드표가 그렇게 만들어졌다).
            names.setdefault(code, (entry['sido'], entry['sgg']))
    return names


def feature_of(record, index: int, code: str):
    """폴리곤 1건 → GeoJSON Feature. 이름을 못 읽으면 붙이지 않는다(지어내지 않는다)."""
    geometry = build_geometry(record.shape)
    if not geometry:
        return None, False
    alias = (record.record['ALIAS'] or '').strip()
    remark = (record.record['REMARK'] or '').strip()
    mnum = (record.record['MNUM'] or '').strip()
    props = {
        'MNUM': mnum,
        'admin_code': code,
        'sgg_code': code,
        'source_layer': 'LSMD_CONT_UJ301',
        'semantic': 'sochun',
    }
    name = stream_name_of(alias) or stream_name_of(remark)
    if name:
        props['stream_name'] = name
    if alias:
        props['alias_raw'] = alias
    if remark and remark != alias:
        props['remark_raw'] = remark
    notice = (record.record['NTFDATE'] or '').strip()
    if len(notice) == 8 and notice.isdigit():
        props['notified_on'] = f'{notice[:4]}-{notice[4:6]}-{notice[6:]}'
    return {
        'type': 'Feature',
        'id': f'SOCHUN:{code}:{mnum or index}',
        'properties': props,
        'geometry': geometry,
    }, bool(name)


def bbox_center(features) -> tuple | None:
    lons: list[float] = []
    lats: list[float] = []
    for feature in features:
        geometry = feature['geometry']
        rings = (geometry['coordinates'] if geometry['type'] == 'Polygon'
                 else [r for poly in geometry['coordinates'] for r in poly])
        for ring in rings:
            for lon, lat in ring:
                lons.append(lon)
                lats.append(lat)
    if not lons:
        return None
    return (round((min(lons) + max(lons)) / 2, 6), round((min(lats) + max(lats)) / 2, 6))


def build_province(province: str, names: dict) -> list[dict]:
    """시도 zip 하나를 읽어 시군구별 파일로 가른다."""
    reader = read_shapefile(province)
    grouped: dict = {}
    named: dict = {}
    for index, record in enumerate(reader.iterShapeRecords()):
        code = (record.record['COL_ADM_SE'] or '').strip()
        if not code:
            continue
        feature, has_name = feature_of(record, index, code)
        if feature is None:
            continue
        grouped.setdefault(code, []).append(feature)
        named[code] = named.get(code, 0) + (1 if has_name else 0)

    DEST.mkdir(parents=True, exist_ok=True)
    rows = []
    for code, features in sorted(grouped.items()):
        out = DEST / f'LSMD_SOCHUN_{code}.geojson'
        out.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                                  ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        sido, sgg = names.get(code, (None, None))
        rows.append({
            'code': code,
            'sido': sido,
            'sgg': sgg,
            'sochun_count': len(features),
            'sochun_named': named.get(code, 0),
            'center': bbox_center(features),
            'size_kb': round(out.stat().st_size / 1024),
        })
    total = sum(r['sochun_count'] for r in rows)
    print(f'  {province:12s} 시군구 {len(rows):3d} · 폴리곤 {total:7,} · '
          f'{sum(r["size_kb"] for r in rows) / 1024:6.1f} MB')
    return rows


def main() -> int:
    only = set(sys.argv[1:])
    print(f'소하천구역 전국 반입 · {SRC_CRS} → EPSG:4326 · 단순화 {TOLERANCE_M} m · 좌표 {PRECISION}자리')
    names = sgg_names()
    provinces = sorted({region.province_file for region in REGIONS} |
                       {path.stem[len('LSMD_CONT_UJ301_'):] for path in SRC_DIR.glob('LSMD_CONT_UJ301_*.zip')
                        if not path.stem[len('LSMD_CONT_UJ301_'):].startswith('5174_')})
    rows: list[dict] = []
    for province in provinces:
        if only and province not in only:
            continue
        rows.extend(build_province(province, names))

    unknown = [r for r in rows if not r['sgg']]
    if unknown:
        # 코드표에 없는 시군구코드는 화면에 이름을 못 붙인다. 조용히 넘기지 않는다.
        print(f'  주의 코드표에 없는 시군구코드 {len(unknown)}개: {[r["code"] for r in unknown]}')

    catalog = DEST / 'river_region_catalog.json'
    catalog.write_text(json.dumps({
        'dataset': 'river_region_catalog',
        'built_by': 'scripts/build_sochun_layers.py',
        'note': ('지도 지역 선택기가 쓰는 목록이다. 소하천구역 자료가 있는 시군구만 담는다. '
                 'center 는 형상 bbox 중심이라 자료가 가진 좌표가 아니며 화면 이동 전용이다.'),
        'regions': sorted(rows, key=lambda r: (r['sido'] or '', r['sgg'] or '', r['code'])),
    }, ensure_ascii=False, indent=1), encoding='utf-8')

    total = sum(r['sochun_count'] for r in rows)
    named = sum(r['sochun_named'] for r in rows)
    size = sum(r['size_kb'] for r in rows) / 1024
    print(f'\n시군구 {len(rows)}개 · 폴리곤 {total:,} · 하천명 {named:,} ({named / max(1, total) * 100:.1f}%) · {size:,.0f} MB')
    print(f'{catalog.name}: {catalog.stat().st_size / 1024:,.0f} KB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
