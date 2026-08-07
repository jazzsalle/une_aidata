"""추출한 국가기본도 하천자료를 웹에서 쓸 수 있는 크기로 줄여 앱에 반입한다.

    입력  build/river/TN_RIVER_{BT,BNDRY,CTLN}_{admin}.geojson  (extract_river_layers.py 산출)
    출력  apps/web/public/reference/rivers/{layer}_{admin}.geojson

원자료는 1:5,000 국가기본도라 화면 표시에 필요한 것보다 훨씬 촘촘하다. 다음 세 가지만 한다.

  1. 좌표 정밀도 6자리(약 0.11 m). 원자료의 8자리는 1 mm 로 지도 표시에 무의미하다.
  2. Douglas-Peucker 단순화. 허용오차는 미터로 주고 EPSG:5179 에서 계산한다.
  3. 중심선은 `RIVER_SE` 로 세류(RVC005)를 제외한다. 세류가 전체의 85% 를 차지하는데
     시·군 단위 지도에서는 실개천까지 그리면 하천망을 읽을 수 없다.

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
CENTERLINE_KEEP = {'RVC001', 'RVC002', 'RVC003', 'RVC004'}
MESRMTH_LABEL = {'P': '사진측량', 'F': '현황측량', 'C': '지적측량'}

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


def build(path: Path) -> None:
    parts = path.stem.split('_')
    admin = parts[-1]
    layer = '_'.join(parts[:-1])
    features = json.loads(path.read_text(encoding='utf-8'))['features']

    # rivers.json 에 제원이 있는 하천만 river_id 를 붙인다(지도 클릭 → 제원 팝업, Agent highlight 용).
    marks = [(rid, name, centerline_points(admin, name))
             for rid, name in named_rivers().get(admin, [])]

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
    out = DEST / f'{layer}_{admin}.geojson'
    out.write_text(json.dumps({'type': 'FeatureCollection', 'features': kept},
                              ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    before = path.stat().st_size / 1048576
    after = out.stat().st_size / 1048576
    note = f' · 세류 제외 {dropped_se:,}건' if dropped_se else ''
    if tagged:
        note += f' · river_id 연결 {tagged}건'
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
