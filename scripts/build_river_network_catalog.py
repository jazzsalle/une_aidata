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
        rows.append({
            'river_code': str(fields.get('RIVCD_2') or '').strip(),
            'river_name': (fields.get('RIVNM_2') or '').strip(),
            'river_class': river_class,
            'bbox': [round(lon1, PRECISION), round(lat1, PRECISION),
                     round(lon2, PRECISION), round(lat2, PRECISION)],
            'nav': [round((lon1 + lon2) / 2, PRECISION), round((lat1 + lat2) / 2, PRECISION)],
            'nav_kind': 'extent',
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
                 'bbox 와 nav 는 화면 이동 전용이며 nav 는 bbox 중심이라 자료가 가진 좌표가 아니다.'),
        'key': 'river_code (RIVCD_2). 하천명은 중복이 있어 식별자로 쓰지 않는다.',
        'counts': {'국가하천': sum(1 for r in rows if r['river_class'] == '국가하천'),
                   '지방하천': sum(1 for r in rows if r['river_class'] == '지방하천')},
        'rivers': sorted(rows, key=lambda r: (r['river_class'], r['river_name'], r['river_code'])),
    }, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{OUT.name}: {len(rows):,}건 · {OUT.stat().st_size / 1024:,.0f} KB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
