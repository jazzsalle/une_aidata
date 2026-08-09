"""전국 관측소(수위·강수량) 위치를 WAMIS 오픈API 에서 받아 지도용 GeoJSON 으로 만든다.

    입력  WAMIS 국가수자원관리종합정보시스템 오픈API (인증키 불필요, 읽기 전용 GET)
          목록  wkw/wl_dubwlobs · wkw/rf_dubrfobs
          제원  wkw/wl_obsinfo?obscd=… · wkw/rf_obsinfo?obscd=…   ← 위경도가 여기에만 있다
    출력  apps/web/public/reference/stations/{wl,rf}_stations.geojson

사용법:
    python scripts/build_observation_stations.py            # 수위 + 강수량
    python scripts/build_observation_stations.py wl         # 수위만

목록 API 에는 좌표가 없어 관측소마다 제원을 한 번씩 불러야 한다. 공공 API 이므로
요청 간격을 두고, 받은 제원은 `build/stations/` 에 캐시해 재실행 시 다시 부르지 않는다.

**이 자료는 관측소의 '위치·제원'이지 관측값이 아니다.** 수위·강우 실측값은 Provider
연계(hrfco_hydrology · kma_nowcast)를 거쳐야 하며 그쪽은 별도 승격 절차를 따른다.
"""
from __future__ import annotations

import json
import re
import ssl
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CACHE = REPO / 'build' / 'stations'
DEST = REPO / 'apps' / 'web' / 'public' / 'reference' / 'stations'
BASE = 'http://www.wamis.go.kr:8080/wamis/openapi'
SOURCE = 'WAMIS 국가수자원관리종합정보시스템 오픈API'
DELAY_SEC = 0.05

# 정부 사이트 인증서 체인이 환경에 따라 검증되지 않는다. 공개 목록 조회이고 비밀정보를
# 보내지 않으므로 검증을 끄되, 이 예외를 다른 용도로 확대하지 않는다.
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

KINDS = {
    'wl': {'label': '수위관측소', 'list': 'wkw/wl_dubwlobs', 'info': 'wkw/wl_obsinfo', 'code': 'wlobscd'},
    'rf': {'label': '강수량관측소', 'list': 'wkw/rf_dubrfobs', 'info': 'wkw/rf_obsinfo', 'code': 'rfobscd'},
}


def fetch(path: str) -> dict:
    request = urllib.request.Request(f'{BASE}/{path}', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=30, context=SSL_CTX) as response:
        return json.loads(response.read().decode('utf-8'))


def dms_to_deg(raw: str | None) -> float | None:
    """WAMIS 는 위경도를 '35-27-19' 꼴 도분초로 준다."""
    if not raw:
        return None
    parts = [float(v) for v in re.findall(r'[\d.]+', raw.strip())]
    if not parts:
        return None
    deg = parts[0] + (parts[1] if len(parts) > 1 else 0) / 60 + (parts[2] if len(parts) > 2 else 0) / 3600
    return round(deg, 6)


def number(raw) -> float | None:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value == value else None  # NaN 제외


def build(kind: str) -> None:
    spec = KINDS[kind]
    CACHE.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE / f'{kind}_detail.json'
    cache: dict[str, dict] = json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}

    listing = fetch(f"{spec['list']}?output=json").get('list') or []
    print(f"{spec['label']}: 목록 {len(listing):,}개 (캐시 {len(cache):,}개 보유)")

    missing = [row for row in listing if row['obscd'] not in cache]
    for index, row in enumerate(missing, 1):
        try:
            detail = (fetch(f"{spec['info']}?obscd={row['obscd']}&output=json").get('list') or [{}])[0]
            cache[row['obscd']] = detail
        except Exception as error:  # 한 건 실패가 전체를 멈추지 않는다
            print(f"  제원 실패 {row['obscd']} {type(error).__name__}")
        if index % 200 == 0:
            print(f'  제원 {index:,}/{len(missing):,}')
            cache_path.write_text(json.dumps(cache, ensure_ascii=False), encoding='utf-8')
        time.sleep(DELAY_SEC)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False), encoding='utf-8')

    fetched = date.today().isoformat()
    features, skipped = [], 0
    for row in listing:
        detail = cache.get(row['obscd']) or {}
        lat = dms_to_deg(detail.get('lat'))
        lon = dms_to_deg(detail.get('lon'))
        if lat is None or lon is None:
            skipped += 1
            continue
        props = {
            'station_code': row['obscd'],
            'name': row['obsnm'],
            'station_type': spec['label'],
            'basin': row.get('bbsnnm'),
            'operating': row.get('clsyn') == '운영',
            'manager': row.get('mngorg'),
            'observation_kind': row.get('obsknd'),
            'address': detail.get('addr'),
            # 관측소의 '제원'이지 관측값이 아니다. 화면에서도 그렇게 표기한다.
            'data_kind': 'station_metadata',
            'source': SOURCE,
            'fetched_at': fetched,
        }
        if detail.get('rivnm'):
            props['river_name'] = detail['rivnm']
        area = number(detail.get('bsnara'))
        if area is not None:
            props['basin_area_km2'] = area
        if detail.get('obsopndt'):
            props['opened_at'] = detail['obsopndt']
        features.append({
            'type': 'Feature',
            'id': f"STATION:{kind.upper()}:{row['obscd']}",
            'properties': {k: v for k, v in props.items() if v not in (None, '')},
            'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
        })

    DEST.mkdir(parents=True, exist_ok=True)
    out = DEST / f'{kind}_stations.geojson'
    out.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                              ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    running = sum(1 for f in features if f['properties'].get('operating'))
    print(f"  → {out.name}: {len(features):,}개 (운영 {running:,} · 좌표없어 제외 {skipped}) "
          f"{out.stat().st_size // 1024:,} KB")


def main() -> int:
    kinds = [k for k in sys.argv[1:] if k in KINDS] or list(KINDS)
    for kind in kinds:
        build(kind)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
