"""지도에 표시할 6개 대상지역 카탈로그. 하천 전처리 스크립트들이 공유한다.

행정코드가 두 벌인 지역이 있다. 앱은 `geo.json`·`districts.json` 계보를 따라 남원을 45190 으로
쓰지만, 2024년 전북특별자치도 출범 이후 배포되는 공간자료는 52190 을 쓴다. 여기서 `admin`(앱 코드)과
`source_sgg`(원자료 코드)를 나눠 두는 이유가 그것이다 — **둘 중 하나로 통일하지 않는다.**
앱 코드로 통일하면 원자료에서 아무것도 못 찾고, 원자료 코드로 통일하면 기존 파일명·시드와 어긋난다.

부산은 시군구가 아니라 광역시 전체(26)다. 북구(26320)만 잡으면 소하천 자료가 0건이라
화면에 아무것도 뜨지 않는다(실측: 부산 소하천 50건은 서구·남구·해운대·사상·기장에만 있다).
"""
from __future__ import annotations

from typing import NamedTuple


class Region(NamedTuple):
    admin: str
    """앱이 쓰는 행정코드. 산출 파일명과 프런트 지역 선택기 값이 이 코드다."""
    name: str
    province_file: str
    """`LSMD_CONT_UJ301_{province_file}.zip` — 소하천 원자료가 시도 단위로 나뉘어 있다."""
    source_sgg: tuple[str, ...]
    """원자료 `COL_ADM_SE` 에서 고를 값. 부산처럼 접두사로 여러 구·군을 잡는 경우가 있다."""
    center: tuple[float, float]
    """지도 초기 중심(경도, 위도).

    기존 3개 지역은 `VWorldMapAdapter` 가 이미 쓰던 값을 그대로 둔다 — 그 좌표는 위험지구가
    모여 있는 곳이라 화면을 열었을 때 보여야 할 것이 보인다. 신규 3개 지역은 위험지구 시드가
    없으므로 소하천구역 형상의 실측 bbox 중심을 쓴다(build_sochun_layers.py 산출값).
    """


REGIONS: tuple[Region, ...] = (
    Region('41430', '경기도 의왕시', '경기', ('41430',), (126.968, 37.344)),
    Region('47190', '경상북도 구미시', '경북', ('47190',), (128.344, 36.119)),
    Region('45190', '전북특별자치도 남원시', '전북특별자치도', ('52190',), (127.390, 35.416)),
    Region('47230', '경상북도 영천시', '경북', ('47230',), (128.926, 36.000)),
    Region('51810', '강원특별자치도 인제군', '강원특별자치도', ('51810',), (128.249, 38.038)),
    Region('26', '부산광역시', '부산', ('26',), (129.127, 35.253)),
)

REGION_BY_ADMIN = {region.admin: region for region in REGIONS}


def matches_sgg(region: Region, col_adm_se: str) -> bool:
    """부산(26)은 접두사 대조, 나머지는 5자리 완전일치."""
    code = (col_adm_se or '').strip()
    return any(code == want if len(want) == 5 else code.startswith(want) for want in region.source_sgg)
