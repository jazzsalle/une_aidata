"""행안부 NDMS 소하천 전체 목록을 기준으로 소하천구역 SHP 보유 여부를 행 단위로 판정한다.

    입력  소하천 전체 목록/소하천대장_20260814_좌표추가.xlsx      (행안부 NDMS 사업단 제공)
          소하천_소하천구역(연속주제)+브이월드/LSMD_CONT_UJ301_{시도}.zip  (17개 시도, _5174_ 제외)
          data/reference/sgg_code_map.json                    (있으면 정본, 없으면 아래 파생표)
    출력  build/sochun/crosscheck_rows.csv        목록 한 행 = 대조표 한 행
          build/sochun/crosscheck_summary.csv     시군구별 요약
          build/sochun/unmatched_shp.csv          목록에 대응이 없는 SHP 쪽
          build/sochun/crosscheck_report.md       docs/32 가 인용하는 수치 표 (생성물)
          build/sochun/sgg_code_map_derived.json  정본이 없을 때 쓴 파생 코드표

**이 산출물은 검증용이고 앱에 반입하지 않는다.** `npm run data:rivers` 파이프라인에 넣지 않는 이유다.

판정 규칙(근거는 docs/32_sochun_ledger_mapping.md):
  보유           시군구코드가 같고 하천명이 같다
  경계걸침_후보   코드는 다르지만 동명 형상이 목록 시군구 형상에서 ADJACENT_KM 이내에 있다
  미보유         그 외
  코드미상       목록의 시군구를 코드로 바꾸지 못했다 — 추정하지 않고 이 상태로 남긴다

시군구를 넘는 명칭 일치를 그대로 보유로 치지 않는 이유: 전국 SHP 고유 하천명 12,477종 중
2,595종이 2개 이상 시군구에 같은 이름으로 존재한다(절골천 66곳, 큰골천 57곳). 실측하면 코드가
다른 동명 형상까지의 거리는 중앙값 26.2 km 라 대부분 경계 걸침이 아니라 동명이인이다.
"""
from __future__ import annotations

import csv
import io
import json
import math
import re
import struct
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

import pyproj
import shapefile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_sochun_layers import EXPECTED_PRJ, SRC_CRS, stream_name_of  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
LEDGER = REPO / '소하천 전체 목록' / '소하천대장_20260814_좌표추가.xlsx'
SRC_DIR = REPO / '소하천_소하천구역(연속주제)+브이월드'
OFFICIAL_MAP = REPO / 'data' / 'reference' / 'sgg_code_map.json'
OUT = REPO / 'build' / 'sochun'

TO4326 = pyproj.Transformer.from_crs(SRC_CRS, 'EPSG:4326', always_xy=True).transform

# 코드가 다른 동명 형상을 '경계 걸침 후보'로 볼 최대 거리. 전국 950건 중 26건만 여기 걸린다.
ADJACENT_KM = 3.0

# zip 파일명(시도) → NDMS 목록의 `시도` 표기. 목록은 광주와 전남을 '전남광주통합특별시' 한 값으로
# 쓰므로 두 zip 을 한 묶음으로 본다.
PROVINCE_TO_SIDO = {
    '강원특별자치도': '강원특별자치도', '경기': '경기도', '경남': '경상남도', '경북': '경상북도',
    '광주': '전남광주통합특별시', '대구': '대구광역시', '대전': '대전광역시', '부산': '부산광역시',
    '서울': '서울특별시', '세종': '세종특별자치시', '울산': '울산광역시', '인천': '인천광역시',
    '전남': '전남광주통합특별시', '전북특별자치도': '전북특별자치도', '제주': '제주특별자치도',
    '충남': '충청남도', '충북': '충청북도',
}

SHEET_NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
LEDGER_COLUMNS = (
    'sido', 'sgg', 'sugye', 'name', 'start_addr', 'end_addr',
    'length_m', 'basin_km2', 'levee_m', 'px', 'py', 'ex', 'ey',
)


def normalize(name: str) -> str:
    """조인용 정규화. 공백만 지운다 — '구기1천'과 '구기천'은 다른 하천이라 숫자를 건드리지 않는다."""
    return re.sub(r'\s+', '', name or '')


# ---------------------------------------------------------------- NDMS 목록 읽기

