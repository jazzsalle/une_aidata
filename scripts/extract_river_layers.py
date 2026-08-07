"""국가기본도 하천 3종(국토지리정보원, EPSG:5179 SHP)에서 대상 3개 지자체 구간만 뽑아
EPSG:4326 GeoJSON 으로 변환한다.

    TN_RIVER_BT      실폭하천   Polygon    물길의 실제 폭
    TN_RIVER_BNDRY   하천경계   Polygon    제방·둔치를 포함한 하천 경계
    TN_RIVER_CTLN    하천중심선 PolyLine   물길 한가운데(유일하게 RIVER_NM 을 가진다)

사용법:
    python scripts/extract_river_layers.py [원본폴더 ...]

인자를 주지 않으면 리포 루트의 `국가기본도_*` 폴더에서 zip 을 찾는다.
전국 자료를 통째로 메모리에 올리지 않고 스트리밍으로 훑으면서
`geo.json` 의 L3(행정경계) bbox 에 걸리는 도형만 남긴다.

산출물은 `build/river/` 아래에 떨어진다(gitignore 대상). 앱에 반입할지는
정합 비교 결과를 보고 별도로 판단한다 — 이 스크립트는 반입까지 하지 않는다.
"""
from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

import pyproj
import shapefile

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'build' / 'river'
SRC_DIR = OUT / 'src'

# 원본 .prj 실측값: Korea_2000_Korea_Unified_Coordinate_System
# (FE 1000000 / FN 2000000 / CM 127.5 / k 0.9996 / lat0 38) == EPSG:5179
SRC_CRS = 'EPSG:5179'
EXPECTED_PRJ = ('False_Easting",1000000', 'False_Northing",2000000',
                'Central_Meridian",127.5', 'Scale_Factor",0.9996')

# 레이어 코드 → (표시명, 의미). 의미는 riverLayerSources.ts 의 RiverSemantic 과 같은 낱말을 쓴다.
LAYERS = {
    'TN_RIVER_BT': ('실폭하천', 'channel'),
    'TN_RIVER_BNDRY': ('하천경계', 'zone'),
    'TN_RIVER_CTLN': ('하천중심선', 'centerline'),
}
# 하천이 행정경계 밖으로 조금 흐르는 구간도 잡히도록 주는 여유(도). 약 2km.
MARGIN_DEG = 0.02


def flat(a, out):
    if isinstance(a[0], (int, float)):
        out.append(a)
    else:
        for x in a:
            flat(x, out)
    return out


def target_regions() -> dict[str, tuple[float, float, float, float]]:
    """대상 지자체 bbox 는 seed 의 L3 실경계에서 가져온다(임의 좌표를 쓰지 않는다)."""
    geo = json.loads((REPO / 'apps/web/public/seed/geo.json').read_text(encoding='utf-8'))
    regions: dict[str, tuple[float, float, float, float]] = {}
    for feature in geo['features']:
        props = feature['properties']
        if props.get('layer') != 'L3':
            continue
        pts = flat(feature['geometry']['coordinates'], [])
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        regions[props['admin_code']] = (min(xs) - MARGIN_DEG, min(ys) - MARGIN_DEG,
                                        max(xs) + MARGIN_DEG, max(ys) + MARGIN_DEG)
    return regions


def find_zips(roots: list[Path]) -> list[Path]:
    found: list[Path] = []
    for root in roots:
        found.extend(sorted(root.glob('*.zip')) if root.is_dir() else [root])
    return found


def ensure_extracted(zip_path: Path) -> Path:
    """zip 안의 SHP 세트를 레이어명 폴더로 풀어 둔다. 이미 있으면 다시 풀지 않는다."""
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        shp = next((n for n in names if n.lower().endswith('.shp')), None)
        if not shp:
            raise SystemExit(f'{zip_path.name}: .shp 가 없다')
        layer = Path(shp).stem
        workdir = SRC_DIR / layer
        target = workdir / Path(shp).name
        if target.exists() and target.stat().st_size == z.getinfo(shp).file_size:
            print(f'  이미 풀려 있음: {workdir}')
            return target
        workdir.mkdir(parents=True, exist_ok=True)
        print(f'  압축 해제 → {workdir}')
        z.extractall(workdir)
        return target


def check_prj(shp: Path) -> None:
    prj = shp.with_suffix('.prj')
    text = prj.read_text(errors='ignore') if prj.exists() else ''
    missing = [token for token in EXPECTED_PRJ if token not in text.replace(' ', '')]
    if missing:
        # 좌표계 가정이 틀리면 결과 전체가 조용히 어긋난다. 추측으로 넘어가지 않는다.
        raise SystemExit(f'{shp.name}: .prj 가 EPSG:5179 파라미터와 다르다 (미일치 {missing}).\n'
                         f'  .prj = {text[:300]}')


