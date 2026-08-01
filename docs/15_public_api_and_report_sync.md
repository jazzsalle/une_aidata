# 공공 API 및 근거-보고서 연계 구현

## 기상청 초단기실황
- Endpoint: `getUltraSrtNcst`
- 의왕 60/122, 구미 84/97, 남원 68/81 격자 적용
- RN1, T1H, REH, WSD, VEC, PTY 정규화
- 실호출 실패 시 Scenario Observation을 사용하되 화면에 자료상태를 표시한다.

## 수위·유량
홍수통제소 표준수문DB의 관측소 코드와 호출계약이 확정되면 `HRFCO_*` 환경변수를 통해 활성화한다. 확정 전에는 사용자 입력·Scenario 값을 유지한다.

## 근거-보고서 동기화
- 위성영상 기준/비교 시점
- 침수흔적도 포함 여부
- 과거 피해·대응·복구 사례 선택
을 Situation ID별 localStorage에 저장하고 보고서 초안 API에 전달한다.
