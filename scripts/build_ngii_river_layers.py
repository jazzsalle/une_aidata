"""국가기본도 하천경계·실폭을 전국 시군구 단위로 반입한다.

    입력  GIS_data/국가기본도_하천경계/국가기본도_하천경계.zip      TN_RIVER_BNDRY  140,851
          GIS_data/국가기본도_하천실폭/국가기본도 실폭하천.zip       TN_RIVER_BT      28,262
          GIS_data/국가기본도_하천중심선/국가기본도_하천중심선.zip    TN_RIVER_CTLN 3,224,769 (조인 전용)
          GIS_data/행정구역/행정동_GIS정보/BND_ADM_DONG_PG.shp      (시군구 배정용)
    출력  apps/web/public/reference/rivers/TN_RIVER_{BNDRY,BT}_{시군구}.geojson

국가기본도 3종에는 **이름도 코드도 등급도 없다**(필드가 NF_ID·갱신일·측량방법·제작업체뿐).
그래서 두 가지를 공간판정으로 붙인다.

  등급·하천명·하천코드 ← 중심선(RIVER_SE·RIVER_NM·RIVER_NO). 같은 국가기본도에서 나온 짝이라
                        형상이 정확히 대응한다. 하천망도로 조인하면 정확도가 68~78% 로 떨어지고
                        소하천을 지방·국가하천으로 올리는 오판이 난다(docs/32 §7).
  시군구            ← 행정동 경계와의 공간판정. 국가기본도는 EPSG:5179, 행정동은 EPSG:5186 이라
                        행정동 쪽을 한 번만 5179 로 변환해 시군구 union 을 만든다.

시군구 배정은 **교차하는 모든 시군구에 지역 경계로 클리핑해 담는다**(2026-08-22 개정).
이전에는 폴리곤 bbox 중심 1점으로 시군구 하나에만 배정했는데, 실측으로 두 한계가 확인됐다:
경계 하천 폴리곤 159건(0.56%)이 면적 과반이 다른 지역인데 한쪽에만 배정됐고(서낙동강이
김해에 10%만 걸치는데 김해 배정), 한강 실폭은 전국 폴리곤 1개가 고양시에만 배정돼 서울
어느 구에서도 실폭이 안 보였다. 지금은 시군구 경계 안에 통째로 들어가는 폴리곤(대다수)은
그대로, 경계에 걸치는 폴리곤은 교차 시군구마다 잘라 담는다 — "그 지역 화면에 그 지역을
지나는 하천이 전부 보인다"가 보장된다. 표시 목적이므로 잘라도 의미 훼손이 없고 속성은
조각마다 그대로 붙는다.

**중심선 형상은 반입하지 않는다.** 여기서는 속성을 읽어 붙이는 데만 쓴다. 3종 밖인 세류
(RVC005 · 전체의 84.5%)와 기타하천(RVC004)은 색인에 넣지 않는다 — 서비스가 다루는 하천이
아니고, 넣으면 색인이 3배가 된다.

단순화는 소하천구역(2 m)보다 완화한다. 국가기본도 폴리곤이 훨씬 촘촘하고(실폭은 폴리곤당
809 정점) 큰 하천 면이라 시군구 축척에서 10~15 m 차이가 보이지 않는다. 값은
TOLERANCE_BY_LAYER 한 곳에 있다.

메모리 때문에 두 단계로 쓴다. 폴리곤을 읽는 대로 시군구별 JSON Lines 임시파일에 흘려보내고,
다 읽은 뒤 그 파일들을 FeatureCollection 으로 묶는다. 전국 폴리곤을 메모리에 들고 있으면
수 GB 가 된다.
"""
from __future__ import annotations

import io
import json
import shutil
import struct
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pyproj
import shapefile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_river_web_layers import rdp  # noqa: E402  단순화는 다른 하천자료와 같은 것을 쓴다.
from source_data import (  # noqa: E402
    GIS_DATA, NGII_BOUNDARY_ZIP, NGII_REALWIDTH_ZIP, REPO, require,
)

DEST = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'
STAGE = REPO / 'build' / 'river' / 'ngii'

SRC_CRS = 'EPSG:5179'
TO4326 = pyproj.Transformer.from_crs(SRC_CRS, 'EPSG:4326', always_xy=True).transform
TO5186 = pyproj.Transformer.from_crs(SRC_CRS, 'EPSG:5186', always_xy=True).transform

