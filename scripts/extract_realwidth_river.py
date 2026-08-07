"""국가기본도_실폭하천(국토지리정보원, EPSG:5179 SHP)에서 대상 3개 지자체 구간만 뽑아
EPSG:4326 GeoJSON 으로 변환한다.

사용법:
    python extract_realwidth_river.py <실폭하천.zip 또는 .shp 경로>

전국 218MB 를 통째로 메모리에 올리지 않고 스트리밍으로 훑으면서
geo.json 의 L3(행정경계) bbox 에 걸리는 도형만 남긴다.
"""
import json
import os
import sys
import zipfile
from pathlib import Path

import pyproj
import shapefile

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'build' / 'realwidth'
SRC = Path(sys.argv[1])

# 대상 지자체 bbox 는 seed 의 L3 실경계에서 가져온다(임의 좌표를 쓰지 않는다).
geo = json.loads((REPO / 'apps/web/public/seed/geo.json').read_text(encoding='utf-8'))


def flat(a, out):
    if isinstance(a[0], (int, float)):
        out.append(a)
    else:
        for x in a:
            flat(x, out)
    return out


REGIONS = {}
for f in geo['features']:
    p = f['properties']
    if p.get('layer') != 'L3':
        continue
    pts = flat(f['geometry']['coordinates'], [])
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    # 하천이 경계 밖으로 조금 흐르는 구간도 잡히도록 0.02도(약 2km) 여유를 준다.
    REGIONS[p.get('admin_code')] = (min(xs) - .02, min(ys) - .02, max(xs) + .02, max(ys) + .02)
print('대상 지자체 bbox(EPSG:4326):')
for code, b in REGIONS.items():
    print(f'  {code}  {[round(v,4) for v in b]}')

# --- SHP 위치 확보 -----------------------------------------------------------
OUT.mkdir(parents=True, exist_ok=True)
workdir = OUT / 'nrw_shp'
if SRC.suffix.lower() == '.zip':
    workdir.mkdir(exist_ok=True)
    with zipfile.ZipFile(SRC) as z:
        names = z.namelist()
        print(f'\nzip 내부 {len(names)}개 항목')
        z.extractall(workdir)
    shps = list(workdir.rglob('*.shp'))
else:
    shps = [SRC]
print('SHP:', [s.name for s in shps])

for shp in shps:
    prj = shp.with_suffix('.prj')
    prj_txt = prj.read_text(errors='ignore')[:120] if prj.exists() else '(없음)'
    print(f'\n=== {shp.name} ===')
    print('  .prj:', prj_txt)
    src_crs = 'EPSG:5179'
    if 'Bessel' in prj_txt:
        print('  경고: Bessel 계열 .prj — 5179 가정이 틀릴 수 있다. 좌표 확인 후 진행할 것')
    to4326 = pyproj.Transformer.from_crs(src_crs, 'EPSG:4326', always_xy=True)

    reader = shapefile.Reader(str(shp), encoding='cp949')
    print('  전체 도형:', len(reader), '| 필드:', [f[0] for f in reader.fields[1:]])
    # 대상 bbox 를 원본 좌표계로 되돌려 비교하면 도형마다 변환하지 않아도 된다.
    back = pyproj.Transformer.from_crs('EPSG:4326', src_crs, always_xy=True)
    boxes5179 = {}
    for code, (x0, y0, x1, y1) in REGIONS.items():
        a = back.transform(x0, y0)
        b = back.transform(x1, y1)
        boxes5179[code] = (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))

    picked = {code: [] for code in REGIONS}
    scanned = 0
    for sr in reader.iterShapeRecords():
        scanned += 1
        bb = getattr(sr.shape, 'bbox', None)
        if not bb:
            continue
        for code, (x0, y0, x1, y1) in boxes5179.items():
            if bb[0] > x1 or bb[2] < x0 or bb[1] > y1 or bb[3] < y0:
                continue
            picked[code].append(sr)
    print('  훑은 도형:', scanned)

    for code, rows in picked.items():
        if not rows:
            print(f'  {code}: 해당 없음')
            continue
        feats = []
        for sr in rows:
            g = sr.shape.__geo_interface__

            def conv(a):
                if isinstance(a[0], (int, float)):
                    x, y = to4326.transform(a[0], a[1])
                    return [round(x, 8), round(y, 8)]
                return [conv(v) for v in a]

            feats.append({'type': 'Feature',
                          'properties': dict(sr.record.as_dict()),
                          'geometry': {'type': g['type'], 'coordinates': conv(g['coordinates'])}})
        out = OUT / f'realwidth_{code}.geojson'
        out.write_text(json.dumps({'type': 'FeatureCollection', 'features': feats},
                                  ensure_ascii=False), encoding='utf-8')
        names = {str(v) for f in feats for k, v in f['properties'].items()
                 if isinstance(v, str) and v.strip()}
        print(f'  {code}: {len(feats)}개 -> {out.name} ({out.stat().st_size//1024} KB)')
        print(f'       속성값 표본: {list(sorted(names))[:8]}')
