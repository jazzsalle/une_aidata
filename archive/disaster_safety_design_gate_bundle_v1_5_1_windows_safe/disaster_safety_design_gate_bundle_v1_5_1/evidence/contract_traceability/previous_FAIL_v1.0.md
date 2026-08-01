# 재난안전 AI데이터 활용 시범서비스 최종 추적성 점검 결과 v1.0

- 점검일: 2026-08-01
- 기준선: 통합설계서 v1.8 / Source v1.5 / 통합패키지 v1.5
- 점검대상: 설계서, Source, OpenAPI, JSON Schema, Seed, Runtime Regression, Provider Conformance, SHA-256 패키지 무결성
- 종합판정: **FAIL — 설계 종료 보류**
- 글로드코드 최종 개발 인계문서: **미작성 유지**

## 1. 종합 결론

Runtime Regression과 Provider Conformance의 핵심 업무 로직은 재실행 결과 통과하였다. 또한 독립 Source와 통합패키지 내 Source는 파일 단위로 동일하며, 설계서 원본과 패키지 내 설계서도 SHA-256이 동일하다.

그러나 통합설계서 v1.8이 설계 완료 기준으로 제시한 **“기능·화면·데이터·API·시험 구조 일치”**를 최종 추적성 관점에서 충족하지 못했다. OpenAPI와 실제 Vercel Function 경로가 불일치하고, 여러 JSON Schema가 현재 Seed 및 TypeScript Domain 계약과 직접 호환되지 않으며, 설계서의 Endpoint·개발파일 동기화 표가 이전 버전 경로를 유지하고 있다. 따라서 현재 상태에서는 설계 종료를 선언할 수 없다.

## 2. 통과 항목

| 점검항목 | 결과 | 근거 |
|---|---|---|
| 설계서 원본 ↔ 통합패키지 설계서 | PASS | SHA-256 동일: `2e4c7216...2628ee` |
| 독립 Source ↔ 통합패키지 Source | PASS | 462개 파일 트리 `diff -qr` 차이 없음 |
| 독립 Source SHA-256 Manifest | PASS | 461개 항목 전부 OK |
| 통합패키지 SHA-256 Manifest | PASS | 469개 항목 전부 OK |
| Vercel 저장소 구조검사 | PASS | 547 entries 검증 |
| Functions TypeScript | PASS | `tsc -p tsconfig.functions.json --noEmit` |
| Seed 안전·범위 Smoke | PASS | 예측금지·공식위험도 금지·확인필수 규칙 통과 |
| 15 Event / 5 Situation Runtime Regression | PASS | 전체순위·결정성·요인점수·결측 재정규화·대응비교 통과 |
| CQ 5문 Event·Passage·lineage | PASS | 15 Event / 73 Passage / 73 Relation 계약 통과 |
| 보고서 Context 연계 | PASS | 선택 Event·7개 요인·대응비교·우선확인지역 반영 |
| Provider Conformance 8개 예상판정 | PASS | PASS 1 / CONDITIONAL 2 / BLOCKED 2 / FAIL 3, 예상과 전부 일치 |
| React/Vite 의존성 설치 재시도 | BLOCKED | 내부 npm registry에서 `@playwright/test` 404 재현 |

## 3. 설계 종료 차단 결함

### B-01. OpenAPI ↔ 실제 API 경로 불일치

- 실제 API Route: 31개
- OpenAPI Operation: 23개
- 실제 구현됐으나 OpenAPI에 없는 경로: 10개
  - `/api/health`
  - `/api/v1/integrations/status`
  - `/api/v1/integrations/une-rag-probe`
  - `/api/v1/observations/hydrology`
  - `/api/v1/observations/kma-nowcast`
  - `/api/v1/satellite-assets/metrics`
  - `/api/v1/satellite-assets/select`
  - `/api/v1/satellite-evidence-sets`
  - `/api/v1/scenarios`
  - `/api/v1/similar-events/detail`
- OpenAPI에 있으나 실제 Route가 없는 경로: 2개
  - `GET /api/v1/events/{eventId}`
  - `POST /api/v1/situation-views`
- `/mock/catalog`, `/mock/spatial`, `/mock/scenarios`는 `get:` 아래 Operation 내용이 비어 있고 `summary/responses`가 Path Item 레벨에 배치되어 OpenAPI Operation 계약이 불완전하다.
- 23개 Operation 중 명시적 응답 Schema `$ref`가 있는 Operation은 5개뿐이다.