#: 단순화 허용오차는 레이어마다 다르다. 소하천구역은 2 m 인데, 그건 폴리곤이 작아서(대각선
#: 중앙값 99 m) 2 m 를 벗어나면 모양이 무너지기 때문이다. 국가기본도 경계·실폭은 큰 하천 면이라
#: (실폭은 폴리곤당 809 정점) 시군구 축척에서 10~15 m 차이가 보이지 않는다. 5 m 로 뽑아 보니
#: 전국 산출이 약 198 MB 였다 — 그대로 두면 소하천 112 MB 와 합쳐 리포가 310 MB 늘어난다.
TOLERANCE_BY_LAYER = {'TN_RIVER_BNDRY': 10.0, 'TN_RIVER_BT': 15.0}
#: 좌표 5자리는 약 1 m 다. 위 허용오차보다 훨씬 촘촘하므로 6자리를 쓸 이유가 없다.
PRECISION = 5
CELL_M = 300.0
DONG_CELL_M = 3000.0

CENTERLINE_ZIP = GIS_DATA / '국가기본도_하천중심선' / '국가기본도_하천중심선.zip'
DONG_SHP = GIS_DATA / '행정구역' / '행정동_GIS정보' / 'BND_ADM_DONG_PG'
LINK_CSV = GIS_DATA / '행정구역' / '국가데이터처_법정동 연계정보_20250602.csv'
SGG_MAP = REPO / 'data' / 'reference' / 'sgg_code_map.json'

#: 계획문서 제원이 있는 하천. 지도 강조·계획근거 패널이 이 id 로 하천을 가리킨다(rivers.json 정본).
#: 앱 시드코드와 공간자료 코드가 다른 남원만 옮겨 적는다.
PLAN_RIVER_ADMIN = {'45190': '52190'}

RIVER_SE_LABEL = {'RVC001': '국가하천', 'RVC002': '지방하천', 'RVC003': '소하천'}
#: 등급 보정표(하천일람 2024). 중심선(국가기본도)이 승격 이전 등급을 들고 있는 코드 24건 —
#: 안양천·굴포천·태화강 등 2019~ 국가하천 승격분과 구간 코드의 등급 정정. 등급을 추정해
#: 만들지 않는다는 원칙대로, 일람에 코드·이름이 대조된 것만 담는다(생성 근거는 파일 참조).
GRADE_OVERRIDES = json.loads((REPO / 'data' / 'reference' / 'river_grade_overrides_2024.json')
                             .read_text(encoding='utf-8'))['overrides']
CLASS_RANK = {'RVC001': 0, 'RVC002': 1, 'RVC003': 2}
CLASS_UNKNOWN = '등급미확인'
MESRMTH_LABEL = {'P': '사진측량', 'F': '현황측량', 'C': '지적측량'}

LAYERS = (
    ('TN_RIVER_BNDRY', NGII_BOUNDARY_ZIP, 'TN_RIVER_BNDRY', 'zone'),
    ('TN_RIVER_BT', NGII_REALWIDTH_ZIP, 'TN_RIVER_BT', 'channel'),
)


# ---------------------------------------------------------------- 원자료 읽기

def stream_shapes(zip_path: Path, member: str):
    """.shp 를 흘려 읽는다. 파일 전체를 메모리에 올리지 않는다."""
    archive = zipfile.ZipFile(require(zip_path, member))
    with archive.open(member) as handle:
        handle.read(100)
        index = 0
        while True:
            head = handle.read(8)
            if len(head) < 8:
                return
            _, words = struct.unpack('>ii', head)
            body = handle.read(words * 2)
            shape_type = struct.unpack('<i', body[:4])[0]
            if shape_type == 0:
                index += 1
                continue
            nparts, npoints = struct.unpack('<2i', body[36:44])
            parts = list(struct.unpack(f'<{nparts}i', body[44:44 + nparts * 4]))
            base = 44 + nparts * 4
            coords = np.frombuffer(body[base:base + npoints * 16], dtype='<f8').reshape(-1, 2).copy()
            yield index, struct.unpack('<4d', body[4:36]), parts, coords
            index += 1


