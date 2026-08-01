# ADR-017 Provider 계약 적합성 Gate와 혼합운영

## Status
Accepted

## Context

현재 POC는 Mock/Seed Provider로 동작하며 T3Q와 공공 Open API의 실제 Endpoint·대표응답은 미확정이다. Mock 구조는 단순 임시자료가 아니라 향후 공급기관에 요구할 API 콘텐츠와 스키마의 기준이다.

## Decision

1. Provider는 Event, Risk, Observation, Spatial 도메인별로 독립 선택한다.
2. 모든 Provider 응답은 Adapter/Mapper를 통해 공통 Domain Model로 변환한다.
3. 전환은 `DRAFT → FIXTURE_VALIDATED → SHADOW_TESTED → SELECTABLE → DEFAULT` 단계로 승인한다.
4. Evidence/lineage, 단위, 관측시각, Geometry/CRS, 출처·상태 메타데이터 위반 시 Provider 승격을 차단한다.
5. 혼합 Provider 운영을 허용하되 화면·지도·보고서에 실제 사용 Provider와 Fallback 상태를 표시한다.
6. 외부 Provider 미확보는 Mock 기본운영을 중단시키지 않는다.

## Consequences

- 실제 T3Q/Open API 연계 시 화면 재개발보다 Mapper와 계약시험에 집중할 수 있다.
- 공급기관에 요구할 필드가 명확해진다.
- 실제 Endpoint의 품질 문제를 Mock 값으로 은폐할 수 없다.
- Provider별 Fixture와 shadow 시험이 추가로 필요하다.
