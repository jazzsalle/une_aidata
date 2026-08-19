"""하천 자료 파일명의 시군구코드를 대표 코드 하나로 통일한다.

    입출력  apps/web/public/reference/rivers/{LSMD_SOCHUN,TN_RIVER_BNDRY,TN_RIVER_BT}_{시군구}.geojson

자료마다 기준일과 층위가 달라 같은 시군구가 다른 코드로 들어온다. 두 가지가 겹친다.

  기준일  소하천구역은 전남·광주 통합 이전 코드다(목포시 46110 · 광주 동구 29110).
          행정표준코드 현행은 12110 · 12210 이고, 강원은 반대로 42800(종전) · 51800(현행) 이다.
  층위    행정동으로 배정한 국가기본도는 자치구가 있는 시에서 구 코드가 나온다
          (성남시 → 분당구 41135 · 수정구 41131 · 중원구 41133). 소하천구역은 시 코드 41130 이다.

갈린 채로 두면 지도가 그 시군구를 골랐을 때 한쪽 레이어만 보인다 — 2026-08-19 실제로 그랬다.
`data/reference/sgg_code_map.json` 의 `primary_code`(구는 시 코드, 그 밖은 현행 코드)로 파일명과
`admin_code` 를 맞춘다. 두 경우가 같은 표로 풀리므로 한 번만 돌면 된다. 멱등이다.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from source_data import REPO, require  # noqa: E402

DIR = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'
SGG_MAP = REPO / 'data' / 'reference' / 'sgg_code_map.json'
LAYERS = ('LSMD_SOCHUN', 'TN_RIVER_BNDRY', 'TN_RIVER_BT')


def primary_of() -> dict:
    payload = json.loads(require(SGG_MAP, '시군구 코드표').read_text(encoding='utf-8'))
    table: dict = {}
    for entry in payload['entries']:
        for code in entry['codes']:
            table[code] = entry['primary_code']
    return table


def main() -> int:
    primary = primary_of()
    moved: Counter = Counter()
    for layer in LAYERS:
        for path in sorted(DIR.glob(f'{layer}_*.geojson')):
            code = path.stem[len(layer) + 1:]
            target = primary.get(code)
            if not target or target == code:
                continue
            payload = json.loads(path.read_text(encoding='utf-8'))
            for feature in payload['features']:
                feature['properties']['admin_code'] = target
                if feature['properties'].get('sgg_code'):
                    feature['properties']['sgg_code'] = target
            out = DIR / f'{layer}_{target}.geojson'
            existing = json.loads(out.read_text(encoding='utf-8'))['features'] if out.exists() else []
            out.write_text(json.dumps({'type': 'FeatureCollection',
                                       'features': existing + payload['features']},
                                      ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            path.unlink()
            moved[layer] += len(payload['features'])
            print(f'  {path.name} → {out.name} ({len(payload["features"]):,}건)')

    if not sum(moved.values()):
        print('대표 코드가 아닌 파일이 없다.')
    else:
        print(f'\n옮긴 폴리곤 {dict(moved)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