def read_dbf(zip_path: Path, member: str):
    archive = zipfile.ZipFile(zip_path)
    return shapefile.Reader(dbf=io.BytesIO(archive.read(member)), encoding='cp949').records()


def stream_dbf(zip_path: Path, member: str, fields: tuple):
    """필요한 칸만 잘라 흘려 읽는다.

    중심선 dbf 는 압축 해제 시 832 MB 이고 레코드가 322만 건이다. pyshp 로 통째로 읽으면
    레코드 객체 322만 개가 만들어져 수 GB 를 쓴다. 여기서는 등급·이름·코드 세 칸만 필요하므로
    헤더에서 위치를 찾아 그 구간만 잘라 낸다.
    """
    archive = zipfile.ZipFile(zip_path)
    with archive.open(member) as handle:
        head = handle.read(32)
        count, header_len, record_len = struct.unpack('<Ihh', head[4:12])
        descriptors = handle.read(header_len - 32)
        offset = 1  # 선두 1바이트는 삭제표시
        spans: dict = {}
        for i in range(0, len(descriptors) - 1, 32):
            block = descriptors[i:i + 32]
            if len(block) < 32 or block[0] == 0x0D:
                break
            name = block[:11].split(bytes([0]))[0].decode('cp949', 'replace')
            size = block[16]
            if name in fields:
                spans[name] = (offset, offset + size)
            offset += size
        missing = [f for f in fields if f not in spans]
        if missing:
            raise ValueError(f'{member}: 필요한 칸을 찾지 못했다 {missing}')

        buffer = b''
        read = 0
        while read < count:
            chunk = handle.read(record_len * 4096)
            if not chunk:
                return
            buffer += chunk
            usable = len(buffer) // record_len
            for i in range(usable):
                row = buffer[i * record_len:(i + 1) * record_len]
                yield {name: row[a:b].decode('cp949', 'replace').strip() for name, (a, b) in spans.items()}
            buffer = buffer[usable * record_len:]
            read += usable


# ---------------------------------------------------------------- 중심선 색인

