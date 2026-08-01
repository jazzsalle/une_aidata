# 글로드코드 개발 인계문서 v1.0

## 1. 인계 기준선

- 통합설계서: `재난안전_AI데이터_활용_시범서비스_통합설계서_v1.8.1.docx`
- Source: `vercel-source-v1.5.1`
- 통합패키지: `disaster_safety_design_gate_bundle_v1_5_1_windows_safe`
- 설계 종료 판정: PASS
- 실행정책: Mock/Seed 기본운영 + Provider-neutral 교체구조
- 실제 T3Q·공공 Open API 호출: 수행하지 않음

이 문서는 이전 `DEVELOPMENT_HANDOFF_*` 문서를 대체하는 최종 개발 인계 기준이다. 과거 문서는 이력 참고용이며 구현 정본으로 사용하지 않는다.

## 2. 구현 범위와 금지사항

### 구현 범위
- `/dashboard`: 현재상황 입력, VWorld 지도, 우선 확인지역, 유사사례, 대응절차, Agent 질의
- `/evidence`: PRE/EVENT/POST 위성영상·수계마스크, 침수흔적, 피해·대응·복구 근거
- `/report`: 선택 근거와 유사도·대응비교가 연계된 상황보고서 검토용 초안
- Vercel Functions 31개 API Route
- Event·Risk·Observation·Spatial Provider 독립 교체

### 금지사항
- 피해예측 결과로 표현하지 않는다.
- 우선 확인지역을 공식 위험도 또는 자동 조치결정으로 표현하지 않는다.
- Seed·Synthetic·Mock 자료를 실제 관측·공식자료로 표시하지 않는다.
- CCTV·지자체 개별 실증시스템 Context·NDMS 자동제출을 구현범위에 포함하지 않는다.
- T3Q 내부 기술스택을 UNE 확정 기술스택으로 간주하지 않는다.

## 3. 실행·빌드

```bash
cp .env.example .env.local
npm install
npm run validate
npm run test:contracts
npm run typecheck:functions
npm run test:runtime-gate
npm run test:provider-conformance
npm run build
npm run test:e2e
```

현재 패키지 환경에서는 `@playwright/test` registry 404가 확인되었으므로 `npm install`, React Production Build, Playwright, Vercel Preview는 외부 개발환경에서 수행한다. Functions TypeScript와 Python/Node 계약시험은 PASS 상태이다.

## 4. 계약 정본

- Backend OpenAPI: `contracts/openapi/poc-backend.yaml`
- UNE RAG Adapter: `contracts/openapi/une-rag-adapter.yaml`
- 공공관측 Adapter: `contracts/openapi/public-observation-adapter.yaml`
- JSON Schema: `contracts/schemas/*.schema.json`
- TypeScript Domain: `server/contracts.ts`, `apps/web/src/types/contracts.ts`
- Seed: `data/seed/*.json`
- 브라우저 Seed: `apps/web/public/seed/*.json`

OpenAPI는 `api/**/*.ts` 31개 Route와 Method·Path가 1:1 일치한다. JSON Schema 계약시험은 18종 Schema, 260개 Seed·Fixture·Runtime 객체를 검증한다.

## 5. 15개 Mock Event와 유사도

- Event Master: `data/seed/t3q_mock_event_master_seed.json` — 15건
- 피해·대응·복구 사례: `data/seed/damage_recovery_events_seed.json` — 15건
- Passage: `data/seed/t3q_mock_passages_seed.json` — 73건
- Ontology Relation: `data/seed/t3q_mock_ontology_relations_seed.json` — 73건
- Weight Profile: `data/seed/similarity_weight_profiles_seed.json` — 4종

유사도 계산 원칙:
- `event_similarity_score`와 `retrieval_relevance_score`를 분리한다.
- 요인별 `contribution_score` 합계는 사건 유사도와 일치해야 한다.
- 결측요인은 `NOT_AVAILABLE`로 처리하고 사용 가능한 가중치만 100으로 재정규화한다.
- `comparison_coverage`와 `confidence_status`를 화면에 표시한다.
- Graph 정보가 없으면 `graph_similarity_score=null`, `graph_similarity_status=NOT_AVAILABLE`이다.

## 6. 대응비교·CQ·보고서 연계

