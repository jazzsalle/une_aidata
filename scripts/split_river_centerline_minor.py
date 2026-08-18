"""이미 반입된 중심선 GeoJSON 에서 이름 없는 소하천을 별도 파일로 가른다.

    입출력  apps/web/public/reference/rivers/TN_RIVER_CTLN_{admin}.geojson
            apps/web/public/reference/rivers/TN_RIVER_CTLN_MINOR_{admin}.geojson

`scripts/build_river_web_layers.py` 는 원자료를 다시 훑을 때 같은 분리를 하지만, 그러려면
`국가기본도_*` SHP 에서 `extract_river_layers.py` 부터 돌려야 한다. 이 스크립트는 **이미 커밋된
산출물에만 손대서** 같은 결과를 만든다. 판정은 `is_minor_centerline` 하나를 공유하므로 두 경로가
갈라지지 않는다.

여러 번 돌려도 결과가 같다 — 두 파일을 먼저 합친 뒤 다시 가른다. MINOR 를 먼저 되돌리지 않으면
두 번째 실행에서 MINOR 가 빈 파일로 덮인다.

가르는 이유는 용량이다. 무명 소하천 중심선은 남원 4,781건·구미 4,741건·의왕 785건으로 참조
GeoJSON 전체 19.7 MB 중 4.0 MB(20.3%)를 쓰는데 `RIVER_NM` 이 없어 검색·식별에 쓰이지 못한다.
**버리지 않고** 기본 비표시 레이어로 옮기는 것이라 언제든 되돌릴 수 있다.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_river_web_layers import MINOR_LAYER, is_minor_centerline, write_collection  # noqa: E402
from river_regions import REGIONS  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
DIR = REPO / 'apps' / 'web' / 'public' / 'reference' / 'rivers'


def load(path: Path) -> list:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding='utf-8'))['features']


def main() -> int:
    touched = 0
    for region in REGIONS:
        main_path = DIR / f'TN_RIVER_CTLN_{region.admin}.geojson'
        minor_path = DIR / f'{MINOR_LAYER}_{region.admin}.geojson'
        if not main_path.exists():
            print(f'  {region.admin} {region.name}: 중심선 파일이 없다 — 건너뛴다.')
            continue

        # 이미 갈라 둔 것이 있으면 되돌려 합친 뒤 다시 가른다(반복 실행 안전).
        features = load(main_path) + load(minor_path)
        minor = [f for f in features if is_minor_centerline(f['properties'])]
        named = [f for f in features if not is_minor_centerline(f['properties'])]
        if not minor:
            print(f'  {region.admin} {region.name}: 무명 소하천 없음 · 중심선 {len(named):,}건')
            continue

        write_collection(main_path, named)
        write_collection(minor_path, minor)
        touched += 1
        print(f'  {region.admin} {region.name}: 중심선 {len(features):,} -> '
              f'유명 {len(named):,} + 무명 소하천 {len(minor):,} '
              f'({main_path.stat().st_size / 1024:,.0f} KB + {minor_path.stat().st_size / 1024:,.0f} KB)')

    if not touched:
        print('바뀐 파일이 없다.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
