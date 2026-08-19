"""전국 시군구 경계를 행정동 경계에서 합쳐 지도 행정경계 레이어(L3)로 만든다.

    입력  GIS_data/행정구역/행정동_GIS정보/BND_ADM_DONG_PG.shp   행정동 3,559 (EPSG:5186, 2025-06-30)
          GIS_data/행정구역/국가데이터처_법정동 연계정보_20250602.csv   행정구역코드(8) → 법정동코드(10)
          data/reference/sgg_code_map.json                          시군구코드 정본·대표코드
    출력  apps/web/public/reference/admin/SGG_{시군구}.geojson       시군구 1건 = 파일 1개

지역 선택기가 전국 229개 시군구로 넓어졌는데 행정경계는 시드 3곳(의왕·구미·남원)만 있어서
다른 시군구를 고르면 하천만 뜨고 경계가 없었다. 어디까지가 그 시군구인지 화면에서 알 수 없다.

**행정동을 시군구로 합친다.** 시군구 경계 자료를 따로 받는 대신, 이미 갖고 있는 행정동 경계
(하천 시군구 배정에 쓴 것과 같은 파일)를 시군구코드로 묶어 union 한다. 같은 원자료에서 나오므로
하천 배정과 경계가 서로 맞는다.

시군구코드는 하천 레이어와 같은 규칙으로 정한다 — 행정동 ADM_CD → 법정동 연계정보 → 시군구코드
→ `sgg_code_map` 의 primary_code. 구가 있는 시는 시 단위로 합친다(성남시 41130 하나, 분당·수정·
중원 셋이 아니다). 이 규칙이 하천 파일과 어긋나면 지도가 성남시를 골랐을 때 경계는 못 찾는다.

기준일 시차가 하나 있다. 행정동 경계는 2025-06-30 이고 2026-06-30 개편 이전이라 인천 중구(28110)
·서구(28260)가 갈리기 전이다. 코드표에는 이 종전 코드가 없다(승계가 갈려 `ambiguous_old_codes`).
하천 레이어는 `fix_ngii_legacy_regions.py` 가 법정동으로 갈라 현행 구(영종·제물포·검단·서해)에
넣었으므로 경계도 같은 근거로 가른다 — 행정동의 법정동코드 → 행정표준코드 `OLD_LAWDCD` → 현행
시군구. 행정동 단위로 갈리므로 정확하다(행정동은 구를 넘지 않는다).

시군구별 파일로 나눈 것은 크기 때문이다. 전국 한 파일은 단순화해도 수십 MB 라 첫 화면이 무겁고,
지도는 어차피 고른 시군구 하나만 보여 준다. 하천 레이어와 같은 방식이다.
"""
from __future__ import annotations

import csv
import io
import json
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

import pyproj
import shapefile
from shapely.geometry import MultiPolygon, Polygon, mapping
from shapely.ops import transform, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from source_data import GIS_DATA, LAWD_CODE_ZIP, REPO, require  # noqa: E402

DONG_SHP = GIS_DATA / '행정구역' / '행정동_GIS정보' / 'BND_ADM_DONG_PG'
LINK_CSV = GIS_DATA / '행정구역' / '국가데이터처_법정동 연계정보_20250602.csv'
SGG_MAP = REPO / 'data' / 'reference' / 'sgg_code_map.json'
OUT_DIR = REPO / 'apps' / 'web' / 'public' / 'reference' / 'admin'

TO4326 = pyproj.Transformer.from_crs('EPSG:5186', 'EPSG:4326', always_xy=True).transform
#: 단순화 허용오차(m, EPSG:5186 기준). 시군구 경계는 시군구 축척에서 보는 것이라 20 m 면 차이가 없다.
TOLERANCE_M = 20.0
PRECISION = 5


def legal_of_adm_cd() -> dict:
    """행정구역코드(8) → 법정동코드(10). build_river_network_regions.py 와 같은 연계표."""
    table: dict = {}
    with require(LINK_CSV, '법정동 연계정보').open(encoding='cp949', newline='') as handle:
        for row in csv.DictReader(handle):
            legal = (row.get('법정동코드') or '').strip()
            if len(legal) == 10 and legal.isdigit():
                table.setdefault((row.get('행정구역코드') or '').strip(), legal)
    return table