def centerline_index():
    """중심선에서 국가·지방·소하천만 골라 격자에 담는다. 세류·기타하천은 넣지 않는다."""
    buckets: dict = defaultdict(list)
    metas: list = []
    seen: dict = {}
    attributes = stream_dbf(CENTERLINE_ZIP, 'TN_RIVER_CTLN.dbf', ('RIVER_SE', 'RIVER_NM', 'RIVER_NO'))
    for (_index, _box, parts, coords), fields in zip(
            stream_shapes(CENTERLINE_ZIP, 'TN_RIVER_CTLN.shp'), attributes):
        rank = CLASS_RANK.get((fields.get('RIVER_SE') or '').strip())
        if rank is None:
            continue
        # 같은 하천의 구간이 수백 개라 이름·코드를 구간마다 들고 있으면 메모리를 크게 쓴다.
        key = (rank, (fields.get('RIVER_NM') or '').strip(), (fields.get('RIVER_NO') or '').strip())
        meta = seen.get(key)
        if meta is None:
            meta = seen[key] = len(metas)
            metas.append(key)
        # 구간마다 몇 점만 담는다. 구간이 짧아 이 정도면 폴리곤 안을 반드시 지난다.
        step = max(1, len(coords) // 4)
        for x, y in coords[::step]:
            buckets[(int(x // CELL_M), int(y // CELL_M))].append((x, y, meta))
    print(f'  중심선 3종 구간 {len(seen):,}종 · 격자 {len(buckets):,} 칸 · 점 {sum(len(v) for v in buckets.values()):,}')
    return buckets, metas


def class_of(coords, parts, box, centerlines):
    """폴리곤 안을 지나는 중심선 중 가장 상위 등급과 그 하천명·코드."""
    buckets, metas = centerlines
    rings = ring_slices(coords, parts)
    best = None
    for gx in range(int(box[0] // CELL_M), int(box[2] // CELL_M) + 1):
        for gy in range(int(box[1] // CELL_M), int(box[3] // CELL_M) + 1):
            for x, y, meta in buckets.get((gx, gy), ()):
                rank = metas[meta][0]
                if best is not None and rank >= best[0]:
                    continue
                if not (box[0] <= x <= box[2] and box[1] <= y <= box[3]):
                    continue
                if contains(rings, x, y):
                    best = metas[meta]
                    if rank == 0:
                        return best
    return best


# ---------------------------------------------------------------- 기하 도우미

def ring_slices(coords, parts):
    bounds = list(parts) + [len(coords)]
    return [coords[bounds[i]:bounds[i + 1]] for i in range(len(parts))]


def contains(rings, x: float, y: float) -> bool:
    """even-odd. 구멍과 다중부를 함께 올바로 처리한다."""
    crossed = False
    for ring in rings:
        xs, ys = ring[:, 0], ring[:, 1]
        x1, y1 = xs[:-1], ys[:-1]
        x2, y2 = xs[1:], ys[1:]
        straddle = (y1 > y) != (y2 > y)
        if not straddle.any():
            continue
        with np.errstate(divide='ignore', invalid='ignore'):
            xin = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
        crossed ^= bool(np.count_nonzero(straddle & (x < xin)) % 2)
    return crossed


def signed_area(ring) -> float:
    x, y = ring[:, 0], ring[:, 1]
    return float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))) / 2


def simplify(ring, tolerance: float):
    arr = ring if len(ring) < 4 else rdp(np.asarray(ring, dtype=float), tolerance)
    if len(arr) < 4:
        arr = ring
    lon, lat = TO4326(arr[:, 0], arr[:, 1])
    out = [[round(float(a), PRECISION), round(float(b), PRECISION)] for a, b in zip(lon, lat)]
    if out[0] != out[-1]:
        out.append(out[0])
    return out if len(out) >= 4 else None


def geometry_of(coords, parts, tolerance: float):
    polygons: list = []
    for ring in ring_slices(coords, parts):
        simplified = simplify(ring, tolerance)
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


# ---------------------------------------------------------------- 시군구 배정

def plan_rivers() -> dict:
    """(시군구코드, 하천명) → river_id. 중심선이 붙여 준 하천명으로 곧장 잇는다.

    예전에는 rivers.json 의 하천을 중심선 정점과 공간조인해 붙였는데, 이제 중심선 속성에서
    하천명이 바로 나오므로 이름으로 잇는 것이 더 정확하다(같은 자료에서 나온 이름이다).
    """
    payload = json.loads((REPO / 'data' / 'reference' / 'rivers.json').read_text(encoding='utf-8'))
    table: dict = {}
    for river in payload['rivers']:
        admin = river['admin_code']
        table[(PLAN_RIVER_ADMIN.get(admin, admin), river['name'])] = river['river_id']
    return table


def load_regions():
    """시군구별 경계 union(EPSG:5179) + 공간색인. 클리핑 배정의 기준 형상이다."""
    import csv as csv_module
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
    from shapely.prepared import prep
    from shapely.strtree import STRtree
    from shapely.validation import make_valid

    adm_to_sgg: dict = {}
    with require(LINK_CSV, '법정동 연계정보').open(encoding='cp949', newline='') as handle:
        for row in csv_module.DictReader(handle):
            legal = (row.get('법정동코드') or '').strip()
            if len(legal) == 10 and legal.isdigit():
                adm_to_sgg.setdefault((row.get('행정구역코드') or '').strip(), legal[:5])
    # 층위와 기준일을 소하천구역 쪽에 맞춘다. 두 가지를 함께 처리한다.
    #   구 → 시 : 법정동코드 앞 5자리는 자치구가 있는 시에서 구 코드다(성남시 → 분당구 41135).
    #             소하천구역 원자료는 시 코드(41130)를 쓰므로 parent_code 로 올린다.
    #   별칭 → 대표 : 같은 시군구가 개편 전후 코드를 둘 다 가질 때 하나로 모은다.
    # 이걸 안 하면 지도가 성남시를 골랐을 때 소하천만 보이고 경계·실폭은 파일을 못 찾는다.
    payload = json.loads(require(SGG_MAP, '시군구 코드표').read_text(encoding='utf-8'))
    promote: dict = {}
    for entry in payload['entries']:
        for code in entry['codes']:
            promote[code] = entry['primary_code']

    to5179 = pyproj.Transformer.from_crs('EPSG:5186', SRC_CRS, always_xy=True).transform
    reader = shapefile.Reader(str(DONG_SHP), encoding='cp949')
    by_code: dict = defaultdict(list)
    for shape, record in zip(reader.shapes(), reader.records()):
        code = adm_to_sgg.get((record['ADM_CD'] or '').strip())
        if not code:
            continue
        points = np.asarray(shape.points, dtype=float)
        x, y = to5179(points[:, 0], points[:, 1])
        points = np.column_stack([x, y])
        bounds = list(shape.parts) + [len(points)]
        for i in range(len(shape.parts)):
            ring = points[bounds[i]:bounds[i + 1]]
            if len(ring) >= 4:
                # 구멍 방향을 따지지 않고 링 전부를 면으로 합친다 — 행정동 구멍은 대부분 이웃
                # 행정동이라 같은 시군구 union 에서 도로 메워진다.
                by_code[promote.get(code, code)].append(Polygon(ring))
    codes: list = []
    geoms: list = []
    preps: list = []
    for code, polys in by_code.items():
        merged = unary_union(polys)
        if not merged.is_valid:
            merged = make_valid(merged)
        codes.append(code)
        geoms.append(merged)
        preps.append(prep(merged))
    tree = STRtree(geoms)
    return codes, geoms, preps, tree


def shapely_of(coords, parts):
    """국가기본도 폴리곤(5179) → shapely. 링 방향으로 외곽/구멍을 가른다(geometry_of 와 동일 규약)."""
    from shapely.geometry import MultiPolygon, Polygon
    from shapely.validation import make_valid
    shells: list = []
    for ring in ring_slices(coords, parts):
        if len(ring) < 4:
            continue
        if signed_area(ring) < 0 or not shells:
            shells.append([ring, []])
        else:
            shells[-1][1].append(ring)
    polys = [Polygon(shell, holes) for shell, holes in shells]
    geom = polys[0] if len(polys) == 1 else MultiPolygon(polys)
    if not geom.is_valid:
        geom = make_valid(geom)
    return geom


def geojson_of_shapely(geom, tolerance: float):
    """클리핑 조각(shapely, 5179) → GeoJSON. 단순화·좌표계 변환은 geometry_of 와 같은 simplify 를 쓴다."""
    polys = []
    stack = [geom]
    while stack:
        g = stack.pop()
        t = g.geom_type
        if t == 'Polygon':
            polys.append(g)
        elif t in ('MultiPolygon', 'GeometryCollection'):
            stack.extend(g.geoms)
    coordinates = []
    for poly in polys:
        rings = []
        for ring in [poly.exterior, *poly.interiors]:
            simplified = simplify(np.asarray(ring.coords, dtype=float), tolerance)
            if simplified:
                rings.append(simplified)
        if rings:
            coordinates.append(rings)
    if not coordinates:
        return None
    if len(coordinates) == 1:
        return {'type': 'Polygon', 'coordinates': coordinates[0]}
    return {'type': 'MultiPolygon', 'coordinates': coordinates}


# ---------------------------------------------------------------- 본체

#: 클리핑 조각 최소 면적(m²). 경계선을 스치기만 한 부스러기(수 m²)는 지역 화면에 정보가 없다.
#: 좁은 하천이 모서리를 실제로 지나는 조각(수십 m²)은 남긴다.
MIN_PIECE_M2 = 25.0


def build(name: str, zip_path: Path, stem: str, semantic: str, centerlines, regions, plans, limit=0) -> dict:
    from shapely.geometry import box as shapely_box
    codes, geoms, preps, tree = regions
    records = read_dbf(zip_path, f'{stem}.dbf')
    tolerance = TOLERANCE_BY_LAYER[name]
    stage = STAGE / name
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)

    handles: dict = {}
    counts: Counter = Counter()
    classes: Counter = Counter()
    tagged: Counter = Counter()
    no_region = 0
    clipped = 0
    for index, box, parts, coords in stream_shapes(zip_path, f'{stem}.shp'):
        # 폴리곤이 지나는 시군구 전부에 담는다. bbox 가 통째로 한 시군구 안이면(대다수) 자르지 않는다.
        bbox_poly = shapely_box(box[0], box[1], box[2], box[3])
        candidates = list(tree.query(bbox_poly))
        pieces: list = []  # (code, geometry)
        whole = next((i for i in candidates if preps[i].contains(bbox_poly)), None)
        if whole is not None:
            geometry = geometry_of(coords, parts, tolerance)
            if geometry:
                pieces.append((codes[whole], geometry))
        else:
            poly = shapely_of(coords, parts)
            for i in candidates:
                if not preps[i].intersects(poly):
                    continue
                piece = geoms[i].intersection(poly)
                if piece.is_empty or piece.area < MIN_PIECE_M2:
                    continue
                geometry = geojson_of_shapely(piece, tolerance)
                if geometry:
                    pieces.append((codes[i], geometry))
            if len(pieces) > 1:
                clipped += 1
        if not pieces:
            # 해안·하구처럼 행정동 경계 밖으로 나간 폴리곤. 지어내지 않고 건너뛴다.
            no_region += 1
            continue
        fields = records[index].as_dict()
        base = {
            'NF_ID': (fields.get('NF_ID') or '').strip(),
            'source_layer': name,
            'semantic': semantic,
        }
        hit = class_of(coords, parts, box, centerlines)
        if hit:
            rank, river_name, river_code = hit
            base['river_class'] = RIVER_SE_LABEL[{v: k for k, v in CLASS_RANK.items()}[rank]]
            base['river_class_source'] = '중심선 공간조인'
            if river_name:
                base['river_name'] = river_name
            if river_code:
                base['river_code'] = river_code
            override = GRADE_OVERRIDES.get(str(river_code or ''))
            if override:
                base['river_class'] = override['river_class']
                base['river_class_source'] = f"중심선 공간조인 · {override['basis']} 보정"
        else:
            base['river_class'] = CLASS_UNKNOWN
        classes[base['river_class']] += len(pieces)
        if fields.get('MESRMTH_SE'):
            base['survey_method'] = MESRMTH_LABEL.get(fields['MESRMTH_SE'], fields['MESRMTH_SE'])

        for code, geometry in pieces:
            props = dict(base)
            props['admin_code'] = code
            # 계획문서 제원이 있는 하천이면 river_id 를 단다. 지도 강조·계획근거 패널이 이걸 쓴다.
            river_id = plans.get((code, props.get('river_name'))) if props.get('river_name') else None
            if river_id:
                props['river_id'] = river_id
                tagged[river_id] += 1
            handle = handles.get(code)
            if handle is None:
                handle = handles[code] = (stage / f'{code}.jsonl').open('w', encoding='utf-8')
            handle.write(json.dumps({'type': 'Feature', 'id': f'{name}:{props["NF_ID"] or index}',
                                     'properties': props, 'geometry': geometry},
                                    ensure_ascii=False, separators=(',', ':')) + '\n')
            counts[code] += 1
        if limit and sum(counts.values()) >= limit:
            break
    for handle in handles.values():
        handle.close()

    total_bytes = 0
    for code, count in sorted(counts.items()):
        features = [json.loads(line) for line in (stage / f'{code}.jsonl').read_text(encoding='utf-8').splitlines()]
        out = DEST / f'{name}_{code}.geojson'
        out.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                                  ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        total_bytes += out.stat().st_size
    shutil.rmtree(stage)
    print(f'  {name}: 시군구 {len(counts)} · 폴리곤 {sum(counts.values()):,} · '
          f'{total_bytes / 1048576:.1f} MB · 행정동 밖 {no_region:,}건 제외 · 경계 걸침 분할 {clipped:,}건')
    print(f'    등급 {dict(classes.most_common())}')
    if tagged:
        print(f'    계획문서 하천 연결 {dict(tagged)}')
    return {'layer': name, 'regions': len(counts), 'features': sum(counts.values()), 'bytes': total_bytes}


def main() -> int:
    print(f'국가기본도 하천 반입 · {SRC_CRS} → EPSG:4326 · 단순화 {TOLERANCE_BY_LAYER} · 좌표 {PRECISION}자리')
    regions = load_regions()
    print(f'  시군구 경계 union {len(regions[0]):,}곳')
    centerlines = centerline_index()

    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    if limit:
        print(f'  시험 실행 · 레이어당 {limit:,}건까지만')
    plans = plan_rivers()
    results = [build(name, zip_path, stem, semantic, centerlines, regions, plans, limit)
               for name, zip_path, stem, semantic in LAYERS]
    total = sum(r['bytes'] for r in results)
    print(f'\n합계 {sum(r["features"] for r in results):,} 폴리곤 · {total / 1048576:.1f} MB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