**판정:** 설계 종료 차단. Endpoint와 DTO·오류가 동일해야 한다는 설계 원칙 미충족.

### B-02. JSON Schema ↔ Seed·TypeScript 계약 불일치

독립 JSON Schema 29종은 문법상 유효하나, 실제 Seed와의 계약검증에서 다음 불일치가 확인되었다.

| 대상 | 검증결과 | 주요 불일치 |
|---|---:|---|
| CurrentSituation Seed | 0/5 통과 | 내부 Observation 필수필드·필드명 불일치 |
| Observation | 0/16 통과 | Schema는 `observation_id/provider/data_status` 필수, Source는 `source_provider/value_status` 사용 |
| DamageRecoveryRecord | 0/15 통과 | 현재 Provider·provenance·조건·대응 필드를 additional property로 거부 |
| T3Q Event Master | 12/15 통과 | `risk_factors[]`의 null 3건 허용 불일치 |
| T3Q Mock Search Scenario | 0/1 통과 | Schema는 `MOCK_ONLY`, Seed는 `MOCK_FIRST_PROVIDER_NEUTRAL` |
| ProcedureStep | 0/11 통과 | `step_id` 누락, `procedure_id` 사용, `provisional_reference` enum 불일치 |
| SatelliteAsset | 0/21 통과 | `river_id`를 additional property로 거부 |
| ReportDraft | 0/1 통과 | `limitations` 필수이나 Seed에 없음 |
| Evidence | 0/15 통과 | `excerpt`, `lineage`를 additional property로 거부 |
| SimilarityScoreSummary Runtime 객체 | 75/75 통과 | 요인별 점수 Domain 계약은 정합 |
| Provider Conformance Result | 1/1 통과 | Source v1.5 신규 계약 정합 |

현재 `smoke_seed_contracts.py`는 전체 JSON Schema 검증이 아니라 일부 안전규칙만 검사한다. 따라서 설계서의 “OpenAPI/JSON Schema 파싱 재검증 통과”는 **문법 파싱 통과**로는 성립하지만, **Seed·Runtime 계약 적합성 통과**로 해석할 수 없다.

**판정:** 설계 종료 차단. Schema가 실제 Seed·Domain 계약의 정본 역할을 하지 못함.

### B-03. 통합설계서의 Endpoint·개발파일 동기화 표 노후화

통합설계서 부록 Endpoint 표 20개 중 실제 구현과 일치하는 것은 11개이며, 9개는 현재 Source에 없다.

- 미구현/이전설계 경로: `GET /situations/{id}`, `GET /events/{eventId}`, `GET /spatial-objects/{id}`, `PATCH /procedure-steps/{id}/status`, `POST /satellite-comparisons`, `PATCH /reports/drafts/{id}`, `POST/GET /situation-views`, `GET /evidence/{id}`
- 설계서 개발파일 동기화 표는 존재하지 않는 경로를 다수 참조한다.
  - `docs/05_agent_tools.md` → 실제 `docs/06_agent_tools.md`
  - `docs/07_data_model.md` → 실제 `docs/08_data_model.md`
  - `docs/08_gis_satellite_design.md` → 실제 `docs/09_gis_vworld.md`
  - `docs/09_manual_procedure_design.md` 없음
  - `docs/10_test_cases.md` → 실제 `docs/12_test_plan.md`
  - `schemas/`, `openapi/`, `mock/` → 실제 `contracts/schemas/`, `contracts/openapi/`, `data/seed/`
- `docs/07_api_contracts.md` 역시 정본을 `openapi/`와 `schemas/`로 표기하여 실제 디렉터리와 다르다.

**판정:** 설계 종료 차단. 설계서에서 Source 기준선을 재현할 수 없음.

### B-04. 기준선 Manifest 버전 불일치

`handoff/source_design_manifest_v1.5.json`의 baseline이 `Source v1.4 Runtime Regression / Design v1.7`로 남아 있다. 현재 공식 기준선은 Design v1.8 / Source v1.5이다.

**판정:** 설계 종료 차단. 기준선 식별 오류.

## 4. 비차단 정리 항목