def read_ledger() -> list[dict]:
    """xlsx 를 표준 라이브러리만으로 읽는다. openpyxl·pandas 를 requirements 에 새로 넣지 않는다."""
    if not LEDGER.exists():
        raise FileNotFoundError(f'{LEDGER} 가 없다. 행안부 NDMS 소하천 전체 목록을 두어야 한다.')
    archive = zipfile.ZipFile(LEDGER)

    shared: list[str] = []
    if 'xl/sharedStrings.xml' in archive.namelist():
        with archive.open('xl/sharedStrings.xml') as handle:
            for _, element in ET.iterparse(handle, events=('end',)):
                if element.tag == SHEET_NS + 'si':
                    shared.append(''.join(node.text or '' for node in element.iter(SHEET_NS + 't')))
                    element.clear()

    def column_index(ref: str) -> int:
        letters = re.match(r'([A-Z]+)', ref).group(1)
        index = 0
        for letter in letters:
            index = index * 26 + ord(letter) - 64
        return index - 1

    rows: list[dict] = []
    with archive.open('xl/worksheets/sheet1.xml') as handle:
        first = True
        for _, element in ET.iterparse(handle, events=('end',)):
            if element.tag != SHEET_NS + 'row':
                continue
            cells: dict[int, str] = {}
            for cell in element.findall(SHEET_NS + 'c'):
                kind = cell.get('t')
                value_node = cell.find(SHEET_NS + 'v')
                if value_node is None:
                    inline = cell.find(SHEET_NS + 'is')
                    value = ''.join(n.text or '' for n in inline.iter(SHEET_NS + 't')) if inline is not None else None
                else:
                    value = value_node.text
                    if kind == 's' and value is not None:
                        value = shared[int(value)]
                if value not in (None, ''):
                    cells[column_index(cell.get('r'))] = value
            element.clear()
            if first:  # 머리글
                first = False
                continue
            rows.append({LEDGER_COLUMNS[i]: v for i, v in cells.items() if i < len(LEDGER_COLUMNS)})
    return rows


# ---------------------------------------------------------------- SHP 읽기

def shape_bboxes(raw: bytes) -> list:
    """.shp 에서 레코드별 bbox 만 뽑는다.

    정점을 전부 파싱하면 전국 460 MB 를 훑게 되는데, 여기서 필요한 건 형상의 대략 위치뿐이다
    (경계 걸침 판정용). 레코드 헤더의 길이로 건너뛰며 bbox 32 바이트만 읽는다.
    """
    boxes: list = []
    offset, size = 100, len(raw)
    while offset + 8 <= size:
        _, content_words = struct.unpack('>ii', raw[offset:offset + 8])
        offset += 8
        end = offset + content_words * 2
        shape_type = struct.unpack('<i', raw[offset:offset + 4])[0]
        if shape_type in (3, 5, 8, 13, 15, 23, 25):
            boxes.append(struct.unpack('<4d', raw[offset + 4:offset + 36]))
        elif shape_type in (1, 11, 21):
            x, y = struct.unpack('<2d', raw[offset + 4:offset + 20])
            boxes.append((x, y, x, y))
        else:  # 0 = Null shape
            boxes.append(None)
        offset = end
    return boxes


def province_zips() -> list:
    found = []
    for path in sorted(SRC_DIR.glob('LSMD_CONT_UJ301_*.zip')):
        province = path.stem[len('LSMD_CONT_UJ301_'):]
        if province.startswith('5174_'):  # 구 측지계 배포본은 쓰지 않는다.
            continue
        if province not in PROVINCE_TO_SIDO:
            raise ValueError(f'{path.name}: PROVINCE_TO_SIDO 에 없는 시도다. 표를 갱신하라.')
        found.append((province, path))
    if not found:
        raise FileNotFoundError(f'{SRC_DIR} 에 소하천구역 zip 이 없다.')
    return found


