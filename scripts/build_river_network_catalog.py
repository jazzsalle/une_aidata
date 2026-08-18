"""하천망도에서 국가하천·지방하천의 코드·이름·등급 목록을 만든다. **형상은 반입하지 않는다.**

    입력  GIS_data/(하천명 확인용) 국가하천_지방하천 하천망도(국가수자원관리종합시스템)/
            ntn_rvr/00.하천망도_국가.shp   (국가하천 73)
            lcl_rvr/00.하천망도_지방.shp   (지방하천 3,783)
    출력  apps/web/public/reference/rivers/river_network_catalog.json

형상을 반입하지 않는 이유: 국가·지방하천의 **면 형상은 국가기본도 하천경계·실폭이 이미 갖고
있다.** 하천망도까지 넣으면 같은 하천을 두 벌 그리게 되고 2 m 단순화 기준으로 28.5 MB 가
늘어난다. 하천망도가 유일하게 가진 것은 코드·이름·등급이므로 그것만 가져온다.

형상은 **전처리에서만** 쓴다 — `extract_river_layers.py` 가 이 파일들을 읽어 하천경계·실폭
폴리곤에 등급과 하천명을 공간조인해 붙인다. 국가기본도 3종에는 이름도 코드도 등급도 없다
(필드가 NF_ID·갱신일·측량방법·제작업체뿐이다).

`bbox` 와 `nav` 는 **화면 이동 전용**이다. `nav` 는 bbox 중심이라 자료가 가진 좌표가 아니며
(한강처럼 긴 하천에서는 물길 위가 아닐 수 있다) 화면에 위치값으로 표시하면 안 된다.
목록에서 하천을 고르면 `bbox` 에 맞춰 지도를 움직이는 용도다.

`label_point` 는 **지도에 하천명을 찍을 자리**다. nav 와 달리 그 좌표에 글자가 그려져
'이 하천이 여기다'를 눈으로 주장하므로 bbox 중심을 쓰지 않는다 — 굽은 하천에서는 bbox 중심이
옆 하천 위에 떨어져 **A천 위에 B천 이름이 찍힌다.** 가장 큰 링의 내부점을 계산해 넣는다
(PostGIS·shapely 의 representative_point 와 같은 방식: 무게중심이 안에 있으면 그것,
아니면 무게중심 높이에서 가장 넓은 내부 구간의 중점).

**형상은 반입하지 않는다**의 뜻: 선·면 지오메트리를 클라이언트에 싣지 않는다. 하천당 표기용
파생점 1개는 예외이며 `label_point_kind` 로 파생임을 남긴다.

하천명은 식별자가 아니다. 지방하천 3,783건의 이름이 2,681종뿐이라(대곡천 13곳, 금산천 11곳)
**코드(RIVCD_2)로만 가른다.**
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pyproj
import shapefile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from source_data import REPO, RIVER_NETWORK_LOCAL, RIVER_NETWORK_NATIONAL, require  # noqa: E402

DEST = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'
OUT = DEST / 'river_network_catalog.json'

SRC_CRS = 'EPSG:5179'
EXPECTED_PRJ = ('Korea_2000_Korea_Unified_Coordinate_System',)
TO4326 = pyproj.Transformer.from_crs(SRC_CRS, 'EPSG:4326', always_xy=True).transform
PRECISION = 6

LAYERS = (
    (RIVER_NETWORK_NATIONAL, '국가하천', '국가'),
    (RIVER_NETWORK_LOCAL, '지방하천', '지방'),
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


def ring_area(ring) -> float:
    total = 0.0
    for i in range(len(ring) - 1):
        total += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(total) / 2


def point_in_ring(x: float, y: float, ring) -> bool:
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def interior_point(shape):
    """가장 큰 링 안쪽의 한 점. 라벨을 찍어도 되는 자리다.

    무게중심이 링 안에 있으면 그것을 쓰고, 굽은 하천이라 밖으로 나가면 무게중심 높이에서
    링과 만나는 지점을 모아 **가장 넓은 내부 구간의 중점**을 쓴다. bbox 중심은 쓰지 않는다 —
    옆 하천 위에 이름이 찍힐 수 있다.
    """
    points = shape.points
    bounds = list(shape.parts) + [len(points)]
    rings = [points[bounds[i]:bounds[i + 1]] for i in range(len(shape.parts))]
    ring = max((r for r in rings if len(r) >= 4), key=ring_area, default=None)
    if not ring:
        box = shape.bbox
        return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)

    cx = sum(pt[0] for pt in ring[:-1]) / (len(ring) - 1)
    cy = sum(pt[1] for pt in ring[:-1]) / (len(ring) - 1)
    if point_in_ring(cx, cy, ring):
        return (cx, cy)

    crossings = []
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        if (y1 > cy) != (y2 > cy):
            crossings.append(x1 + (cy - y1) * (x2 - x1) / (y2 - y1))
    crossings.sort()
    best = None
    for i in range(0, len(crossings) - 1, 2):
        span = crossings[i + 1] - crossings[i]
        if best is None or span > best[0]:
            best = (span, (crossings[i] + crossings[i + 1]) / 2)
    if best:
        return (best[1], cy)
    return (cx, cy)


def collect(stem: Path, river_class: str, clas2: str) -> list[dict]:
    reader = read_shapefile(stem)
    rows = []
    for record in reader.iterShapeRecords():
        fields = record.record.as_dict()
        if (fields.get('CLAS2') or '').strip() != clas2:
            raise ValueError(f'{stem.name}: CLAS2 가 {clas2} 가 아닌 레코드가 있다 ({fields.get("CLAS2")})')
        box = record.shape.bbox
        lon1, lat1 = TO4326(box[0], box[1])
        lon2, lat2 = TO4326(box[2], box[3])
        label_x, label_y = interior_point(record.shape)
        label_lon, label_lat = TO4326(label_x, label_y)
        rows.append({
            'river_code': str(fields.get('RIVCD_2') or '').strip(),
            'river_name': (fields.get('RIVNM_2') or '').strip(),
            'river_class': river_class,
            'bbox': [round(lon1, PRECISION), round(lat1, PRECISION),
                     round(lon2, PRECISION), round(lat2, PRECISION)],
            'nav': [round((lon1 + lon2) / 2, PRECISION), round((lat1 + lat2) / 2, PRECISION)],
            'nav_kind': 'extent',
            'label_point': [round(label_lon, PRECISION), round(label_lat, PRECISION)],
            'label_point_kind': 'derived_interior',
        })
    return rows


def main() -> int:
    rows: list[dict] = []
    for stem, river_class, clas2 in LAYERS:
        part = collect(stem, river_class, clas2)
        named = sum(1 for r in part if r['river_name'])
        print(f'  {river_class} {len(part):,}건 · 이름 {named:,}건 · 고유코드 {len({r["river_code"] for r in part}):,}')
        rows.extend(part)

    codes = {r['river_code'] for r in rows}
    if len(codes) != len(rows):
        raise ValueError(f'하천코드가 유일하지 않다 ({len(codes)} != {len(rows)}).')
    nameless = [r for r in rows if not r['river_name']]
    if nameless:
        raise ValueError(f'하천명이 빈 레코드 {len(nameless)}건 — 원자료를 확인하라.')

    DEST.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'dataset': 'river_network_catalog',
        'source': '국가수자원관리종합시스템 하천망도 (국가하천 ntn_rvr · 지방하천 lcl_rvr)',
        'built_by': 'scripts/build_river_network_catalog.py',
        'note': ('형상은 반입하지 않는다 — 국가·지방하천의 면 형상은 국가기본도 하천경계·실폭이 갖고 있고, '
                 '이 파일은 그 폴리곤에 붙일 코드·이름·등급의 정본이다. '
                 '형상 반입 금지는 선·면 지오메트리를 클라이언트에 싣지 않는다는 뜻이며, '
                 '하천당 표기용 파생점 1개(label_point)는 예외로 두고 파생임을 함께 남긴다.'),
        'point_fields': {
            'nav': 'bbox 중심 · 화면 이동 전용 · 자료가 가진 좌표가 아니다',
            'label_point': '가장 큰 링의 내부점 · 지도에 하천명을 찍는 자리 · 파생값(label_point_kind)',
        },
        'key': 'river_code (RIVCD_2). 하천명은 중복이 있어 식별자로 쓰지 않는다.',
        'counts': {'국가하천': sum(1 for r in rows if r['river_class'] == '국가하천'),
                   '지방하천': sum(1 for r in rows if r['river_class'] == '지방하천')},
        'rivers': sorted(rows, key=lambda r: (r['river_class'], r['river_name'], r['river_code'])),
    }, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{OUT.name}: {len(rows):,}건 · {OUT.stat().st_size / 1024:,.0f} KB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
