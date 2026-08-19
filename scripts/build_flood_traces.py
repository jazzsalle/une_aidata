"""행안부 침수흔적도를 재난안전데이터공유플랫폼 API 에서 받아 시군구별 GeoJSON 으로 반입한다.

    입력  FLOOD_TRACE_API_URL · FLOOD_TRACE_API_KEY (.env)     DSSP-IF-00117
          data/reference/sgg_code_map.json                    시군구코드 대표코드
    출력  apps/web/public/reference/flood/FLOOD_TRACE_{시군구}.geojson   시군구 1건 = 파일 1개
          apps/web/public/reference/flood/flood_trace_catalog.json     시군구별 건수·연도 범위·수집시각

**전처리 반입인 이유.** 이 API 는 신청 시 등록한 IP 에서만 응답한다(UNREGISTERED IP ERROR).
Vercel Functions 는 요청마다 IP 가 달라 런타임 호출이 성립하지 않는다. 침수흔적도는 과거 기록
(2002~2018)이라 실시간일 필요가 없으므로 등록 IP 에서 받아 정적 자료로 배포한다 — 하천 자료와
같은 방식이다.

**시드는 건드리지 않는다.** `data/seed/flood_traces_seed.*` 의 mock 3건은 서버 시드·T3Q CQ
커버리지·근거 페이지가 그 ID(FTR-*)와 필드 계약을 쓴다. 실자료는 별도 참조 파일로 두고 지도가
지역에 따라 실어 온다. 두 자료는 `data_status` 로 구분된다 — 시드 mock · 이 파일 actual.

**응답에서 그대로 옮기는 것과 붙이는 것.** 원자료 필드는 이름만 바꿔 그대로 담는다. 등급(FLDN_GRD
1~6)의 뜻은 명세를 받기 전까지 값 그대로 둔다 — 임의로 "1등급=심각" 같은 해석을 붙이지 않는다.
붙이는 것은 출처·수집시각·좌표계 변환 사실뿐이다.

좌표는 EPSG:3857 로 온다(WKT, 값 범위 1.4e7 · 4.3e6 로 판별하고 첫 건을 4326 으로 바꿔 시군구
위치와 맞는 것을 확인했다). 4326 으로 변환해 담는다.

SN 은 유일하지 않다(1000건 표본에서 중복). ID 는 SN + 응답 순번으로 만든다.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pyproj

sys.path.insert(0, str(Path(__file__).resolve().parent))
from source_data import REPO, require  # noqa: E402

SGG_MAP = REPO / 'data' / 'reference' / 'sgg_code_map.json'
OUT_DIR = REPO / 'apps' / 'web' / 'public' / 'reference' / 'flood'
ENV = REPO / '.env'

PAGE = 1000
PRECISION = 6
TO4326 = pyproj.Transformer.from_crs('EPSG:3857', 'EPSG:4326', always_xy=True).transform
SOURCE = '행정안전부 침수흔적도 · 재난안전데이터공유플랫폼 DSSP-IF-00117'


def env_value(name: str) -> str:
    value = os.environ.get(name, '').strip()
    if value:
        return value
    if ENV.exists():
        for line in ENV.read_text(encoding='utf-8-sig').splitlines():
            if line.startswith(f'{name}='):
                return line.split('=', 1)[1].strip()
    raise SystemExit(f'{name} 이 없다. .env 에 넣어라(.env.example 참고). 키 값은 어디에도 적지 않는다.')


def primary_of() -> dict:
    payload = json.loads(require(SGG_MAP, '시군구 코드표').read_text(encoding='utf-8'))
    table: dict = {}
    for entry in payload['entries']:
        for code in entry['codes']:
            table[code] = entry['primary_code']
    return table


def fetch_page(base: str, key: str, page: int) -> dict:
    url = base + '?' + urllib.parse.urlencode({'serviceKey': key, 'returnType': 'json',
                                              'pageNo': str(page), 'numOfRows': str(PAGE)}, safe='')
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'une-aidata-poc/1.0'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                payload = json.loads(response.read().decode('utf-8', 'replace'))
            header = payload.get('header') or {}
            if header.get('resultCode') != '00':
                raise SystemExit(f'API 오류 {header.get("resultCode")} {header.get("resultMsg")} — '
                                 f'{header.get("errorMsg")}. IP 등록·키를 확인하라.')
            return payload
        except urllib.error.URLError as error:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError('unreachable')


WKT_NUM = re.compile(r'-?\d+(?:\.\d+)?')


def parse_wkt(wkt: str):
    """POLYGON / MULTIPOLYGON WKT → GeoJSON MultiPolygon 좌표(4326). 다른 유형은 None."""
    text = wkt.strip()
    kind, _, body = text.partition('(')
    kind = kind.strip().upper()
    if kind not in ('POLYGON', 'MULTIPOLYGON'):
        return None
    body = '(' + body

    def rings_of(poly_text: str):
        rings = []
        for ring_text in re.findall(r'\(([^()]*)\)', poly_text):
            nums = [float(v) for v in WKT_NUM.findall(ring_text)]
            pts = list(zip(nums[0::2], nums[1::2]))
            if len(pts) < 4:
                continue
            lon, lat = TO4326([p[0] for p in pts], [p[1] for p in pts])
            rings.append([[round(x, PRECISION), round(y, PRECISION)] for x, y in zip(lon, lat)])
        return rings

    if kind == 'POLYGON':
        rings = rings_of(body)
        return [rings] if rings else None
    # MULTIPOLYGON(((...)),((...)))
    polys = []
    depth = 0
    start = None
    for i, ch in enumerate(body):
        if ch == '(':
            depth += 1
            if depth == 2:
                start = i
        elif ch == ')':
            if depth == 2 and start is not None:
                rings = rings_of(body[start:i + 1])
                if rings:
                    polys.append(rings)
                start = None
            depth -= 1
    return polys or None


def main() -> int:
    base = env_value('FLOOD_TRACE_API_URL')
    key = env_value('FLOOD_TRACE_API_KEY')
    to_primary = primary_of()
    collected_at = datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')

    first = fetch_page(base, key, 1)
    total = int(first.get('totalCount') or 0)
    pages = (total + PAGE - 1) // PAGE
    print(f'침수흔적도 DSSP-IF-00117: 총 {total:,}건 · {pages} 페이지 · 수집 {collected_at}')

    by_sgg: dict = defaultdict(list)
    dropped = Counter()
    unresolved = Counter()
    seq = 0
    for page in range(1, pages + 1):
        payload = first if page == 1 else fetch_page(base, key, page)
        rows = payload.get('body') or []
        for row in rows:
            seq += 1
            code = to_primary.get(str(row.get('STDG_SGG_CD') or '').strip())
            if not code:
                unresolved[str(row.get('STDG_SGG_CD'))] += 1
                continue
            coords = parse_wkt(str(row.get('GEOM') or ''))
            if not coords:
                dropped['형상 없음/미지원'] += 1
                continue
            begin = str(row.get('FLDN_BGNG_YMD') or '')
            end = str(row.get('FLDN_END_YMD') or '')
            feature = {
                'type': 'Feature',
                'id': f'FLD:{code}:{row.get("SN")}:{seq}',
                'geometry': {'type': 'MultiPolygon', 'coordinates': coords},
                'properties': {
                    'id': f'FLD:{code}:{row.get("SN")}:{seq}',
                    'layer': 'FLOOD_TRACE',
                    'admin_code': code,
                    'sido_code': str(row.get('STDG_CTPV_CD') or ''),
                    'flood_year': row.get('FLDN_YR'),
                    'occurred_at': f'{begin[:4]}-{begin[4:6]}-{begin[6:8]}' if len(begin) == 8 else begin,
                    'ended_at': f'{end[:4]}-{end[4:6]}-{end[6:8]}' if len(end) == 8 else end,
                    'begin_time': row.get('FLDN_BGNG_TM'),
                    'end_time': row.get('FLDN_END_TM'),
                    'disaster_name': row.get('FLDN_DST_NM'),
                    'cause_detail': row.get('FLDN_CS_DTL_NM'),
                    'flood_grade': row.get('FLDN_GRD'),
                    'flood_depth_m': row.get('FLDN_DOWA'),
                    'flood_area_m2': row.get('FLDN_AREA'),
                    'source_sn': row.get('SN'),
                    'data_status': 'actual',
                    'official_data': True,
                    'is_prediction': False,
                    'source': SOURCE,
                    'collected_at': collected_at,
                    'source_crs': 'EPSG:3857',
                    'display_badges': ['행안부 침수흔적도', '과거 기록'],
                },
            }
            by_sgg[code].append(feature)
        if page % 5 == 0 or page == pages:
            print(f'  {page}/{pages} 페이지 · 누적 {sum(len(v) for v in by_sgg.values()):,}건')

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob('FLOOD_TRACE_*.geojson'):
        stale.unlink()

    catalog = []
    total_bytes = 0
    for code, features in sorted(by_sgg.items()):
        out = OUT_DIR / f'FLOOD_TRACE_{code}.geojson'
        text = json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, separators=(',', ':'))
        out.write_text(text, encoding='utf-8')
        total_bytes += len(text.encode('utf-8'))
        years = [f['properties']['flood_year'] for f in features if f['properties']['flood_year']]
        catalog.append({'code': code, 'count': len(features),
                        'year_min': min(years) if years else None, 'year_max': max(years) if years else None})

    (OUT_DIR / 'flood_trace_catalog.json').write_text(json.dumps({
        'dataset': 'flood_trace_catalog',
        'source': SOURCE,
        'built_by': 'scripts/build_flood_traces.py',
        'collected_at': collected_at,
        'total_count_reported': total,
        'imported': sum(len(v) for v in by_sgg.values()),
        'dropped': dict(dropped),
        'unresolved_sgg': dict(unresolved),
        'note': ('전처리 반입. API 는 등록 IP 에서만 응답하고 Vercel Functions 는 IP 가 고정되지 않아 런타임 호출을 '
                 '하지 않는다. FLDN_GRD(등급) 의 뜻은 명세 확보 전까지 값 그대로 둔다. 좌표는 EPSG:3857 → 4326.'),
        'regions': catalog,
    }, ensure_ascii=False, indent=1), encoding='utf-8')

    imported = sum(len(v) for v in by_sgg.values())
    print(f'\n{OUT_DIR.relative_to(REPO)}: 시군구 {len(by_sgg)} 파일 · {imported:,}건 · {total_bytes / 1024 / 1024:.1f} MB')
    if dropped:
        print(f'  버림: {dict(dropped)}')
    if unresolved:
        print(f'  코드 못 푼 시군구: {dict(unresolved)}')
    if imported + sum(dropped.values()) + sum(unresolved.values()) != total:
        print(f'FAIL 건수 불일치: 반입 {imported} + 버림 {sum(dropped.values())} + 미상 {sum(unresolved.values())} != 총 {total}')
        return 1
    print('PASS 침수흔적도 반입')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