def read_province(path: Path) -> list:
    """폴리곤 1건 = dict 하나. 이름은 build_sochun_layers 와 같은 규칙으로 뽑는다."""
    archive = zipfile.ZipFile(path)
    member: dict = {}
    for info in archive.infolist():
        try:
            name = info.filename.encode('cp437').decode('cp949')
        except Exception:
            name = info.filename
        member[Path(name).suffix.lower()] = info.filename
    prj = archive.read(member['.prj']).decode('utf-8', 'replace')
    if not all(token in prj for token in EXPECTED_PRJ):
        raise ValueError(f'{path.name} 의 좌표계가 {SRC_CRS} 가정과 다르다: {prj[:120]}')

    boxes = shape_bboxes(archive.read(member['.shp']))
    records = shapefile.Reader(dbf=io.BytesIO(archive.read(member['.dbf'])), encoding='cp949').records()
    if len(boxes) != len(records):
        raise ValueError(f'{path.name}: 도형 {len(boxes)}건과 속성 {len(records)}건이 어긋난다.')

    out = []
    for box, record in zip(boxes, records):
        fields = record.as_dict()
        alias = (fields.get('ALIAS') or '').strip()
        remark = (fields.get('REMARK') or '').strip()
        from_alias = stream_name_of(alias)
        from_remark = stream_name_of(remark)
        if from_alias and from_remark:
            source = 'BOTH'
        elif from_alias:
            source = 'ALIAS'
        elif from_remark:
            source = 'REMARK'
        else:
            source = ''
        if box is None:
            lon = lat = None
        else:
            lon1, lat1 = TO4326(box[0], box[1])
            lon2, lat2 = TO4326(box[2], box[3])
            lon, lat = (lon1 + lon2) / 2, (lat1 + lat2) / 2
        out.append({
            'code': (fields.get('COL_ADM_SE') or '').strip(),
            'mnum': (fields.get('MNUM') or '').strip(),
            'name': normalize(from_alias or from_remark),
            'name_source': source,
            'lon': lon,
            'lat': lat,
        })
    return out


# ---------------------------------------------------------------- 시군구 코드표

def load_official_map():
    """정본 코드표를 (시도, 시군구) → 코드집합 으로 돌려준다.

    한 시군구가 코드를 여럿 갖는다 — 자치구가 있는 시는 시 코드와 구 코드를, 개편을 겪은
    시군구는 현행 코드와 종전 코드를 함께 갖는다. 자세한 규칙은 코드표의 `rule` 에 있다.
    """
    if not OFFICIAL_MAP.exists():
        return None
    payload = json.loads(OFFICIAL_MAP.read_text(encoding='utf-8'))
    return {(e['sido'], e['sgg']): set(e['codes']) for e in payload['entries']}


def derive_map(ledger_names, shp_names):
    """정본 코드표가 없을 때 하천명 집합 중첩으로 시군구 ↔ COL_ADM_SE 를 잇는다.

    같은 시군구라면 소하천명 100여 개가 거의 그대로 겹친다. 중첩이 큰 쌍부터 1:1 로 확정하고,
    남는 것은 확정하지 않는다 — **추정으로 채우지 않는다.**
    """
    mapping: dict = {}
    detail: list = []
    for province in sorted(set(ledger_names) | set(shp_names)):
        by_sgg = ledger_names.get(province, {})
        by_code = shp_names.get(province, {})
        pairs = []
        for sgg, left in by_sgg.items():
            for code, right in by_code.items():
                common = len(left & right)
                if common:
                    pairs.append((common, common / max(1, min(len(left), len(right))), sgg, code))
        pairs.sort(reverse=True)
        used_sgg: set = set()
        used_code: set = set()
        for common, ratio, sgg, code in pairs:
            if sgg in used_sgg or code in used_code:
                continue
            used_sgg.add(sgg)
            used_code.add(code)
            mapping[(province, sgg)] = code
            detail.append({'sido': province, 'sgg': sgg, 'code': code, 'common_names': common,
                           'ledger_names': len(by_sgg[sgg]), 'shp_names': len(by_code[code]),
                           'confidence': round(ratio, 3)})
        for sgg in sorted(set(by_sgg) - used_sgg):
            detail.append({'sido': province, 'sgg': sgg, 'code': None, 'common_names': 0,
                           'ledger_names': len(by_sgg[sgg]), 'shp_names': 0, 'confidence': 0.0})
        for code in sorted(set(by_code) - used_code):
            detail.append({'sido': province, 'sgg': None, 'code': code, 'common_names': 0,
                           'ledger_names': 0, 'shp_names': len(by_code[code]), 'confidence': 0.0})
    return mapping, detail


# ---------------------------------------------------------------- 판정