def legal_to_current() -> dict:
    """종전 법정동코드(10) → 현행 시군구코드(5). fix_ngii_legacy_regions.py 와 같은 근거(OLD_LAWDCD)."""
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


def primary_of() -> tuple[dict, dict]:
    """코드 → 대표 코드, 대표 코드 → (시도, 시군구). 하천 레이어 파일명과 같은 규칙."""
    payload = json.loads(require(SGG_MAP, '시군구 코드표').read_text(encoding='utf-8'))
    table: dict = {}
    names: dict = {}
    for entry in payload['entries']:
        primary = entry['primary_code']
        for code in entry['codes']:
            table[code] = primary
        # 구 항목은 시 코드로 올라가므로 이름은 시 항목의 것을 남긴다.
        if entry['codes'] and primary in entry['codes']:
            names[primary] = (entry['sido'], entry['sgg'])
    return table, names


def main() -> int:
    adm_to_legal = legal_of_adm_cd()
    old_legal_to_sgg = legal_to_current()
    to_primary, names = primary_of()

    def sgg_code_of(adm: str):
        legal = adm_to_legal.get(adm)
        if not legal:
            return None
        code = to_primary.get(legal[:5])
        if code:
            return code
        # 개편으로 갈린 종전 시군구 — 법정동이 지금 어느 구로 갔는지로 정한다.
        return to_primary.get(old_legal_to_sgg.get(legal, ''))

    reader = shapefile.Reader(str(require(Path(str(DONG_SHP) + '.shp'), '행정동 경계').with_suffix('')),
                              encoding='cp949')
    grouped: dict = defaultdict(list)
    unresolved = 0
    for shape, record in zip(reader.iterShapes(), reader.iterRecords()):
        adm = (record['ADM_CD'] or '').strip()
        code = sgg_code_of(adm)
        if not code:
            unresolved += 1
            continue
        points = shape.points
        bounds = list(shape.parts) + [len(points)]
        rings = [points[bounds[i]:bounds[i + 1]] for i in range(len(shape.parts))]
        # 첫 링이 외곽, 나머지는 구멍이라는 보장이 없어서(섬처럼 조각이 여럿) 링마다 폴리곤으로 두고
        # union 이 겹침을 정리하게 둔다.
        for ring in rings:
            if len(ring) >= 4:
                grouped[code].append(Polygon(ring))
    print(f'행정동 {reader.numRecords:,} → 시군구 {len(grouped)} · 코드 못 푼 행정동 {unresolved}')

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob('SGG_*.geojson'):
        stale.unlink()

    total_bytes = 0
    for code, polygons in sorted(grouped.items()):
        merged = unary_union(polygons).buffer(0)
        merged = merged.simplify(TOLERANCE_M, preserve_topology=True)
        if merged.geom_type == 'Polygon':
            merged = MultiPolygon([merged])
        merged = transform(TO4326, merged)
        sido, sgg = names.get(code, ('', ''))
        feature = {
            'type': 'Feature',
            'id': f'SGG:{code}',
            'geometry': json.loads(json.dumps(mapping(merged)), parse_float=lambda s: round(float(s), PRECISION)),
            'properties': {
                'id': f'SGG:{code}',
                'layer': 'L3',
                'admin_code': code,
                'name': f'{sido} {sgg}'.strip(),
                'sido': sido,
                'sgg': sgg,
                'provisional': False,
                'source': '통계청 행정동 경계(BND_ADM_DONG_PG, 2025-06-30) 를 시군구로 합침',
                'source_kind': 'derived',
                'derived_from': '행정동 경계 union · 20 m 단순화',
            },
        }
        out = OUT_DIR / f'SGG_{code}.geojson'
        text = json.dumps({'type': 'FeatureCollection', 'features': [feature]}, ensure_ascii=False, separators=(',', ':'))
        out.write_text(text, encoding='utf-8')
        total_bytes += len(text.encode('utf-8'))

    print(f'{OUT_DIR.relative_to(REPO)}: 시군구 {len(grouped)} 파일 · {total_bytes / 1024 / 1024:.1f} MB · 단순화 {TOLERANCE_M} m')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