- 대응비교: 현재 `required_checks`와 과거 `response`를 병렬 비교하며 자동 권고로 확정하지 않는다.
- CQ 5문: `data/seed/t3q_cq_coverage_seed.json`, `data/seed/t3q_mock_search_scenarios_seed.json`
- 보고서: 선택 Event, 요인점수, 대응비교, 우선 확인지역, 위성 EvidenceSet ID를 동일 ID·버전으로 전달한다.
- 보고서 결과는 검토용 초안이며 NDMS 자동제출이 아니다.

## 7. Provider 교체구조

환경변수:
- `EVENT_PROVIDER=mock|t3q`
- `RISK_PROVIDER=mock|t3q`
- `OBSERVATION_PROVIDER=mock|openapi`
- `SPATIAL_PROVIDER=mock|t3q|openapi|local`

승격단계:
`DRAFT → FIXTURE_VALIDATED → SHADOW_TESTED → SELECTABLE → DEFAULT`

외부 Provider는 대표응답 Fixture, CRS·단위·관측시각·Evidence/lineage, Fallback 회귀시험을 통과하기 전 DEFAULT로 승격하지 않는다.

## 8. 주요 환경변수

`.env.example`을 정본으로 사용한다. 비밀정보는 저장소에 커밋하지 않는다.

- VWorld: `VITE_VWORLD_MAP_KEY`, `VWORLD_SERVER_API_KEY`
- UNE RAG: `UNE_RAG_BASE_URL`, 인증정보, 경로·응답 매핑
- 기상청: `DATA_GO_KR_SERVICE_KEY`, `KMA_ULTRA_SRT_NCST_URL`
- 홍수통제소: `HRFCO_*`, 공식 관측소 매핑
- T3Q: `T3Q_API_BASE_URL`, `T3Q_API_KEY`, `T3Q_*_SEARCH_PATH`
- Runtime: `POC_DATA_MODE`, Provider 선택 변수

## 9. 검증 명령과 합격기준

```bash
python3 scripts/validate_vercel_repo.py
python3 scripts/validate_openapi_contracts.py
python3 scripts/validate_json_schema_contracts.py
tsc -p tsconfig.functions.json --noEmit
bash scripts/run_runtime_regression_gate.sh
python3 scripts/smoke_provider_conformance_gate.py
```

현재 결과:
- OpenAPI: 31 Route = 31 Operation, 누락·허상·빈 Operation 0
- JSON Schema: 260 객체 / 18 Schema PASS
- Runtime Regression: 15 Event / 5 Situation / CQ 5문 PASS
- Provider Conformance: 8개 예상판정 전건 일치
- 전체 Source Smoke 및 Functions TypeScript PASS

## 10. 미완료·외부 의존 항목

- `package-lock.json` 생성
- React Type Check·Production Build
- Playwright E2E
- Vercel Preview 배포와 VWorld 허용 도메인 확인
- T3Q 실제 Endpoint·인증·대표응답 Fixture
- 공공 API 키와 홍수통제소 공식 관측소 코드
- 쓰리디랩스 정식 위성영상·침수흔적 자료
- 대상 지자체 정식 풍수해 행동매뉴얼

위 항목은 개발·연계 Gate이며 설계 종료 차단사항이 아니다.

## 11. Git 기준점

업로드된 Source ZIP에는 `.git` 메타데이터가 없어 실제 Commit SHA 또는 Tag를 확인할 수 없다. 저장소 반영 시 다음 Tag를 권고한다.

`design-v1.8.1-source-v1.5.1`

Tag 생성 후 Commit SHA를 본 문서와 `handoff/source_design_manifest_v1.5.1.json`에 기록한다.

## 12. 개발 시작 순서

1. 기준선 ZIP을 새 브랜치에 반영하고 Git Tag를 생성한다.
2. `.env.example`에서 로컬 환경을 구성한다.
3. `validate`, `test:contracts`, Functions TypeScript, Runtime·Provider Gate를 먼저 재실행한다.
4. React Build·Playwright를 통과시킨다.
5. Mock/Seed 상태로 3개 페이지의 주요 사용자 흐름을 확인한다.
6. 외부 Provider는 도메인별 Fixture부터 연결하고 한 번에 DEFAULT로 전환하지 않는다.
7. 실제 Provider 활성화 후 화면·보고서·Fallback 회귀시험을 다시 수행한다.