def convert(coords, transform):
    if isinstance(coords[0], (int, float)):
        x, y = transform(coords[0], coords[1])
        return [round(x, 8), round(y, 8)]
    return [convert(c, transform) for c in coords]


def extract(shp: Path, regions: dict[str, tuple[float, float, float, float]]) -> None:
    layer = shp.stem
    label, semantic = LAYERS.get(layer, (layer, 'channel'))
    check_prj(shp)

    to4326 = pyproj.Transformer.from_crs(SRC_CRS, 'EPSG:4326', always_xy=True).transform
    back = pyproj.Transformer.from_crs('EPSG:4326', SRC_CRS, always_xy=True).transform
    # 대상 bbox 를 원본 좌표계로 되돌려 비교하면 도형마다 변환하지 않아도 된다.
    boxes: dict[str, tuple[float, float, float, float]] = {}
    for code, (x0, y0, x1, y1) in regions.items():
        ax, ay = back(x0, y0)
        bx, by = back(x1, y1)
        boxes[code] = (min(ax, bx), min(ay, by), max(ax, bx), max(ay, by))

    reader = shapefile.Reader(str(shp), encoding='cp949')
    total = len(reader)
    fields = [f[0] for f in reader.fields[1:]]
    print(f'\n=== {layer} ({label}) ===')
    print(f'  전체 {total:,}건 · 필드 {fields}')

    # 1단계: 도형 bbox 만 보고 대상 인덱스를 고른다. 중심선 dbf 는 832MB 라
    #        전건 레코드 파싱을 피해야 한다.
    hits: dict[str, list[int]] = {code: [] for code in regions}
    for index, shape in enumerate(reader.iterShapes()):
        bbox = getattr(shape, 'bbox', None)
        if not bbox:
            continue
        for code, (x0, y0, x1, y1) in boxes.items():
            if bbox[0] > x1 or bbox[2] < x0 or bbox[1] > y1 or bbox[3] < y0:
                continue
            hits[code].append(index)
        if index and index % 500000 == 0:
            print(f'    스캔 {index:,}/{total:,}')

    # 2단계: 걸린 것만 레코드를 읽어 변환한다.
    merged = []
    for code, indexes in hits.items():
        if not indexes:
            print(f'  {code}: 해당 없음')
            continue
        features = []
        for index in indexes:
            record = reader.record(index)
            geometry = reader.shape(index).__geo_interface__
            props = {k: (v.isoformat() if hasattr(v, 'isoformat') else v)
                     for k, v in record.as_dict().items()}
            props['admin_code'] = code
            props['source_layer'] = layer
            props['semantic'] = semantic
            features.append({
                'type': 'Feature',
                'id': f"{layer}:{props.get('NF_ID') or index}",
                'properties': props,
                'geometry': {'type': geometry['type'],
                             'coordinates': convert(geometry['coordinates'], to4326)},
            })
        path = OUT / f'{layer}_{code}.geojson'
        path.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                                   ensure_ascii=False), encoding='utf-8')
        names = sorted({str(f['properties'].get('RIVER_NM', '')).strip()
                        for f in features} - {''})
        print(f'  {code}: {len(features):,}건 → {path.name} ({path.stat().st_size // 1024:,} KB)')
        if names:
            print(f'       하천명: {names[:10]}{" ..." if len(names) > 10 else ""}')
        merged.extend(features)

    if merged:
        path = OUT / f'{layer}.geojson'
        path.write_text(json.dumps({'type': 'FeatureCollection', 'features': merged},
                                   ensure_ascii=False), encoding='utf-8')
        print(f'  합본: {path.name} ({path.stat().st_size // 1024:,} KB, {len(merged):,}건)')


def main() -> int:
    roots = [Path(a) for a in sys.argv[1:]] or sorted(REPO.glob('국가기본도_*'))
    zips = find_zips(roots)
    if not zips:
        print('원본 zip 을 찾지 못했다. 폴더 경로를 인자로 주거나 리포 루트에 국가기본도_* 폴더를 두라.')
        return 1

    regions = target_regions()
    print('대상 지자체 bbox(EPSG:4326):')
    for code, box in regions.items():
        print(f'  {code}  {[round(v, 4) for v in box]}')

    OUT.mkdir(parents=True, exist_ok=True)
    for zip_path in zips:
        print(f'\n--- {zip_path.name} ---')
        extract(ensure_extracted(zip_path), regions)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
