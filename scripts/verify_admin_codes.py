#!/usr/bin/env python3
"""`data/reference/admin_code_map.json` 이 아직 맞는지 VWorld 로 확인한다.

행정구역은 계속 개편된다(전북특별자치도 52·강원특별자치도 51 신설로 구 코드가 상류에서
사라졌다). 매핑표를 문서로만 두면 조용히 낡으므로, 실제 조회로 대조하는 수단을 함께 둔다.

    python scripts/verify_admin_codes.py

VWorld 키(`VITE_VWORLD_MAP_KEY`)가 없으면 **조회 없이 SKIP** 하고 exit 0 한다 —
회귀 게이트에 넣어도 키 없는 환경을 막지 않는다. 키는 `.env` 에서만 읽는다.

검사:
  1. current_admin_code 가 VWorld LT_C_ADSIGG_INFO 에 존재하는가
  2. changed=true 인 항목의 seed_admin_code 는 정말 사라졌는가(NOT_FOUND 여야 한다)
  3. changed=false 인 항목은 두 코드가 같고 존재하는가
"""
from __future__ import annotations

import json
import ssl
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# Windows 기본 stdout 은 cp949 라 '—' 한 글자에 스크립트가 죽는다. 다른 smoke 들과 같은 처리.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # type: ignore[union-attr]
except Exception:
    pass

REPO = Path(__file__).resolve().parents[1]
MAP_FILE = REPO / 'data/reference/admin_code_map.json'
ENDPOINT = 'https://api.vworld.kr/req/data'
SSL_CTX = ssl.create_default_context()


def env_from_dotenv(name: str) -> str | None:
    path = REPO / '.env'
    if not path.exists():
        return None
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.startswith(f'{name}='):
            value = line.split('=', 1)[1].strip()
            return value or None
    return None


def lookup(sig_cd: str, key: str, domain: str | None) -> tuple[str, str | None]:
    """(status, 시군구명). 없으면 ('NOT_FOUND', None)."""
    params = {
        'service': 'data', 'request': 'GetFeature', 'data': 'LT_C_ADSIGG_INFO',
        'key': key, 'format': 'json', 'size': '1', 'geometry': 'false',
        'attrFilter': f'sig_cd:=:{sig_cd}',
    }
    if domain:
        params['domain'] = domain
    request = urllib.request.Request(f'{ENDPOINT}?{urllib.parse.urlencode(params)}',
                                     headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=25, context=SSL_CTX) as response:
        payload = json.loads(response.read().decode('utf-8'))
    body = payload.get('response') or {}
    status = body.get('status')
    if status != 'OK':
        return str(status), None
    features = (((body.get('result') or {}).get('featureCollection') or {}).get('features') or [])
    if not features:
        return 'NOT_FOUND', None
    return 'OK', features[0].get('properties', {}).get('sig_kor_nm')


def main() -> int:
    data = json.loads(MAP_FILE.read_text(encoding='utf-8'))
    key = env_from_dotenv('VITE_VWORLD_MAP_KEY')
    domain = env_from_dotenv('VITE_VWORLD_SERVICE_DOMAIN')
    if not key:
        print('SKIP admin code map: VITE_VWORLD_MAP_KEY 미설정 — 조회하지 않는다(네트워크 0건).')
        return 0

    failures: list[str] = []
    print(f"admin code map 검증 (기준 표 verified_at={data['verification']['verified_at']})")
    for row in data['regions']:
        seed = row['seed_admin_code']
        current = row['current_admin_code']
        status, name = lookup(current, key, domain)
        mark = 'OK' if status == 'OK' else status
        print(f"  {seed} → {current} {str(row['admin_name']):22} 현행조회={mark} {name or ''}")
        if status != 'OK':
            failures.append(f'{current}({row["admin_name"]}) 가 VWorld 에서 조회되지 않는다 — 표를 갱신하라')
        if row.get('changed'):
            old_status, _ = lookup(seed, key, domain)
            if old_status == 'OK':
                failures.append(f'{seed} 가 아직 살아 있다 — changed=true 전제가 깨졌다(표 재검토)')
            else:
                print(f'      구 코드 {seed}: {old_status} (사라진 것 확인)')
        elif seed != current:
            failures.append(f'{seed}: changed=false 인데 current_admin_code 가 다르다')

    for row in data['verification_targets']['regions']:
        current = row.get('current_admin_code')
        if not current:
            print(f"  (미확정) {row['admin_name']} — 대상 확정 후 표를 채운다")
            continue
        status, name = lookup(current, key, domain)
        print(f"  검증대상 {current} {str(row['admin_name']):22} 현행조회={status} {name or ''}")
        if status != 'OK':
            failures.append(f'검증대상 {current} 가 조회되지 않는다')

    if failures:
        print(f'FAIL admin code map: {len(failures)}건')
        for item in failures:
            print(f'  - {item}')
        return 1
    print('PASS admin code map: 현행 코드 전부 조회됨 · 구 코드 소멸 확인')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