def km_between(a, b) -> float:
    """한반도 위도대에서 충분한 근사. 경도 1도 ≈ 88.9 km, 위도 1도 ≈ 111.0 km."""
    return math.hypot((a[0] - b[0]) * 88.9, (a[1] - b[1]) * 111.0)


def write_report(path: Path, *, out_rows: list, polygons: list, status_count: Counter,
                 summary: dict, unmatched_names: list, nameless_by_code: Counter) -> None:
    """docs/32 가 옮겨 적던 표를 생성한다.

    문서에 손으로 적어 둔 수치는 원자료가 갱신되면 조용히 낡는다 — 실제로 그렇게 어긋났다.
    집계는 main() 이 이미 갖고 있는 값을 그대로 쓰고 여기서는 표로 옮기기만 한다.
    """
    total = len(out_rows)
    lines = [
        '# 소하천 대조 결과 리포트',
        '',
        '`scripts/build_sochun_ledger_crosscheck.py` 가 생성한다. **손으로 고치지 않는다.**',
        '`docs/32_sochun_ledger_mapping.md` 의 수치는 이 파일과 맞춰야 한다.',
        '',
        '## 판정 결과',
        '',
        '| 상태 | 행 | 비율 |',
        '|---|---:|---:|',
    ]
    for status in ('보유', '경계걸침_후보', '미보유', '코드미상'):
        count = status_count[status]
        lines.append(f'| `{status}` | {count:,} | {count / total * 100:.1f}% |')
    lines += [f'| **합계** | **{total:,}** | 100.0% |', '']

    by_sido: dict = defaultdict(Counter)
    for (sido, _), counts in summary.items():
        by_sido[sido].update(counts)
    lines += ['## 시도별', '', '| 시도 | 목록 | 보유 | 보유율 | 미보유 | 코드미상 |',
              '|---|---:|---:|---:|---:|---:|']
    for sido, counts in sorted(by_sido.items(), key=lambda kv: -sum(kv[1].values())):
        rows = sum(counts.values())
        lines.append(f'| {sido} | {rows:,} | {counts["보유"]:,} | {counts["보유"] / rows * 100:.1f}% '
                     f'| {counts["미보유"]:,} | {counts["코드미상"]:,} |')
    lines.append('')

    source_count = Counter(row['name_source'] or '없음' for row in polygons)
    lines += ['## SHP 폴리곤의 하천명이 들어 있던 칸', '',
              '| 이름이 있는 칸 | 폴리곤 | 비율 |', '|---|---:|---:|']
    for key, label in (('REMARK', '`REMARK` 에만'), ('BOTH', '둘 다'),
                       ('ALIAS', '`ALIAS` 에만'), ('없음', '없음')):
        count = source_count[key]
        lines.append(f'| {label} | {count:,} | {count / len(polygons) * 100:.1f}% |')
    named = len(polygons) - source_count['없음']
    lines += ['', f'이름을 얻은 폴리곤 **{named:,} / {len(polygons):,} '
                  f'({named / len(polygons) * 100:.1f}%)**', '']

    held = Counter(row['shp_name_source'] for row in out_rows if row['shp_status'] == '보유')
    lines += ['## `보유` 행의 이름 출처', '', '| 출처 | 행 |', '|---|---:|']
    for key in ('REMARK', 'BOTH', 'ALIAS'):
        lines.append(f'| `{key}` | {held[key]:,} |')
    lines.append('')

    unmatched_polygons = sum(count for _, count in unmatched_names)
    nameless_polygons = sum(nameless_by_code.values())
    lines += [
        '## `unmatched_shp.csv` — SHP 쪽에서 목록에 닿지 못한 것',
        '',
        '판정 단위는 **시군구 + 하천명** 이다. 전국 단위가 아니다.',
        '',
        '| kind | 행 | 폴리곤 |',
        '|---|---:|---:|',
        f'| `목록에 없는 하천명` | {len(unmatched_names):,} | {unmatched_polygons:,} |',
        f'| `이름 없는 폴리곤` | {len(nameless_by_code):,} (시군구코드 단위) | {nameless_polygons:,} |',
        '',
    ]
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> int:
    print('NDMS 소하천 전체 목록 <-> 소하천구역 SHP 대조')
    ledger = read_ledger()
    print(f'  목록 {len(ledger):,}행')

    official = load_official_map()
    by_name = official or {}

    zips = province_zips()
    polygons: list = []
    for province, path in zips:
        sido = PROVINCE_TO_SIDO[province]
        for polygon in read_province(path):
            polygon['sido'] = sido
            polygons.append(polygon)
    print(f'  SHP {len(polygons):,} 폴리곤 · 시도 zip {len(zips)}개')

    names_by_code = defaultdict(set)
    polys_by_code = defaultdict(list)
    polys_by_code_name = defaultdict(list)
    nameless_by_code = Counter()
    shp_names_by_sido = defaultdict(lambda: defaultdict(set))
    for polygon in polygons:
        code = polygon['code']
        if polygon['lon'] is not None:
            polys_by_code[code].append((polygon['lon'], polygon['lat']))
        if polygon['name']:
            names_by_code[code].add(polygon['name'])
            polys_by_code_name[(code, polygon['name'])].append(polygon)
            shp_names_by_sido[polygon['sido']][code].add(polygon['name'])
        else:
            nameless_by_code[code] += 1

    ledger_names_by_sido = defaultdict(lambda: defaultdict(set))
    for row in ledger:
        ledger_names_by_sido[row.get('sido')][row.get('sgg')].add(normalize(row.get('name')))

    OUT.mkdir(parents=True, exist_ok=True)
    if official:
        map_source = f'{OFFICIAL_MAP.name} (정본 · 행정구역 자료)'
    else:
        derived, detail = derive_map(ledger_names_by_sido, shp_names_by_sido)
        by_name = {key: {code} for key, code in derived.items()}
        (OUT / 'sgg_code_map_derived.json').write_text(json.dumps({
            'dataset': 'sgg_code_map_derived',
            'derivation': 'name_overlap',
            'warning': '행정구역 정본이 아니다. data/reference/sgg_code_map.json 이 있으면 그쪽이 우선한다.',
            'entries': detail,
        }, ensure_ascii=False, indent=1), encoding='utf-8')
        map_source = 'sgg_code_map_derived.json (파생 · 하천명 중첩)'
    print(f'  시군구 코드표: {map_source} · 항목 {len(by_name):,}')

    # 같은 시도 안에서 한 이름이 여러 시군구에 등재됐는지 (동명 경고용)
    sgg_per_name = defaultdict(set)
    for row in ledger:
        sgg_per_name[(row.get('sido'), normalize(row.get('name')))].add(row.get('sgg'))

    status_count = Counter()
    summary = defaultdict(Counter)
    codes_by_sgg: dict = {}
    matched_pairs = set()
    out_rows = []
    for row in ledger:
        sido, sgg = row.get('sido'), row.get('sgg')
        name = normalize(row.get('name'))
        home_codes = set(by_name.get((sido, sgg), ()))
        codes_by_sgg[(sido, sgg)] = home_codes
        status = basis = ''
        polys: list = []
        if not home_codes:
            status = '코드미상'
        elif any(name in names_by_code.get(code, set()) for code in home_codes):
            status, basis = '보유', '시군구코드+명칭'
            for code in sorted(home_codes):
                polys.extend(polys_by_code_name.get((code, name), ()))
                matched_pairs.add((code, name))
        else:
            # 같은 시도의 다른 시군구에 동명이 있는가 → 형상 거리로 경계 걸침만 가른다.
            home = [point for code in home_codes for point in polys_by_code.get(code, ())]
            nearest = None
            nearest_polys: list = []
            for other_code in shp_names_by_sido.get(sido, {}):
                if other_code in home_codes or (other_code, name) not in polys_by_code_name:
                    continue
                candidates = polys_by_code_name[(other_code, name)]
                for candidate in candidates:
                    if candidate['lon'] is None:
                        continue
                    for point in home:
                        distance = km_between((candidate['lon'], candidate['lat']), point)
                        if nearest is None or distance < nearest:
                            nearest, nearest_polys = distance, candidates
            if nearest is not None and nearest <= ADJACENT_KM:
                status, basis = '경계걸침_후보', f'인접형상({nearest:.1f}km)'
                polys = nearest_polys
            else:
                status = '미보유'
        status_count[status] += 1
        summary[(sido, sgg)][status] += 1

        sources = sorted({p['name_source'] for p in polys if p['name_source']})
        out_rows.append({
            'sido': sido, 'sgg': sgg, 'sgg_code': ';'.join(sorted(home_codes)),
            'stream_name': row.get('name', ''), 'stream_name_norm': name,
            'sugye': row.get('sugye', ''), 'length_m': row.get('length_m', ''),
            'basin_km2': row.get('basin_km2', ''), 'start_addr': (row.get('start_addr') or '').strip(),
            'shp_status': status,
            'shp_polygon_count': len(polys),
            'shp_mnum_list': ';'.join(p['mnum'] for p in polys[:5]),
            'shp_name_source': 'BOTH' if len(sources) > 1 else (sources[0] if sources else ''),
            'homonym_warning': 'Y' if len(sgg_per_name[(sido, name)]) > 1 else '',
            'match_basis': basis or '-',
        })

    with (OUT / 'crosscheck_rows.csv').open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(out_rows[0].keys()))
        writer.writeheader()
        writer.writerows(out_rows)

    with (OUT / 'crosscheck_summary.csv').open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.writer(handle)
        writer.writerow(['sido', 'sgg', 'sgg_code', '목록개소', '보유', '경계걸침_후보', '미보유', '코드미상',
                         'SHP하천수', 'SHP무명폴리곤'])
        for (sido, sgg), counts in sorted(summary.items(), key=lambda kv: (kv[0][0] or '', kv[0][1] or '')):
            codes = codes_by_sgg.get((sido, sgg), set())
            writer.writerow([sido, sgg, ';'.join(sorted(codes)), sum(counts.values()),
                             counts['보유'], counts['경계걸침_후보'], counts['미보유'], counts['코드미상'],
                             len({name for code in codes for name in names_by_code.get(code, ())}),
                             sum(nameless_by_code.get(code, 0) for code in codes)])

    # 코드 → 시군구 역방향. 한 시군구가 코드를 여럿 가질 수 있으므로 코드마다 풀어 담는다.
    code_to_sgg = {code: (sido, sgg)
                   for (sido, sgg), codes in codes_by_sgg.items() for code in codes}
    unmatched_names = []
    with (OUT / 'unmatched_shp.csv').open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.writer(handle)
        writer.writerow(['sgg_code', 'sido', 'sgg', 'kind', 'stream_name', 'polygon_count', 'sample_mnum'])
        for (code, name), items in sorted(polys_by_code_name.items()):
            if (code, name) in matched_pairs:
                continue
            sido, sgg = code_to_sgg.get(code, ('', ''))
            unmatched_names.append(((code, name), len(items)))
            writer.writerow([code, sido, sgg, '목록에 없는 하천명', name, len(items), items[0]['mnum']])
        for code, count in sorted(nameless_by_code.items()):
            sido, sgg = code_to_sgg.get(code, ('', ''))
            writer.writerow([code, sido, sgg, '이름 없는 폴리곤', '', count, ''])

    print()
    total = len(ledger)
    for status in ('보유', '경계걸침_후보', '미보유', '코드미상'):
        print(f'  {status:8s} {status_count[status]:6,}  ({status_count[status] / total * 100:5.1f}%)')
    named = sum(1 for p in polygons if p['name'])
    print(f'  SHP 이름 회수 {named:,} / {len(polygons):,} ({named / len(polygons) * 100:.1f}%)'
          f' · 시군구+명칭 고유 {len(polys_by_code_name):,}')

    write_report(OUT / 'crosscheck_report.md', out_rows=out_rows, polygons=polygons,
                 status_count=status_count, summary=summary,
                 unmatched_names=unmatched_names, nameless_by_code=nameless_by_code)

    # 검산 — 합계가 어긋나면 조용히 넘어가지 않는다.
    problems = []
    if sum(status_count.values()) != total:
        problems.append(f'상태 합계 {sum(status_count.values())} != 목록 {total}')
    if status_count['보유'] / total < 0.70:
        problems.append(f'보유 비율 {status_count["보유"] / total:.1%} 가 70% 미만이다 - 코드표를 확인하라.')
    for name in ('crosscheck_rows.csv', 'crosscheck_summary.csv', 'unmatched_shp.csv',
                 'crosscheck_report.md'):
        if not (OUT / name).exists():
            problems.append(f'{name} 가 생성되지 않았다.')
    if problems:
        for problem in problems:
            print(f'FAIL {problem}')
        return 1
    print('PASS 소하천 대조표: build/sochun/ 에 CSV 3개 + crosscheck_report.md')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
