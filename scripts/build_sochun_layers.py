"""소하천구역(연속주제) SHP 에서 대상 6개 지역만 잘라 EPSG:4326 GeoJSON 으로 반입한다.

    입력  소하천_소하천구역(연속주제)+브이월드/LSMD_CONT_UJ301_{시도}.zip
    출력  apps/web/public/reference/rivers/LSMD_SOCHUN_{admin}.geojson

원자료는 국토교통부 연속지적 계열 배포본이고 좌표계는 **EPSG:5186(Korea 2000 / Central Belt 2010)**
이다. 같은 폴더의 `_5174_` 파일은 구 측지계(Korean 1985)라 쓰지 않는다 — 데이텀 변환이 한 단계
더 붙고 그만큼 어긋날 여지가 생긴다. 실측으로 5186 가정을 확인했다(기장 129.222/35.272,
의왕 126.956/37.317, 구미 128.175/36.255, 남원 127.419/35.435, 인제 128.287/38.040).

**이름을 만들어내지 않는다.** `ALIAS` 는 지자체마다 품질이 달라서, 영천·인제는 실제 소하천명이
들어 있지만 남원·구미·의왕·부산은 대부분 '소하천구역' 같은 일반값이다. 아래 규칙으로 실제 하천명이
읽히는 경우에만 `stream_name` 을 붙이고, 나머지는 붙이지 않는다. 원문은 `alias_raw` 로 항상 남긴다.
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
from river_regions import REGIONS, matches_sgg  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
SRC_DIR = REPO / '소하천_소하천구역(연속주제)+브이월드'
DEST = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'

SRC_CRS = 'EPSG:5186'
EXPECTED_PRJ = ('Korea 2000', 'Central Belt 2010')
TO4326 = pyproj.Transformer.from_crs(SRC_CRS, 'EPSG:4326', always_xy=True).transform

PRECISION = 6
TOLERANCE_M = 2.0

# `ALIAS`/`REMARK` 에서 하천명이 아닌 부분. 이 낱말만 남으면 이름이 없는 것으로 본다.
GENERIC = ('소하천구역', '소하천예정지', '소하천', '구역', '예정지')
# 인제는 '3-01 소재골천 소하천구역' 처럼 고시번호 + 하천명 + 구분 형태로 들어온다.
NOTICE_NO = re.compile(r'^\s*\d+\s*-\s*\d+\s*')


def stream_name_of(alias: str) -> str:
    """원문에서 실제 하천명이 읽힐 때만 돌려준다. 못 읽으면 빈 문자열이며 추정하지 않는다."""
    text = NOTICE_NO.sub('', (alias or '').strip())
    for word in GENERIC:
        text = text.replace(word, ' ')
    text = ' '.join(text.split())
    # 소하천명은 '…천'으로 끝난다. 그 형태가 아니면 이름으로 인정하지 않는다.
    return text if text.endswith('천') and len(text) >= 2 else ''


def read_shapefile(province: str):
    path = SRC_DIR / f'LSMD_CONT_UJ301_{province}.zip'
    if not path.exists():
        raise FileNotFoundError(f'{path} 가 없다. 소하천 원자료 폴더를 확인하라.')
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


def build(region) -> dict:
    reader = read_shapefile(region.province_file)
    features = []
    named = 0
    lons: list[float] = []
    lats: list[float] = []
    for index, record in enumerate(reader.iterShapeRecords()):
        if not matches_sgg(region, record.record['COL_ADM_SE']):
            continue
        geometry = build_geometry(record.shape)
        if not geometry:
            continue
        alias = (record.record['ALIAS'] or '').strip()
        remark = (record.record['REMARK'] or '').strip()
        mnum = (record.record['MNUM'] or '').strip()
        props = {
            'MNUM': mnum,
            'admin_code': region.admin,
            'sgg_code': (record.record['COL_ADM_SE'] or '').strip(),
            'source_layer': 'LSMD_CONT_UJ301',
            'semantic': 'sochun-zone',
        }
        name = stream_name_of(alias) or stream_name_of(remark)
        if name:
            props['stream_name'] = name
            named += 1
        if alias:
            props['alias_raw'] = alias
        if remark and remark != alias:
            props['remark_raw'] = remark
        notice = (record.record['NTFDATE'] or '').strip()
        if len(notice) == 8 and notice.isdigit():
            props['notified_on'] = f'{notice[:4]}-{notice[4:6]}-{notice[6:]}'
        for ring in geometry['coordinates'] if geometry['type'] == 'Polygon' else [r for poly in geometry['coordinates'] for r in poly]:
            for lon, lat in ring:
                lons.append(lon)
                lats.append(lat)
        features.append({
            'type': 'Feature',
            'id': f'SOCHUN:{region.admin}:{mnum or index}',
            'properties': props,
            'geometry': geometry,
        })

    DEST.mkdir(parents=True, exist_ok=True)
    out = DEST / f'LSMD_SOCHUN_{region.admin}.geojson'
    out.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                              ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    center = ((min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2) if lons else None
    print(f'  {out.name}: {len(features):,}건 · 하천명 판독 {named:,}건 · {out.stat().st_size // 1024:,} KB'
          + (f' · bbox중심 ({center[0]:.3f}, {center[1]:.3f})' if center else ''))
    return {'admin': region.admin, 'count': len(features), 'named': named, 'center': center}


def main() -> int:
    only = set(sys.argv[1:])
    print(f'소하천구역 반입 · {SRC_CRS} → EPSG:4326 · 단순화 {TOLERANCE_M} m · 좌표 {PRECISION}자리')
    for region in REGIONS:
        if only and region.admin not in only:
            continue
        print(f'{region.name} ({region.admin})')
        build(region)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
