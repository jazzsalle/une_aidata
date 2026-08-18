"""하천망도에서 국가하천·지방하천을 반입한다. 국가/지방하천의 정본 자료다.

    입력  GIS_data/(하천명 확인용) 국가하천_지방하천 하천망도(국가수자원관리종합시스템)/
            ntn_rvr/00.하천망도_국가.shp   (국가하천 73)
            lcl_rvr/00.하천망도_지방.shp   (지방하천 3,783)
    출력  apps/web/public/reference/rivers/RIVER_NETWORK_NATIONAL.geojson
          apps/web/public/reference/rivers/RIVER_NETWORK_LOCAL.geojson

전에 쓰던 전국하천표준데이터(공공데이터포털)는 지자체가 등록한 만큼만 담겨 있어 국가하천 33 ·
지방하천 672건뿐이었다. 이 자료는 **국가하천 73 · 지방하천 3,783** 으로 실제 전국 하천 수와 맞고,
`RIVCD_2`(하천코드)가 전부 고유해 식별자로 쓸 수 있다. 하천명은 중복이 있으므로(대곡천 13곳,
금산천 11곳) **이름이 아니라 코드로 가른다.**

시군구로 자르지 않고 **전국 한 파일씩** 낸다. 하천 하나가 여러 시군구에 걸쳐 있어 자르려면
형상을 잘라야 하는데, 그러면 원자료에 없는 경계선을 만들게 된다. 2 m 단순화 후 용량이
국가 1.3 MB · 지방 6.4 MB 라 나눌 이유도 없다.

좌표계는 EPSG:5179(Korea 2000 / Korea Unified). 소하천구역(5186)·국가기본도(5179)와 계보가
다르므로 `.prj` 를 확인하고 다르면 멈춘다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pyproj
import shapefile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_river_web_layers import rdp  # noqa: E402  단순화는 다른 하천자료와 같은 것을 쓴다.
from build_sochun_layers import PRECISION, TOLERANCE_M, rings_of, signed_area  # noqa: E402
from source_data import REPO, RIVER_NETWORK_LOCAL, RIVER_NETWORK_NATIONAL, require  # noqa: E402

DEST = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'

SRC_CRS = 'EPSG:5179'
EXPECTED_PRJ = ('Korea_2000_Korea_Unified_Coordinate_System',)
TO4326 = pyproj.Transformer.from_crs(SRC_CRS, 'EPSG:4326', always_xy=True).transform

LAYERS = (
    # (파일명, 원자료, 등급표기, CLAS2 원문)
    ('RIVER_NETWORK_NATIONAL', RIVER_NETWORK_NATIONAL, '국가하천', '국가'),
    ('RIVER_NETWORK_LOCAL', RIVER_NETWORK_LOCAL, '지방하천', '지방'),
)


def read_shapefile(stem: Path):
    """pyshp 는 경로에 '.' 이 있으면 확장자로 잘라 버린다('00.하천망도_국가'). 파일을 직접 연다."""
    for suffix in ('.shp', '.dbf', '.shx', '.prj'):
        require(Path(str(stem) + suffix), f'하천망도 {stem.name}{suffix}')
    prj = Path(str(stem) + '.prj').read_text(encoding='utf-8', errors='replace')
    if not all(token in prj for token in EXPECTED_PRJ):
        raise ValueError(f'{stem.name} 의 좌표계가 {SRC_CRS} 가정과 다르다: {prj[:120]}')
    return shapefile.Reader(
        shp=open(str(stem) + '.shp', 'rb'),
        dbf=open(str(stem) + '.dbf', 'rb'),
        shx=open(str(stem) + '.shx', 'rb'),
        encoding='utf-8',  # .cpg 가 UTF-8 이다(소하천구역의 cp949 와 다르다)
    )


def simplify_ring(ring):
    arr = np.array(ring, dtype=float)
    simplified = arr if len(arr) < 4 else rdp(arr, TOLERANCE_M)
    if len(simplified) < 4:
        simplified = arr
    lon, lat = TO4326(simplified[:, 0], simplified[:, 1])
    out = [[round(float(a), PRECISION), round(float(b), PRECISION)] for a, b in zip(lon, lat)]
    if out[0] != out[-1]:
        out.append(out[0])
    return out if len(out) >= 4 else None


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


def build(name: str, stem: Path, river_class: str, clas2: str) -> dict:
    reader = read_shapefile(stem)
    features = []
    codes: set[str] = set()
    for record in reader.iterShapeRecords():
        fields = record.record.as_dict()
        if (fields.get('CLAS2') or '').strip() != clas2:
            raise ValueError(f'{stem.name}: CLAS2 가 {clas2} 가 아닌 레코드가 있다 ({fields.get("CLAS2")})')
        geometry = build_geometry(record.shape)
        if not geometry:
            continue
        code = str(fields.get('RIVCD_2') or '').strip()
        codes.add(code)
        features.append({
            'type': 'Feature',
            'id': f'RIVERNET:{code}',
            'properties': {
                'river_code': code,
                'river_name': (fields.get('RIVNM_2') or '').strip(),
                'river_class': river_class,
                'source_layer': name,
                'semantic': 'network',
            },
            'geometry': geometry,
        })
    if len(codes) != len(features):
        raise ValueError(f'{stem.name}: 하천코드가 유일하지 않다 ({len(codes)} != {len(features)}).')

    out = DEST / f'{name}.geojson'
    DEST.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                              ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    named = sum(1 for f in features if f['properties']['river_name'])
    print(f'  {out.name}: {len(features):,}건 · 하천명 {named:,}건 · {out.stat().st_size / 1048576:.2f} MB')
    return {'name': name, 'count': len(features), 'named': named}


def main() -> int:
    print(f'하천망도 반입 · {SRC_CRS} → EPSG:4326 · 단순화 {TOLERANCE_M} m · 좌표 {PRECISION}자리')
    results = [build(*layer) for layer in LAYERS]
    total = sum(r['count'] for r in results)
    if any(r['count'] != r['named'] for r in results):
        # 하천명이 비면 검색으로 찾아갈 수 없다. 원자료가 그렇다면 사실대로 남기되 눈에 띄게 알린다.
        for r in results:
            if r['count'] != r['named']:
                print(f"  주의 {r['name']}: 하천명이 빈 레코드 {r['count'] - r['named']}건")
    print(f'PASS 하천망도: 국가·지방하천 {total:,}건')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
