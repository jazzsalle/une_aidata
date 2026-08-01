# Provider 계약 적합성·혼합운영·설계 완료 Gate — Source v1.5

## 1. 단계 목적

Source v1.4의 15개 Event 런타임 회귀시험을 설계 기준선으로 고정하고, Mock/Seed 계약을 향후 T3Q·공공 Open API 실제 응답으로 교체하기 위한 Provider 적합성 Gate를 정의한다.

이 단계는 실제 T3Q Endpoint를 호출하지 않는다. 현재 Mock/Seed 필드가 향후 제공요청 API의 최소 콘텐츠이며, 제공기관 응답은 Adapter/Mapper를 통해 동일 Domain Model로 변환되어야 한다.

## 2. 설계 불변조건

- 화면은 Provider 원천 필드를 직접 참조하지 않는다.
- Event 유사도와 Passage 검색 관련도는 분리한다.
- 요인별 기여도 합계와 최종점수는 동일한 Weight Profile 및 결측 재정규화 규칙을 사용한다.
- 모든 Event 근거는 `RefDisasterEventID`와 Passage lineage로 추적 가능해야 한다.
- 대응비교와 보고서 근거는 화면에서 선택한 Event·Passage·우선확인지역 Context와 동일해야 한다.
- Mock/Scenario/Synthetic/Actual/Open API/T3Q/Derived 상태를 화면·보고서에서 숨기지 않는다.
- 외부 Provider 실패 시 Fallback은 가능하지만 출처와 실패상태를 명시한다.

## 3. Provider 승격 단계

`DRAFT → FIXTURE_VALIDATED → SHADOW_TESTED → SELECTABLE → DEFAULT`

- `DRAFT`: 대표응답 또는 필수 계약 미확보
- `FIXTURE_VALIDATED`: 정적 Fixture와 Mapper 계약시험 통과
- `SHADOW_TESTED`: Mock 결과와 실제 Provider 결과를 병행 비교
- `SELECTABLE`: 환경변수 선택, 오류/Fallback, 화면·보고서 회귀시험 통과
- `DEFAULT`: 승인 후 기본 Provider로 전환

## 4. 도메인별 수용조건

### Event Provider

Event ID, T코드, 행정구역, 발생기간, 기상·수문조건, 피해·대응·복구, 사건 유사도, 요인별 점수, Evidence/Passage/lineage, 공간객체 관계를 제공해야 한다.

### Risk Provider

위험지구 ID, 재난코드, 위험요인, 임계값의 값·단위·산정근거, 저감대책, 계획 버전, Geometry 참조, Evidence를 제공해야 한다.

### Observation Provider

관측소 ID·종류·좌표, 값·단위, 관측시각, 품질, 경보기준, 제공기관을 제공해야 한다. 최신성 초과 데이터는 폐기하지 않고 STALE로 표시하며 판단 신뢰도를 낮춘다.

### Spatial Provider

공간객체·레이어 ID, Geometry, CRS, 행정코드, 재난코드, 기준일, 속성, Evidence를 제공해야 한다. CRS 또는 Geometry가 공통계약과 다르면 지도 표출을 차단한다.

## 5. 혼합운영

- Event/Risk: T3Q 또는 Mock/Seed
- Observation: 공공 Open API, T3Q 또는 Scenario Mock
- Spatial: T3Q, 공공 GIS 또는 Local GeoJSON

각 도메인을 독립적으로 전환할 수 있으며, 하나의 Provider 미연계가 전체 POC를 중단시키지 않는다. 단, 각 카드·레이어·보고서 근거에는 실제 사용된 Provider와 상태를 표시한다.

## 6. 계약시험 시나리오

8개 케이스로 기본 Mock 운영, T3Q/Open API 미연계, 혼합 Fixture, CRS 오류, Evidence 누락, 관측 최신성 초과, 임계값 단위 누락을 검증한다.

Source v1.5의 `provider_conformance_cases_seed.json`과 `smoke_provider_conformance_gate.py`가 이를 자동검증한다.

## 7. 설계 완료 Gate

다음이 충족되면 기능·데이터·연계구조 설계를 완료상태로 전환한다.

1. 통합설계서와 Source/Schema/OpenAPI의 버전·필드가 일치한다.
2. 15개 Event 런타임 순위·요인점수·대응비교·CQ 5문·보고서 회귀시험이 통과한다.
3. Provider 적합성 8개 계약 케이스가 예상판정과 일치한다.
4. Mock/Seed와 실제 공급데이터의 상태·출처·근거 표출규칙이 확정된다.
5. React Production Build·Playwright E2E는 실제 개발환경의 별도 개발 Gate로 남기고 설계완료와 구분한다.
6. T3Q·Open API 실제 Endpoint 미확보는 설계 미완료가 아니라 Provider의 `DRAFT` 상태로 관리한다.

## 8. 다음 단계

- 통합설계서에 Source v1.4 런타임 회귀결과와 Source v1.5 Provider 적합성 Gate를 반영한다.
- 화면·API·스키마·시험 간 최종 추적성을 확인한다.
- 설계 종료 선언 후에만 글로드코드 개발 인계문서를 작성한다.
