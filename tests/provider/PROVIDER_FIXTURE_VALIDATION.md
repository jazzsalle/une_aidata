# Provider Fixture Validation 결과

- 생성시각: 2026-08-02T09:48:51.253Z
- 대상: provider 6종 × 케이스 3종(대표응답·오류·Timeout) = 18건 (통과 18건)
- 실행 방식: `.runtime-cjs` CJS 컴파일 산출물의 fixture 매퍼 함수만 실행 (fetch 호출 함수는 require만, 실행 0건 — 네트워크 호출 0건)

## 케이스별 결과

| Provider | Case | 종류 | 결과 | Lifecycle |
|---|---|---|---|---|
| kma_nowcast | KMA-REP-01 | representative | PASS | FIXTURE_VALIDATED |
| kma_nowcast | KMA-ERR-01 | error | PASS | FIXTURE_VALIDATED |
| kma_nowcast | KMA-TMO-01 | timeout | PASS | FIXTURE_VALIDATED |
| hrfco_hydrology | HRFCO-REP-01 | representative | PASS | FIXTURE_VALIDATED |
| hrfco_hydrology | HRFCO-ERR-01 | error | PASS | FIXTURE_VALIDATED |
| hrfco_hydrology | HRFCO-TMO-01 | timeout | PASS | FIXTURE_VALIDATED |
| une_rag | UNERAG-REP-01 | representative | PASS | FIXTURE_VALIDATED |
| une_rag | UNERAG-ERR-01 | error | PASS | FIXTURE_VALIDATED |
| une_rag | UNERAG-TMO-01 | timeout | PASS | FIXTURE_VALIDATED |
| t3q_event | T3QEVT-REP-01 | representative | PASS | FIXTURE_VALIDATED |
| t3q_event | T3QEVT-ERR-01 | error | PASS | FIXTURE_VALIDATED |
| t3q_event | T3QEVT-TMO-01 | timeout | PASS | FIXTURE_VALIDATED |
| t3q_risk | T3QRSK-REP-01 | representative | PASS | FIXTURE_VALIDATED |
| t3q_risk | T3QRSK-ERR-01 | error | PASS | FIXTURE_VALIDATED |
| t3q_risk | T3QRSK-TMO-01 | timeout | PASS | FIXTURE_VALIDATED |
| t3q_spatial | T3QSPA-REP-01 | representative | PASS | FIXTURE_VALIDATED |
| t3q_spatial | T3QSPA-ERR-01 | error | PASS | FIXTURE_VALIDATED |
| t3q_spatial | T3QSPA-TMO-01 | timeout | PASS | FIXTURE_VALIDATED |

## 상태 구분 (v1.1 준비상태 규칙)

- 본 결과의 `FIXTURE_VALIDATED`는 "대표응답·오류·Timeout이 fixture로 검증됨" 상태이며, "URL·인증키가 설정됨"(configured)과 구분된다.
- **DEFAULT 전환 아님**: 어떤 Provider도 기본 Provider로 전환하지 않으며 Mock/Seed 기본운영을 유지한다.
- **실호출 없음**: 실제 T3Q·공공 Open API·UNE RAG 호출을 수행하지 않았다. 게이트는 global fetch 가드로 네트워크 호출 0건을 단언한다.
- **Phase 8 Shadow Test 전 단계**: SHADOW_TESTED→SELECTABLE 승격은 Phase 8에서 승인 기반으로만 진행한다.
- fixture 유래 산출값은 전부 `official_data=false`·mock 상태이며 실제 관측·공식자료로 표시하지 않는다.
