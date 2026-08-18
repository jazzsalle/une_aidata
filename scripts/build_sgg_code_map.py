"""행정표준코드에서 시군구 코드표를 만든다. 소하천 대조표의 조인 축이 되는 표다.

    입력  GIS_data/행정구역/행정표준코드시스템_법정동 코드(브이월드)_260813갱신/LSCT_LAWDCD.zip
    출력  data/reference/sgg_code_map.json

NDMS 소하천 전체 목록에는 시군구 **이름**만 있고, 소하천구역 SHP 에는 시군구 **코드**만 있다.
둘을 잇는 표가 없어서 대조가 막혀 있었다. 이 표가 그 자리를 메운다.

원자료는 행정표준코드시스템 법정동코드다. `LAWD_CD`(10자리) 앞 5자리가 시군구코드이고,
`DEL_DT`(폐지일)와 `OLD_LAWDCD`(종전 코드)가 함께 들어 있어 **개편 이력까지 원자료 안에서
풀린다.** 그래서 이름 대조나 공간판정 같은 추정 수단을 쓰지 않는다.

맞춰야 하는 것이 셋이다.

1. **층위** — `SGG_NM` 은 자치구가 있는 시에서 구 단위다(`창원시 성산구` 48123). 반면 소하천구역
   SHP 의 `COL_ADM_SE` 는 시 단위를 쓴다(창원시 48120, 청주시 43110, 용인시 41460 — 188개 중
   181개가 끝자리 0). 그래서 구 코드 앞 4자리 + '0' 을 시 단위 rollup 으로 함께 넣는다.

2. **개편 시차** — 원자료마다 기준일이 다르다. 2026-06-30 에 전남·광주가 전남광주통합특별시(12)로
   통합됐고 인천에 영종구(28155)·서해구(28275)·검단구(28290)·제물포구(28125)가 생겼는데,
   NDMS 목록과 이 코드표는 개편 뒤 기준이고 소하천구역 SHP 는 전남·광주에 대해 아직 종전
   코드(29·46)를 쓴다. `OLD_LAWDCD` 로 종전 코드를 같은 시군구의 별칭으로 함께 담아 둘 다 받는다.

3. **승계가 갈리는 코드** — 종전 인천 중구(28110)는 영종구와 제물포구로, 서구(28260)는 검단구와
   서해구로 갈라졌다. 어느 쪽인지 코드만으로는 정할 수 없으므로 **표에 넣지 않고**
   `ambiguous_old_codes` 에 남겨 둔다. 지금 소하천구역 SHP 는 이 두 코드를 쓰지 않는다.

**없는 것을 만들지 않는다.** 풀리지 않는 시군구는 넣지 않고, 대조표가 `코드미상` 으로 남긴다.
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

from source_data import LAWD_CODE_ZIP, REPO, require  # noqa: E402

SRC = LAWD_CODE_ZIP
MEMBER = 'LSCT_LAWDCD.csv'
OUT = REPO / 'data' / 'reference' / 'sgg_code_map.json'

# 자치구가 있는 시. '창원시 성산구'(띄움)와 '청주시서원구'(붙임)가 원자료에 섞여 있다.
GU_IN_CITY = re.compile(r'^(.+?시)\s*[가-힣]+구$')


def read_codes() -> list[dict]:
    text = zipfile.ZipFile(require(SRC, '행정표준코드 법정동코드')).read(MEMBER).decode('cp949')
    return list(csv.DictReader(io.StringIO(text)))


def build(rows: list[dict]):
    """(시도, 시군구) → 코드 집합, 그리고 승계가 갈려 버린 종전 코드."""
    live = [r for r in rows if not (r.get('DEL_DT') or '').strip()]
    by_name: dict[tuple[str, str], set[str]] = defaultdict(set)
    for row in live:
        code = (row.get('LAWD_CD') or '').strip()
        if len(code) != 10 or not code.isdigit():
            continue
        by_name[(row['SIDO_NM'].strip(), row['SGG_NM'].strip())].add(code[:5])

    def add_rollup() -> None:
        for (sido, sgg), codes in list(by_name.items()):
            match = GU_IN_CITY.match(sgg)
            if match:
                by_name[(sido, match.group(1))] |= {c[:4] + '0' for c in codes}

    add_rollup()
    current = {code for codes in by_name.values() for code in codes}

    # 종전 코드를 같은 시군구의 별칭으로 담는다. 지금도 살아 있는 코드는 다른 시군구의 것이므로 뺀다.
    claimants: dict[str, set[tuple[str, str]]] = defaultdict(set)
    for row in live:
        old = (row.get('OLD_LAWDCD') or '').strip()
        if len(old) != 10 or not old.isdigit() or old[:5] in current:
            continue
        claimants[old[:5]].add((row['SIDO_NM'].strip(), row['SGG_NM'].strip()))

    ambiguous = []
    for old_code, owners in sorted(claimants.items()):
        if len(owners) > 1:
            ambiguous.append({
                'code': old_code,
                'claimed_by': [f'{sido} {sgg}' for sido, sgg in sorted(owners)],
                'reason': '한 시군구가 둘로 갈려 종전 코드의 승계가 정해지지 않는다. 표에 넣지 않는다.',
            })
            continue
        owner = next(iter(owners))
        by_name[owner].add(old_code)
    add_rollup()
    return by_name, ambiguous


def main() -> int:
    rows = read_codes()
    live = sum(1 for r in rows if not (r.get('DEL_DT') or '').strip())
    print(f'행정표준코드 법정동코드: {len(rows):,}행 (유효 {live:,} · 폐지 {len(rows) - live:,})')

    by_name, ambiguous = build(rows)
    codes = {code for values in by_name.values() for code in values}
    print(f'  시군구 항목 {len(by_name):,} · 코드 {len(codes):,}')
    for row in ambiguous:
        print(f"  승계 미정 {row['code']}: {' / '.join(row['claimed_by'])}")

    entries = [{'sido': sido, 'sgg': sgg, 'codes': sorted(values)}
               for (sido, sgg), values in sorted(by_name.items())]
    OUT.write_text(json.dumps({
        'dataset': 'sgg_code_map',
        'version': '2.0',
        'purpose': 'NDMS 소하천 전체 목록의 시군구 이름과 소하천구역 SHP 의 COL_ADM_SE 를 잇는다.',
        'source': {
            'name': '행정표준코드시스템 법정동코드 (브이월드 배포, 260813 갱신)',
            'file': f'행정구역/행정표준코드시스템_법정동 코드(브이월드)_260813갱신/{SRC.name}',
            'built_by': 'scripts/build_sgg_code_map.py',
        },
        'rule': [
            'codes 는 한 시군구가 가질 수 있는 코드 전부다. 현행 코드와 종전 코드를 함께 담는다.',
            '자치구가 있는 시는 구 코드와 시 코드를 함께 갖는다 — SHP 의 COL_ADM_SE 가 시 단위이기 때문이다.',
            '종전 코드는 지금 다른 시군구가 쓰고 있지 않을 때만 담는다(OLD_LAWDCD 기준).',
            '승계가 갈린 종전 코드는 ambiguous_old_codes 로 빼 두고 표에 넣지 않는다.',
            '풀리지 않는 시군구는 넣지 않는다 — 대조표가 코드미상으로 남긴다.',
        ],
        'note': (
            '2026-06-30 개편으로 전남·광주가 전남광주통합특별시(12)로 통합되고 인천에 영종구·서해구·'
            '검단구·제물포구가 생겼다. 소하천구역 SHP 는 전남·광주에 대해 아직 종전 코드(29·46)를 '
            '쓰므로 종전 코드를 별칭으로 담아 둘 다 받는다.'
        ),
        'ambiguous_old_codes': ambiguous,
        'entries': entries,
    }, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{OUT.relative_to(REPO)}: 시군구 {len(entries):,}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
