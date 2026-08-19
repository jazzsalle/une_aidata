"""승계가 갈린 종전 시군구코드로 떨어진 국가기본도 폴리곤을 현행 시군구로 다시 나눈다.

    입력  apps/web/public/reference/rivers/TN_RIVER_{BNDRY,BT}_{종전코드}.geojson
    출력  같은 폴더의 현행 코드 파일들 (종전 코드 파일은 지운다)

`build_ngii_river_layers.py` 는 행정동 경계로 시군구를 정하는데, 그 경계의 기준일이
2025-06-30 이라 2026-06-30 개편 이전이다. 그래서 인천 중구(28110)·서구(28260) 처럼
**개편으로 둘로 갈린 시군구**는 종전 코드로 떨어지고, 시군구 코드표에는 그 코드가 없다
(승계가 정해지지 않아 `ambiguous_old_codes` 로 빼 두었다).

가리는 근거는 법정동이다. 행정표준코드 법정동코드의 유효행에는 `OLD_LAWDCD`(종전 법정동코드)가
있어서 **종전 법정동 → 현행 시군구**를 원자료로 이을 수 있다. 행정동 경계에서 그 행정동의
법정동코드를 얻고, 그 법정동이 지금 어느 구로 갔는지 보면 된다.

풀리지 않는 폴리곤은 **버린다.** 어느 구인지 모르는 채로 어느 한쪽에 넣으면 지도가 틀린 말을 한다.
"""
from __future__ import annotations

import csv
import io
import json
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pyproj
import shapefile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_ngii_river_layers import DONG_CELL_M, DONG_SHP, LINK_CSV, SGG_MAP, contains  # noqa: E402
from source_data import LAWD_CODE_ZIP, REPO, require  # noqa: E402

DEST = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'
TO5186 = pyproj.Transformer.from_crs('EPSG:4326', 'EPSG:5186', always_xy=True).transform


def ambiguous_codes() -> set:
    payload = json.loads(require(SGG_MAP, '시군구 코드표').read_text(encoding='utf-8'))
    return {row['code'] for row in payload.get('ambiguous_old_codes', ())}


def legal_to_current() -> dict:
    """종전 법정동코드(10) → 현행 시군구코드(5). 행정표준코드의 OLD_LAWDCD 가 근거다."""
    text = zipfile.ZipFile(require(LAWD_CODE_ZIP, '행정표준코드 법정동코드')).read('LSCT_LAWDCD.csv').decode('cp949')
    table: dict = {}
    for row in csv.DictReader(io.StringIO(text)):
        if (row.get('DEL_DT') or '').strip():
            continue
        old = (row.get('OLD_LAWDCD') or '').strip()
        new = (row.get('LAWD_CD') or '').strip()
        if len(old) == 10 and len(new) == 10:
            table[old] = new[:5]
    return table


def dong_index():
    """행정동 폴리곤 + 그 행정동의 법정동코드(10). 연계정보가 두 체계를 잇는다."""
    adm_to_legal: dict = {}
    with require(LINK_CSV, '법정동 연계정보').open(encoding='cp949', newline='') as handle:
        for row in csv.DictReader(handle):
            legal = (row.get('법정동코드') or '').strip()
            if len(legal) == 10 and legal.isdigit():
                adm_to_legal.setdefault((row.get('행정구역코드') or '').strip(), legal)

    reader = shapefile.Reader(str(DONG_SHP), encoding='cp949')
    dongs = []
    for shape, record in zip(reader.shapes(), reader.records()):
        legal = adm_to_legal.get((record['ADM_CD'] or '').strip())
        if not legal:
            continue
        points = np.asarray(shape.points, dtype=float)
        bounds = list(shape.parts) + [len(points)]
        rings = [points[bounds[i]:bounds[i + 1]] for i in range(len(shape.parts))]
        dongs.append((shape.bbox, rings, legal))
    grid: dict = defaultdict(list)
    for index, (box, _rings, _legal) in enumerate(dongs):
        for gx in range(int(box[0] // DONG_CELL_M), int(box[2] // DONG_CELL_M) + 1):
            for gy in range(int(box[1] // DONG_CELL_M), int(box[3] // DONG_CELL_M) + 1):
                grid[(gx, gy)].append(index)
    return dongs, grid


def representative(geometry) -> tuple:
    points: list = []
    stack = [geometry['coordinates']]
    while stack:
        item = stack.pop()
        if item and isinstance(item[0], (int, float)):
            points.append(item)
        else:
            stack.extend(item)
    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    return ((min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2)


def main() -> int:
    stale = ambiguous_codes()
    targets = [path for path in DEST.glob('TN_RIVER_*.geojson')
               if path.stem.rsplit('_', 1)[-1] in stale]
    if not targets:
        print('승계 미정 코드로 남은 파일이 없다.')
        return 0
    print(f'다시 나눌 파일 {len(targets)}개: {[p.name for p in targets]}')

    promote = legal_to_current()
    dongs, grid = dong_index()
    print(f'  행정동 {len(dongs):,} · 종전 법정동 매핑 {len(promote):,}')

    moved: Counter = Counter()
    dropped = 0
    for path in targets:
        kind = path.stem.rsplit('_', 1)[0]
        features = json.loads(path.read_text(encoding='utf-8'))['features']
        grouped: dict = defaultdict(list)
        for feature in features:
            lon, lat = representative(feature['geometry'])
            x, y = TO5186(lon, lat)
            code = None
            for index in grid.get((int(x // DONG_CELL_M), int(y // DONG_CELL_M)), ()):
                box, rings, legal = dongs[index]
                if not (box[0] <= x <= box[2] and box[1] <= y <= box[3]):
                    continue
                if contains(rings, x, y):
                    code = promote.get(legal)
                    break
            if not code:
                # 어느 구로 갔는지 원자료로 풀리지 않는다. 한쪽에 넣지 않고 버린다.
                dropped += 1
                continue
            feature['properties']['admin_code'] = code
            grouped[code].append(feature)
            moved[code] += 1

        for code, rows in grouped.items():
            out = DEST / f'{kind}_{code}.geojson'
            existing = json.loads(out.read_text(encoding='utf-8'))['features'] if out.exists() else []
            out.write_text(json.dumps({'type': 'FeatureCollection', 'features': existing + rows},
                                      ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        path.unlink()
        split = {code: len(rows) for code, rows in sorted(grouped.items())}
        print(f'  {path.name} → {split} 로 나눔' if split else f'  {path.name} → 전부 미해결')

    print(f'\n옮긴 폴리곤 {sum(moved.values()):,} · 버린 폴리곤 {dropped:,}')
    print(f'  현행 시군구별: {dict(moved.most_common())}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
