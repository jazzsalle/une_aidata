# Provider Shadow Test·승격 절차 — Phase 8

## 1. 목적과 범위

`docs/27_provider_conformance_and_design_completion_gate.md`의 승격 사다리를 기준으로, FIXTURE_VALIDATED 상태의 6개 Provider(kma_nowcast, hrfco_hydrology, une_rag, t3q_event, t3q_risk, t3q_spatial)를 Shadow Test와 승인 절차를 거쳐 단계적으로 승격하는 절차를 정의한다.

승격 사다리:

`DRAFT → FIXTURE_VALIDATED → SHADOW_TESTED → SELECTABLE → DEFAULT`

**Phase 8 범위는 SHADOW_TESTED → SELECTABLE까지의 승인 기반 단계 승격이다. DEFAULT 전환은 Phase 8 범위 밖이며 금지한다.** `data/seed/provider_contracts_seed.json`의 `current` 값은 `mock`으로 불변이다.

현재 상태 기록은 `tests/provider/provider_promotion_status.json`에 유지하며, 승격·승인 시 해당 파일의 `lifecycle`과 `approvals`만 갱신한다(계약·Seed 변경 금지).

## 2. 핵심 절차 규칙

1. **로컬 셸 env로만 Shadow Test 실행.** 이 코드베이스는 별도의 스위치 없이 env 키가 설정되면 즉시 실경로로 전환된다(예: `kmaConfigured()`는 `DATA_GO_KR_SERVICE_KEY` 존재만으로 활성, `uneRagConfigured()`는 `UNE_RAG_BASE_URL`+인증 존재만으로 활성). 따라서 Shadow Test는 반드시 **로컬 셸 환경변수로만** 실행하고, SELECTABLE 승격 승인 전까지 Vercel 환경변수에 어떤 Provider 키도 설정하지 않는다.
2. **Vercel env 설정 = SELECTABLE 승격 행위.** Vercel 환경변수에 키를 설정하는 것 자체가 배포 환경 실경로 전환이므로, 승인2 완료 후 사용자가 직접 수행한다. 에이전트·스크립트가 대신 설정하지 않는다.
3. **Provider별 2단계 승인.**
   - 승인1 (FIXTURE_VALIDATED → SHADOW_TESTED): 로컬 Shadow Test 결과 요약(Mock 대비 실제 응답 비교, 오류·Timeout 동작)을 검토하고 승인한다.
   - 승인2 (SHADOW_TESTED → SELECTABLE): Vercel Preview에서 실표시·Fallback 동작 확인과 회귀 번들 재통과를 확인하고 승인한다.
   - 각 승인은 `provider_promotion_status.json`의 `approvals` 배열에 승인 단계·일시·승인자를 기록한다.
4. **provider_contracts_seed.json `current=mock` 불변.** 승격은 상태 기록과 env 기반 선택 가능성의 변화이지 Seed 계약의 변경이 아니다.
5. **키·비밀값 기록 금지.** API 키·인증정보를 코드·문서·결과 파일(JSON 포함)에 기록하지 않는다. Shadow 결과 파일에는 키가 아닌 설정 여부(boolean)와 응답 요약만 남긴다.

## 3. Provider별 선행조건과 실행 명령

Shadow Test 실행 명령(로컬 셸에서 env 설정 후 실행):

```
npm run test:provider-shadow -- --provider <provider_id>
```

| provider_id | 선행조건 | 승격 보류 |
|---|---|---|
| kma_nowcast | `DATA_GO_KR_SERVICE_KEY`(로컬 셸 env) | 없음 |
| hrfco_hydrology | `HRFCO_API_BASE_URL` 등 env, `HRFCO_STATION_MAP_JSON`에 `official_station_code` 포함 (v0.7 규칙 4 — 없으면 수위·유량 API 호출 금지, 사용자 입력·Scenario 유지) | 없음 |
| une_rag | `UNE_RAG_BASE_URL`·인증(로그인 또는 API Key), Swagger(`probeUneRagOpenApi`) 접근 확인 후 `UNE_RAG_SEARCH_PATH` 설정 (v0.7 규칙 5 — 경로·응답형식 추정 금지, `UNE_RAG_*_FIELD`·`UNE_RAG_RESPONSE_ARRAY_PATH`로 보류) | 없음 |
| t3q_event | T3Q 실 Endpoint·인증 계약 확정 | **보류** — 실 Endpoint 미확정, mock_only 정책 유지 (CLAUDE.md v1.0) |
| t3q_risk | T3Q 실 Endpoint·인증 계약 확정 | **보류** — 동일 |
| t3q_spatial | T3Q 실 Endpoint·인증 계약 확정, 홍수위험지역·위험저수지·풍수해개선지구 좌표계·Geometry·속성·공개등급 검증 | **보류** — 동일 (v1.1: 검증 전 활성화 금지) |

t3q 3종은 `promotion_hold=true` 상태이며, 실 Endpoint 계약 확정 전까지 Shadow Test를 시도하지 않는다.

## 4. 회귀 번들 (승인2 전 재통과 필수)

SELECTABLE 승격 승인 전, 아래 번들을 순서대로 재실행하여 전부 통과해야 한다. Windows 환경에서는 npm 스크립트의 `python3`를 `python`으로, `.sh`는 Git Bash로 실행한다.

1. `npm run validate`
2. `npm run test:contracts`
3. `npm run typecheck`
4. `npm run test:provider-fixtures`
5. `npm run test:evidence-console`
6. `npm run test:report-console`
7. `npm run test:observation-provider`
8. `npm run test:e2e`

## 5. 참고 불일치 기록 (수정하지 않음)

`data/seed/provider_contracts_seed.json`의 observation 도메인에 정의된 `env_key: "OBSERVATION_PROVIDER"`는 현재 코드에서 사용되지 않는다. 실제 전환은 `POC_DATA_MODE`(`server/env.ts`의 `dataMode()`)와 Provider별 키 존재 여부(`kmaConfigured()`, HRFCO env 완비, `uneRagConfigured()`)로 결정된다(`server/providers/publicObservation.ts` 참조). 이 불일치는 계약 변경 금지 원칙에 따라 수정하지 않고 여기에 명시만 한다.
