"""외부 원자료가 어디 있는지를 한 곳에 모은다.

원자료는 용량이 커서 리포에 넣지 않고(`.gitignore`) 작업 PC 에 두는데, 그 폴더 구성이
바뀔 때마다 전처리 스크립트 다섯 곳의 경로가 함께 깨졌다(2026-08-18 에 전부 `GIS_data/`
아래로 옮겨지면서 실제로 깨졌다). **경로를 여기서만 고치면 되도록 한다.**

없는 자료를 조용히 건너뛰지 않는다 — `require()` 는 무엇이 없는지와 어디에 두어야 하는지를
말하고 멈춘다. 산출물은 전부 리포에 커밋돼 있으므로, 원자료가 없어도 앱 실행·검증·배포는 된다.
전처리를 다시 돌릴 때만 필요하다.
"""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

#: 외부 원자료 루트. 예전에는 리포 루트에 폴더가 흩어져 있었다.
GIS_DATA = REPO / 'GIS_data'

#: 소하천구역 연속주제도(국토교통부/브이월드). 시도별 zip 17개 + 구 측지계 `_5174_` 판.
SOCHUN_ZONE_DIR = GIS_DATA / '소하천_소하천구역(연속주제)+브이월드'

#: 행안부 NDMS 소하천 전체 목록(소하천대장).
SOCHUN_LEDGER = GIS_DATA / '소하천 전체 목록' / '소하천대장_20260814_좌표추가.xlsx'

#: 행정표준코드시스템 법정동코드(브이월드 배포). 시군구 코드표의 원자료.
LAWD_CODE_ZIP = (GIS_DATA / '행정구역' / '행정표준코드시스템_법정동 코드(브이월드)_260813갱신'
                 / 'LSCT_LAWDCD.zip')

#: 국가수자원관리종합시스템 하천망도. 국가하천 73 · 지방하천 3,783 의 코드·이름·형상(EPSG:5179).
RIVER_NETWORK_DIR = GIS_DATA / '(하천명 확인용) 국가하천_지방하천 하천망도(국가수자원관리종합시스템)'
RIVER_NETWORK_NATIONAL = RIVER_NETWORK_DIR / 'ntn_rvr' / '00.하천망도_국가'
RIVER_NETWORK_LOCAL = RIVER_NETWORK_DIR / 'lcl_rvr' / '00.하천망도_지방'

#: 국토지리정보원 국가기본도 하천 3종(전국 단일 SHP zip).
#: 중심선(TN_RIVER_CTLN)은 322만 건이라 반입하지 않는다 — 하천명은 하천망도가 갖고 있다.
NGII_BOUNDARY_ZIP = GIS_DATA / '국가기본도_하천경계' / '국가기본도_하천경계.zip'
NGII_REALWIDTH_ZIP = GIS_DATA / '국가기본도_하천실폭' / '국가기본도 실폭하천.zip'

#: T3Q 참고자료.
T3Q_DIR = GIS_DATA / '메타데이터 참고자료(T3Q)'
DISASTER_LEDGER = T3Q_DIR / '20260708_2010~2025재해대장보고서_New.xlsx'


def require(path: Path, what: str) -> Path:
    """원자료가 없으면 무엇을 어디에 두어야 하는지 말하고 멈춘다."""
    if not path.exists():
        raise FileNotFoundError(
            f'{what} 를 찾지 못했다: {path}\n'
            f'  원자료는 리포에 넣지 않는다. {GIS_DATA.name}/ 아래에 두고 다시 실행하라.\n'
            f'  경로가 바뀌었다면 scripts/source_data.py 만 고치면 된다.')
    return path
