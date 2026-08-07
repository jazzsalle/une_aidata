"""기존 하천 형상(geo.json L2 = VWorld LT_C_WKMSTRM)과 국가기본도 하천자료가
얼마나 다른지 미터 단위로 잰다.

**2026-08-08 이후로는 그대로 돌지 않는다.** 이 비교로 국가기본도가 낫다는 결론이 나와
`geo.json` 에서 L2 를 제거했기 때문이다(요천 중앙값 11.7 m · 안양천 13.1 m 차이).
다시 재려면 L2 가 있던 시점의 `geo.json`(커밋 이전 판)을 기준으로 실행한다.

`build/river/` 에 추출된 결과가 있어야 한다(scripts/extract_river_layers.py 선행).

거리는 EPSG:5179(UTM-K, 미터) 에서 계산한다. L2 의 각 정점에서 대상 레이어의
가장 가까운 **선분**까지의 수직거리를 구하고 분포를 출력한다.

이 스크립트는 '어느 쪽이 베이스맵과 맞는가'를 판정하지 않는다 — 두 자료가 서로
얼마나 떨어져 있는지만 말한다. 베이스맵 정합은 화면에서 확인한다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pyproj

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'build' / 'river'
TO5179 = pyproj.Transformer.from_crs('EPSG:4326', 'EPSG:5179', always_xy=True).transform

RIVER_NAME = {'45190': '요천', '47190': '구미천', '41430': '안양천'}


def rings(coords, out):
    """좌표 트리에서 정점열(ring/line) 단위로 뽑는다."""
    if isinstance(coords[0][0], (int, float)):
        out.append(coords)
    else:
        for c in coords:
            rings(c, out)
    return out


def segments_of(geojson_features) -> np.ndarray:
    """모든 정점열을 선분 배열 (N,4) [x0,y0,x1,y1] 로 편다."""
    chunks = []
    for feature in geojson_features:
        for ring in rings(feature['geometry']['coordinates'], []):
            arr = np.array(ring, dtype=float)
            if len(arr) < 2:
                continue
            x, y = TO5179(arr[:, 0], arr[:, 1])
            pts = np.column_stack([x, y])
            chunks.append(np.column_stack([pts[:-1], pts[1:]]))
    return np.vstack(chunks) if chunks else np.empty((0, 4))


def vertices_of(geojson_features) -> np.ndarray:
    chunks = []
    for feature in geojson_features:
        for ring in rings(feature['geometry']['coordinates'], []):
            arr = np.array(ring, dtype=float)
            x, y = TO5179(arr[:, 0], arr[:, 1])
            chunks.append(np.column_stack([x, y]))
    return np.vstack(chunks) if chunks else np.empty((0, 2))


def point_to_segment(points: np.ndarray, segs: np.ndarray, cell: float = 200.0) -> np.ndarray:
    """각 점에서 가장 가까운 선분까지의 거리. 격자 해시로 후보를 좁힌다."""
    p0 = segs[:, :2]
    p1 = segs[:, 2:]
    # 선분이 걸치는 셀 전부에 등록해야 누락이 없다. 국가기본도는 정점 간격이 촘촘해
    # 선분 길이가 대부분 셀보다 짧다 — 양 끝 셀만 등록해도 실질 누락이 없지만,
    # 안전하게 두 끝점 사이를 셀 크기로 샘플링해 등록한다.
    buckets: dict[tuple[int, int], list[int]] = {}
    lengths = np.hypot(p1[:, 0] - p0[:, 0], p1[:, 1] - p0[:, 1])
    steps = np.maximum(1, np.ceil(lengths / cell).astype(int))
    for i in range(len(segs)):
        n = steps[i]
        for t in np.linspace(0.0, 1.0, n + 1):
            gx = int((p0[i, 0] + (p1[i, 0] - p0[i, 0]) * t) // cell)
            gy = int((p0[i, 1] + (p1[i, 1] - p0[i, 1]) * t) // cell)
            buckets.setdefault((gx, gy), []).append(i)

    out = np.full(len(points), np.inf)
    for k, (px, py) in enumerate(points):
        gx, gy = int(px // cell), int(py // cell)
        cand: list[int] = []
        radius = 1
        while not cand and radius <= 8:
            for dx in range(-radius, radius + 1):
                for dy in range(-radius, radius + 1):
                    cand.extend(buckets.get((gx + dx, gy + dy), ()))
            radius += 2
        if not cand:
            continue
        idx = np.unique(np.array(cand))
        a = p0[idx]
        b = p1[idx]
        ab = b - a
        ap = np.array([px, py]) - a
        denom = np.einsum('ij,ij->i', ab, ab)
        t = np.where(denom > 0, np.einsum('ij,ij->i', ap, ab) / np.where(denom > 0, denom, 1), 0.0)
        t = np.clip(t, 0.0, 1.0)
        proj = a + ab * t[:, None]
        out[k] = np.min(np.hypot(proj[:, 0] - px, proj[:, 1] - py))
    return out


def describe(name: str, d: np.ndarray) -> None:
    finite = d[np.isfinite(d)]
    if not len(finite):
        print(f'  {name}: 비교 대상 없음')
        return
    q = np.percentile(finite, [50, 90, 95, 99])
    print(f'  {name}: n={len(finite):,} 평균 {finite.mean():.1f} m · 중앙 {q[0]:.1f} · '
          f'p90 {q[1]:.1f} · p95 {q[2]:.1f} · p99 {q[3]:.1f} · 최대 {finite.max():.1f}')


def main() -> int:
    geo = json.loads((REPO / 'apps/web/public/seed/geo.json').read_text(encoding='utf-8'))
    l2 = [f for f in geo['features'] if f['properties'].get('layer') == 'L2']
    if not l2:
        print('geo.json 에 L2 하천 피처가 없다 — 2026-08-08 에 제거했다(위 설명 참고).\n'
              '  비교 기준이 필요하면 제거 이전 판의 geo.json 을 꺼내 쓰라.')
        return 1

    # 인자로 레이어를 좁힐 수 있다(예: TN_RIVER_BT). 중심선은 선분이 많아 오래 걸린다.
    only = sys.argv[1:] or None
    layers = {p.stem.split('_')[-1] + '|' + '_'.join(p.stem.split('_')[:-1]): p
              for p in sorted(OUT.glob('TN_RIVER_*_*.geojson'))
              if not only or any(p.stem.startswith(o) for o in only)}
    if not layers:
        print(f'{OUT} 에 추출 결과가 없다. scripts/extract_river_layers.py 를 먼저 실행하라.')
        return 1

    for feature in l2:
        code = feature['properties'].get('admin_code')
        name = feature['properties'].get('name') or RIVER_NAME.get(code, code)
        pts = vertices_of([feature])
        print(f'\n=== {name} ({code}) · 기존 geo.json L2 정점 {len(pts):,}개에서 잰 거리 ===')
        for key, path in layers.items():
            region, layer = key.split('|')
            if region != code:
                continue
            target = json.loads(path.read_text(encoding='utf-8'))['features']
            segs = segments_of(target)
            if not len(segs):
                print(f'  {layer}: 도형 없음')
                continue
            describe(f'{layer} ({len(target):,}건, 선분 {len(segs):,})',
                     point_to_segment(pts, segs))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
