# Runtime Regression Gate 결과

- 생성시각: 2026-08-01T17:35:21.022Z
- Event: 15건
- 상황: 5건
- CQ: 5건
- 런타임 모드: MOCK_PROVIDER_NEUTRAL

## 종합 결과

| ID | 검증항목 | 결과 | 비고 |
|---|---|---|---|
| RG-01 | 15 Event 전체 순위·결정성 | PASS |  |
| RG-02 | 요인별 점수·가중치 재정규화 | PASS |  |
| RG-03 | 현재 확인사항·과거 대응비교 | PASS |  |
| RG-04 | CQ 5문 Event·Passage·lineage | PASS |  |
| RG-05 | 보고서 선택근거·점수·대응비교 연계 | PASS |  |
| RG-06 | React/Vite Production Build | BLOCKED | 내부 npm registry에서 React/Vite/@playwright/test 패키지 조회 404. 전체 React production build는 외부 개발환경에서 재실행 필요. |

## 화면 순위 검증

| 상황 ID | 지역 | 1위 Event | 점수 | 순위대상 |
|---|---|---|---:|---:|
| SIT-NW-POC-001 | 전북특별자치도 남원시 | EVT::20230809-FLOOD-45190-902 | 60 | 15 |
| SIT-UW-POC-001 | 경기도 의왕시 | EVT::20240718-FLOOD-41430-901 | 56 | 15 |
| SIT-GM-POC-001 | 경상북도 구미시 | EVT::20230810-TYPH-47190-901 | 61 | 15 |
| SIT-UW-SLOPE-POC-001 | 경기도 의왕시 | EVT::20240805-SLOPE-41430-901 | 64 | 15 |
| SIT-GM-SLOPE-POC-001 | 경상북도 구미시 | EVT::20240712-SLOPE-47190-901 | 62 | 15 |

## CQ 5문 검증

| CQ | 질문 | Event | Passage 수 |
|---|---|---|---:|
| CQ-01 | 범람 위험 하천 확인 | EVT::20200801-FLOOD-45190-001, EVT::20200801-FLOOD-45190-002, EVT::20100801-FLOOD-45190-001, EVT::20200713-FLOOD-45190-901, EVT::20230809-FLOOD-45190-902 | 5 |
| CQ-02 | 저지대 침수 위험지역 확인 | EVT::20090701-FLOOD-41430-002, EVT::20160701-FLOOD-41430-001, EVT::20170701-FLOOD-41430-001, EVT::20240718-FLOOD-41430-901 | 4 |
| CQ-03 | 산사태 위험지역 검색 구조 | EVT::20240712-SLOPE-47190-901 | 1 |
| CQ-04 | 수위계·우량계 확인 | EVT::20200801-FLOOD-45190-001, EVT::20200801-FLOOD-45190-002, EVT::20100801-FLOOD-45190-001, EVT::20200713-FLOOD-45190-901, EVT::20230809-FLOOD-45190-902 | 5 |
| CQ-05 | 과거 침수지역·사례 조회 | EVT::20100901-TYPH-41430-001, EVT::20090701-FLOOD-41430-001, EVT::20090701-FLOOD-41430-002, EVT::20160701-FLOOD-41430-001, EVT::20170701-FLOOD-41430-001, EVT::20240718-FLOOD-41430-901 | 12 |

## 제한사항

내부 npm registry에서 React/Vite/@playwright/test 패키지 조회 404. 전체 React production build는 외부 개발환경에서 재실행 필요.

Core Domain/API와 독립 브라우저 회귀 대시보드는 검증했으나, React·Vite 실제 Production Build 및 기존 React 화면 E2E는 패키지 설치가 가능한 개발환경에서 재실행해야 한다.