| ID | 항목 | 조치 |
|---|---|---|
| C-01 | `scripts/validate_repo.py`가 제거된 .NET API(`apps/api/*.cs`)를 요구하여 실패 | 삭제 또는 `deprecated` 명시. 공식 validate는 `validate_vercel_repo.py` 하나로 고정 |
| C-02 | `CLAUDE.md` 제목이 v1.1, `/api/health` 버전이 0.2.0 | Source v1.5 기준으로 갱신 |
| C-03 | Source에 과거 `DEVELOPMENT_HANDOFF_*` 다수 포함 | 역사자료 폴더로 격리하거나 최종 인계문서와 명확히 구분 |
| C-04 | `package-lock.json` 없음 | 패키지 설치 가능한 환경에서 생성 후 버전 고정 |
| C-05 | React Type Check/Production Build/Playwright/Vercel Preview 미수행 | 기존 결정대로 개발 Gate로 이관 가능. 다만 인계문서에 명시 필수 |

## 5. 설계 종료 Gate 재판정

| 완료기준 | 설계서 자체판정 | 최종 추적성 재판정 |
|---|---|---|
| 기능·화면·데이터·API·시험 구조 일치 | 충족 | **미충족** — B-01, B-02, B-03 |
| Provider·Adapter·공통모델 교체구조 | 충족 | 충족 |
| 유사도·대응비교·CQ·보고서 추적성 | 충족 | 충족 |
| 데이터 상태·출처·품질·근거 규칙 | 충족 | 계약 의도는 충족, Schema 정합은 미충족 |
| 외부 Provider 실제 Endpoint | 비차단 | 비차단 유지 |
| React Build·Playwright·Preview | 비차단 | 비차단 유지, 개발 Gate 이관 |
| 기준선·형상식별 | 명시 없음 | **미충족** — B-04 |

### 최종 판정

> **FAIL — 설계 종료 보류**

Runtime 업무로직은 설계 의도를 충족하지만, 공식 계약산출물인 OpenAPI·JSON Schema·설계서 부록·Source Manifest 간 불일치가 남아 있다. 이 상태에서 글로드코드 개발 인계문서를 작성하면 개발자가 잘못된 Endpoint와 Schema를 정본으로 사용할 위험이 있다.

## 6. 보완 및 재검증 순서

1. **Source v1.5.1 계약 패치**
   - 실제 Route 기준 OpenAPI 전면 동기화
   - 미구현 Endpoint 삭제 또는 명시적 Backlog 상태로 분리
   - `/mock/*` Operation 들여쓰기·responses 수정
2. **Schema 정합 패치**
   - TypeScript Domain을 정본으로 할지 JSON Schema를 정본으로 할지 결정
   - Observation, DamageRecovery, Procedure, Satellite, Report, Evidence, T3Q Event/Scenario 계약 동기화
   - 모든 Seed와 Runtime Fixture를 검증하는 `validate_json_schema_contracts.py` 추가
3. **설계서 v1.8.1 정정**
   - 부록 D Endpoint 상세목록 최신화
   - 개발파일 동기화 경로 최신화
   - OpenAPI/Schema “파싱”과 “계약검증” 표현 구분
4. **형상 기준선 정리**
   - `source_design_manifest_v1.5.1.json`을 Design v1.8.1 / Source v1.5.1로 생성
   - 현재 SHA-256, 파일목록, 시험결과 ID 포함
   - obsolete validator·과거 handoff 문서 정리
5. **재시험 및 재패키징**
   - 전체 Smoke, Functions TypeScript, Runtime Regression, Provider Conformance, OpenAPI semantic, JSON Schema full contract test
   - 새 SHA-256 Manifest와 통합패키지 생성
6. **최종 추적성 재점검 후 설계 종료 선언**
   - 종료 선언이 확정된 뒤에만 글로드코드 최종 개발 인계문서 작성

## 7. 기준선 해시

| 파일 | SHA-256 |
|---|---|
| 통합설계서 v1.8 | `2e4c7216cfe27fbf09b826ab28b59f14f3c9c37b38e9607ddbe0a3278a2628ee` |
| Source v1.5 ZIP | `9797fe432e17fe52656e9a281602855320b9231f64f34bf23e17726365befcc4` |
| 통합패키지 v1.5 ZIP | `5c630b5ab9237d6273b9d5dbfaf7d1ba232a8b91bba470b8382779e385c138c4` |

