"""추출한 국가기본도 하천자료를 웹에서 쓸 수 있는 크기로 줄여 앱에 반입한다.

    입력  build/river/TN_RIVER_{BT,BNDRY,CTLN}_{admin}.geojson  (extract_river_layers.py 산출)
    출력  apps/web/public/reference/rivers/{layer}_{admin}.geojson

원자료는 1:5,000 국가기본도라 화면 표시에 필요한 것보다 훨씬 촘촘하다. 다음 세 가지만 한다.

  1. 좌표 정밀도 6자리(약 0.11 m). 원자료의 8자리는 1 mm 로 지도 표시에 무의미하다.
  2. Douglas-Peucker 단순화. 허용오차는 미터로 주고 EPSG:5179 에서 계산한다.
  3. 중심선은 `RIVER_SE` 로 세류(RVC005)를 제외한다. 세류가 전체의 85% 를 차지하는데
     시·군 단위 지도에서는 실개천까지 그리면 하천망을 읽을 수 없다.
  4. 남은 중심선 중 **이름 없는 소하천**은 `TN_RIVER_CTLN_MINOR_{admin}.geojson` 으로 갈라 낸다.
     실측하면 남원 4,781건·구미 4,741건·의왕 785건이고 참조 GeoJSON 전체 용량의 20% 를 쓰는데
     `RIVER_NM` 이 없어 검색·식별에는 기여하지 못한다. 버리지 않고 기본 비표시 레이어로 옮긴다.

**형상을 옮기는 것 외에 값을 만들어내지 않는다.** 면적·하폭 같은 파생 지표를 계산하지 않는다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pyproj

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / 'build' / 'river'
DEST = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'

TO5179 = pyproj.Transformer.from_crs('EPSG:4326', 'EPSG:5179', always_xy=True).transform
TO4326 = pyproj.Transformer.from_crs('EPSG:5179', 'EPSG:4326', always_xy=True).transform

PRECISION = 6
TOLERANCE_M = 2.0
# 하천 구분 코드는 테이블정의서 '세부코드' 시트 실측값이다(추정 아님).
RIVER_SE_LABEL = {
    'RVC001': '국가하천', 'RVC002': '지방하천', 'RVC003': '소하천',
    'RVC004': '기타하천', 'RVC005': '세류',
}
# 서비스가 다루는 하천은 국가·지방·소하천 3종이다(2026-08-12 사용자 확인).
# 세류(RVC005)는 원자료의 85%를 차지해 시·군 화면에서 하천망을 덮고, 기타하천(RVC004)도 범위 밖이다.
CENTERLINE_KEEP = {'RVC001', 'RVC002', 'RVC003'}
# 등급 우선순위. 한 폴리곤을 여러 등급의 중심선이 지나면 상위 등급으로 본다.
CLASS_RANK = {'RVC001': 0, 'RVC002': 1, 'RVC003': 2, 'RVC004': 3, 'RVC005': 4}
# 실폭·하천경계에는 등급 속성이 아예 없다(테이블정의서 확인). 중심선에서 공간조인해 붙인다.
# 중심선이 지나지 않는 폴리곤은 버리지 않고 이 값으로 남긴다 — 버리면 물길이 끊겨 보인다.
CLASS_UNKNOWN = '등급미확인'
GRID_CELL_M = 300.0
MESRMTH_LABEL = {'P': '사진측량', 'F': '현황측량', 'C': '지적측량'}

# 이름 없는 소하천 중심선은 별도 파일로 가른다. 소하천의 이름은 소하천구역(LSMD_SOCHUN)이 갖고
# 있고 국가기본도 중심선 쪽은 거의 비어 있다(남원 4,781건 전부 무명, 구미 5,183건 중 58종만 유명).
MINOR_LAYER = 'TN_RIVER_CTLN_MINOR'


def is_minor_centerline(props: dict) -> bool:
    """이름 없는 소하천 중심선인가. 산출 뒤 분리 스크립트와 이 판정을 공유한다."""
    return props.get('river_class') == '소하천' and not (props.get('RIVER_NM') or '').strip()


# 앱에 남길 속성만 고른다. 제작업체·DB등록일시는 화면에서 쓸 일이 없다.
KEEP_PROPS = ('NF_ID', 'RIVER_NO', 'RIVER_NM', 'RIVER_SE', 'admin_code', 'source_layer', 'semantic')


def named_rivers() -> dict[str, list[tuple[str, str]]]:
    """rivers.json 의 하천 제원이 걸려 있는 하천 목록. {행정코드: [(river_id, 하천명)]}"""
    rows = json.loads((REPO / 'data/reference/rivers.json').read_text(encoding='utf-8'))
    if isinstance(rows, dict):
        rows = rows.get('rivers', [])
    out: dict[str, list[tuple[str, str]]] = {}
    for row in rows:
        out.setdefault(str(row['admin_code']), []).append((row['river_id'], row['name']))
    return out


def centerline_points(admin: str, name: str) -> np.ndarray:
    """해당 하천 이름을 가진 중심선 정점(EPSG:5179). 폴리곤에 river_id 를 붙이는 기준이 된다."""
    path = SRC / f'TN_RIVER_CTLN_{admin}.geojson'
    if not path.exists():
        return np.empty((0, 2))
    chunks = []
    for feature in json.loads(path.read_text(encoding='utf-8'))['features']:
        if (feature['properties'].get('RIVER_NM') or '').strip() != name:
            continue
        for ring in rings_of(feature['geometry']['coordinates']):
            arr = np.array(ring, dtype=float)
            x, y = TO5179(arr[:, 0], arr[:, 1])
            chunks.append(np.column_stack([x, y]))
    return np.vstack(chunks) if chunks else np.empty((0, 2))


def rings_of(coords, out=None):
    out = [] if out is None else out
    if isinstance(coords[0][0], (int, float)):
        out.append(coords)
    else:
        for c in coords:
            rings_of(c, out)
    return out


def contains(polygon: np.ndarray, px: float, py: float) -> bool:
    """ray casting. 링 하나에 대한 내부 판정."""
    x, y = polygon[:, 0], polygon[:, 1]
    x2, y2 = np.roll(x, -1), np.roll(y, -1)
    cond = (y > py) != (y2 > py)
    if not cond.any():
        return False
    xin = x[cond] + (py - y[cond]) * (x2[cond] - x[cond]) / (y2[cond] - y[cond])
    return bool((xin > px).sum() % 2 == 1)


def class_index(admin: str) -> dict[tuple[int, int], list[tuple[float, float, int]]]:
    """중심선 정점을 격자 버킷에 담아 둔다. 폴리곤마다 전건 대조하면 너무 느리다."""
    path = SRC / f'TN_RIVER_CTLN_{admin}.geojson'
    buckets: dict[tuple[int, int], list[tuple[float, float, int]]] = {}
    if not path.exists():
        return buckets
    for feature in json.loads(path.read_text(encoding='utf-8'))['features']:
        rank = CLASS_RANK.get(feature['properties'].get('RIVER_SE'))
        if rank is None:
            continue
        for ring in rings_of(feature['geometry']['coordinates']):
            arr = np.array(ring, dtype=float)
            x, y = TO5179(arr[:, 0], arr[:, 1])
            for px, py in zip(x, y):
                buckets.setdefault((int(px // GRID_CELL_M), int(py // GRID_CELL_M)), []).append((px, py, rank))
    return buckets


def class_for(geometry, buckets) -> str | None:
    """도형 안을 지나는 중심선 중 가장 상위 등급. 없으면 None(= 등급미확인)."""
    best: int | None = None
    for ring in rings_of(geometry['coordinates']):
        arr = np.array(ring, dtype=float)
        x, y = TO5179(arr[:, 0], arr[:, 1])
        poly = np.column_stack([x, y])
        gx0, gy0 = int(poly[:, 0].min() // GRID_CELL_M), int(poly[:, 1].min() // GRID_CELL_M)
        gx1, gy1 = int(poly[:, 0].max() // GRID_CELL_M), int(poly[:, 1].max() // GRID_CELL_M)
        for gx in range(gx0, gx1 + 1):
            for gy in range(gy0, gy1 + 1):
                for px, py, rank in buckets.get((gx, gy), ()):
                    if (best is None or rank < best) and contains(poly, px, py):
                        best = rank
        if best == 0:
            break
    if best is None:
        return None
    inverse = {v: k for k, v in CLASS_RANK.items()}
    return inverse[best]


def river_id_for(geometry, marks: list[tuple[str, str, np.ndarray]]) -> tuple[str, str] | None:
    """도형 안을 지나는 명명 하천의 중심선이 있으면 그 하천으로 본다.

    실폭·하천경계에는 하천명 속성이 아예 없다(테이블정의서 확인). 그래서 이름을 가진
    유일한 자료인 중심선을 기준으로 공간조인한다. **이름을 추정해 붙이지 않는다** —
    중심선이 실제로 그 도형을 지날 때만 연결한다.
    """
    polys = []
    for ring in rings_of(geometry['coordinates']):
        arr = np.array(ring, dtype=float)
        x, y = TO5179(arr[:, 0], arr[:, 1])
        polys.append(np.column_stack([x, y]))
    if not polys:
        return None
    for river_id, name, points in marks:
        if not len(points):
            continue
        for poly in polys:
            x0, y0 = poly[:, 0].min(), poly[:, 1].min()
            x1, y1 = poly[:, 0].max(), poly[:, 1].max()
            near = points[(points[:, 0] >= x0) & (points[:, 0] <= x1)
                          & (points[:, 1] >= y0) & (points[:, 1] <= y1)]
            for px, py in near:
                if contains(poly, px, py):
                    return river_id, name
    return None


def rdp(points: np.ndarray, tolerance: float) -> np.ndarray:
    """Douglas-Peucker. 반복 구현(재귀 깊이 제한을 피한다)."""
    n = len(points)
    if n < 3:
        return points
    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        start, end = stack.pop()
        if end <= start + 1:
            continue
        a = points[start]
        b = points[end]
        seg = b - a
        length = float(np.hypot(*seg))
        block = points[start + 1:end]
        if length == 0:
            dist = np.hypot(block[:, 0] - a[0], block[:, 1] - a[1])
        else:
            # 점-선분 수직거리(외적 / 길이)
            dist = np.abs(seg[0] * (a[1] - block[:, 1]) - (a[0] - block[:, 0]) * seg[1]) / length
        index = int(np.argmax(dist))
        if dist[index] > tolerance:
            pivot = start + 1 + index
            keep[pivot] = True
            stack.append((start, pivot))
            stack.append((pivot, end))
    return points[keep]


def simplify_ring(ring, closed: bool):
    arr = np.array(ring, dtype=float)
    if len(arr) < 2:
        return None
    x, y = TO5179(arr[:, 0], arr[:, 1])
    simplified = rdp(np.column_stack([x, y]), TOLERANCE_M)
    # 폴리곤 링은 최소 4점(닫힘 포함)이어야 유효하다. 부족하면 원본을 그대로 둔다.
    if closed and len(simplified) < 4:
        simplified = np.column_stack([x, y])
    if not closed and len(simplified) < 2:
        return None
    lon, lat = TO4326(simplified[:, 0], simplified[:, 1])
    out = [[round(float(a), PRECISION), round(float(b), PRECISION)] for a, b in zip(lon, lat)]
    if closed and out[0] != out[-1]:
        out.append(out[0])
    return out


def simplify_geometry(geometry):
    kind = geometry['type']
    closed = 'Polygon' in kind

    def walk(coords, depth):
        if depth == 0:
            return simplify_ring(coords, closed)
        parts = [walk(c, depth - 1) for c in coords]
        return [p for p in parts if p]

    depth = {'LineString': 0, 'MultiLineString': 1, 'Polygon': 1, 'MultiPolygon': 2}.get(kind)
    if depth is None:
        return None
    coords = walk(geometry['coordinates'], depth)
    if not coords:
        return None
    return {'type': kind, 'coordinates': coords}


def write_collection(path: Path, features: list) -> None:
    path.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                               ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def build(path: Path) -> None:
    parts = path.stem.split('_')
    admin = parts[-1]
    layer = '_'.join(parts[:-1])
    features = json.loads(path.read_text(encoding='utf-8'))['features']

    # rivers.json 에 제원이 있는 하천만 river_id 를 붙인다(지도 클릭 → 제원 팝업, Agent highlight 용).
    marks = [(rid, name, centerline_points(admin, name))
             for rid, name in named_rivers().get(admin, [])]
    # 실폭·하천경계는 등급 속성이 없으므로 중심선에서 공간조인해 붙인다.
    class_buckets = class_index(admin) if layer in ('TN_RIVER_BT', 'TN_RIVER_BNDRY') else {}

    kept = []
    dropped_se = 0
    tagged = 0
    for feature in features:
        props = feature['properties']
        if layer == 'TN_RIVER_CTLN' and props.get('RIVER_SE') not in CENTERLINE_KEEP:
            dropped_se += 1
            continue
        geometry = simplify_geometry(feature['geometry'])
        if not geometry:
            continue
        slim = {k: props[k] for k in KEEP_PROPS if props.get(k) not in (None, '')}
        if props.get('RIVER_SE'):
            slim['river_class'] = RIVER_SE_LABEL.get(props['RIVER_SE'], props['RIVER_SE'])
        elif class_buckets:
            joined = class_for(feature['geometry'], class_buckets)
            if joined and joined not in CENTERLINE_KEEP:
                # 3종 밖(세류·기타하천)으로 확인된 폴리곤은 중심선과 같은 기준으로 뺀다.
                dropped_se += 1
                continue
            # 등급을 만들어내지 않는다. 중심선이 지나지 않으면 '등급미확인'으로 남긴다.
            slim['river_class'] = RIVER_SE_LABEL.get(joined, CLASS_UNKNOWN) if joined else CLASS_UNKNOWN
            if joined:
                slim['river_class_source'] = '중심선 공간조인'
        if props.get('MESRMTH_SE'):
            slim['survey_method'] = MESRMTH_LABEL.get(props['MESRMTH_SE'], props['MESRMTH_SE'])
        # 중심선은 이름을 갖고 있으므로 직접 대조하고, 이름이 없는 실폭·경계는 공간조인한다.
        name = (props.get('RIVER_NM') or '').strip()
        link = next(((rid, nm) for rid, nm, _ in marks if nm == name), None) if name else None
        if link is None and layer != 'TN_RIVER_CTLN':
            link = river_id_for(feature['geometry'], marks)
        if link:
            slim['river_id'], slim['river_name'] = link
            tagged += 1
        kept.append({'type': 'Feature', 'id': feature.get('id'),
                     'properties': slim, 'geometry': geometry})

    DEST.mkdir(parents=True, exist_ok=True)
    minor = []
    if layer == 'TN_RIVER_CTLN':
        minor = [row for row in kept if is_minor_centerline(row['properties'])]
        if minor:
            kept = [row for row in kept if not is_minor_centerline(row['properties'])]
            write_collection(DEST / f'{MINOR_LAYER}_{admin}.geojson', minor)
    out = DEST / f'{layer}_{admin}.geojson'
    write_collection(out, kept)
    before = path.stat().st_size / 1048576
    after = out.stat().st_size / 1048576
    note = f' · 3종 외 제외 {dropped_se:,}건' if dropped_se else ''
    classes = {}
    for row in kept:
        value = row['properties'].get('river_class')
        if value:
            classes[value] = classes.get(value, 0) + 1
    if classes:
        note += ' · ' + ' '.join(f'{k}{v:,}' for k, v in sorted(classes.items(), key=lambda x: -x[1]))
    if tagged:
        note += f' · river_id 연결 {tagged}건'
    if minor:
        note += f' · 무명 소하천 {len(minor):,}건 분리'
    print(f'  {out.name}: {len(kept):,}건 · {before:.1f} MB → {after:.2f} MB '
          f'({after / before * 100:.0f}%){note}')

    if layer == 'TN_RIVER_CTLN':
        build_labels(admin, kept)


def build_labels(admin: str, centerlines: list) -> None:
    """하천명 라벨용 포인트. 하천명 하나당 대표점 1개만 만든다.

    중심선은 한 하천이 수천 조각으로 나뉘어 있어 조각마다 글자를 붙이면 이름이 겹쳐
    아무것도 읽을 수 없다. 하천별로 **가장 긴 조각의 중간점**을 대표점으로 쓴다.
    좌표를 새로 만들지 않고 중심선 위의 실제 정점을 그대로 고른다.
    """
    best: dict[str, tuple[float, list[float], dict]] = {}
    for feature in centerlines:
        name = (feature['properties'].get('RIVER_NM') or '').strip()
        if not name:
            continue
        for ring in rings_of(feature['geometry']['coordinates']):
            arr = np.array(ring, dtype=float)
            if len(arr) < 2:
                continue
            x, y = TO5179(arr[:, 0], arr[:, 1])
            length = float(np.hypot(np.diff(x), np.diff(y)).sum())
            if name in best and best[name][0] >= length:
                continue
            best[name] = (length, list(ring[len(ring) // 2]), feature['properties'])

    features = []
    for name, (length, point, props) in sorted(best.items()):
        keep = {'RIVER_NM': name, 'admin_code': admin, 'source_layer': 'TN_RIVER_CTLN',
                'semantic': 'label', 'length_m': round(length)}
        for key in ('RIVER_NO', 'RIVER_SE', 'river_class', 'river_id', 'river_name'):
            if props.get(key):
                keep[key] = props[key]
        features.append({'type': 'Feature', 'id': f'RIVER_LABEL:{admin}:{name}',
                         'properties': keep, 'geometry': {'type': 'Point', 'coordinates': point}})

    out = DEST / f'TN_RIVER_LABEL_{admin}.geojson'
    out.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                              ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'  {out.name}: 하천명 {len(features):,}개 ({out.stat().st_size // 1024:,} KB)')


def main() -> int:
    only = sys.argv[1:] or None
    paths = [p for p in sorted(SRC.glob('TN_RIVER_*_*.geojson'))
             if not only or any(p.stem.startswith(o) for o in only)]
    if not paths:
        print(f'{SRC} 에 추출 결과가 없다. scripts/extract_river_layers.py 를 먼저 실행하라.')
        return 1
    print(f'단순화 허용오차 {TOLERANCE_M} m · 좌표 {PRECISION}자리')
    for path in paths:
        build(path)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
