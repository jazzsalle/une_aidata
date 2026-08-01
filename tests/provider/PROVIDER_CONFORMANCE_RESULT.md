# Provider Conformance Gate Result — Source v1.5.1

## Summary

- Total: 8
- PASS: 1
- CONDITIONAL_PASS: 2
- BLOCKED: 2
- FAIL: 3

## Cases

| ID | Scenario | Actual | Lifecycle | Expected | Match |
|---|---|---|---|---|---|
| PCG-001 | 전체 Mock/Seed 기본운영 | PASS | SELECTABLE | PASS / SELECTABLE | PASS |
| PCG-002 | T3Q Event Provider 미연계 | BLOCKED | DRAFT | BLOCKED / DRAFT | PASS |
| PCG-003 | Open API Observation Provider 미연계 | BLOCKED | DRAFT | BLOCKED / DRAFT | PASS |
| PCG-004 | T3Q Event + Open API Observation 혼합운영 | CONDITIONAL_PASS | FIXTURE_VALIDATED | CONDITIONAL_PASS / FIXTURE_VALIDATED | PASS |
| PCG-005 | Spatial Geometry CRS 오류 | FAIL | DRAFT | FAIL / DRAFT | PASS |
| PCG-006 | Event Evidence·lineage 누락 | FAIL | DRAFT | FAIL / DRAFT | PASS |
| PCG-007 | 관측정보 최신성 초과 | CONDITIONAL_PASS | FIXTURE_VALIDATED | CONDITIONAL_PASS / FIXTURE_VALIDATED | PASS |
| PCG-008 | 위험지식 임계값 단위 누락 | FAIL | DRAFT | FAIL / DRAFT | PASS |

## Interpretation

- PASS는 현재 Mock/Seed 기본운영 계약이 공통 Domain Model과 상태표시 원칙에 맞음을 의미한다.
- CONDITIONAL_PASS는 Fixture 수준 적합이며, 실제 Endpoint shadow 시험과 화면·보고서 회귀시험 전에는 기본 Provider로 승격할 수 없다.
- BLOCKED는 Endpoint·인증·대표응답 또는 필수 Fixture가 없어 선택할 수 없는 상태다.
- FAIL은 CRS, 단위, Evidence/lineage 등 필수 계약을 위반한 상태이며 화면에 실제 데이터로 표출하지 않는다.
- 본 결과는 실제 T3Q RAG 성능이나 공공 API 정확도를 평가하지 않는다.
