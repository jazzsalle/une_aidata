# PROGRESS.md — 회사↔집 인계 기록

## Last updated
2026-08-02

## Current goal
Phase 8 — 실제 Provider Shadow Test 및 단계별 승격 (합격 기준: evaluation_criteria.md Phase 8, 승격마다 사용자 승인 필요)

## Done
- 기준선 정리: vercel-source-v1.5.1을 리포 루트로 승격, gate bundle은 archive/ 보관
- GitHub 연결: https://github.com/jazzsalle/une_aidata (main + 태그 design-v1.8.1-source-v1.5.1 push 완료)
- 하네스 구성: planner/generator/evaluator subagent, /phase-run, /handoff, /resume-work, evaluation_criteria.md, SessionStart hook
- **Phase 1 완료 (2026-08-02, evaluator PASS)**: npm install 성공(package-lock.json 생성, playwright 1.62.1 정상 — 404 재발 없음), validate·contracts(OpenAPI 31/31, JSON Schema 260/18)·typecheck:functions·typecheck:web·runtime-gate·provider-conformance 전부 PASS, `npm run build` 성공(apps/web/dist 산출). 계약 파일 변경 0건.

## Done this session
- **Phase 7 완료 (2026-08-02, evaluator PASS)**: 외부 Provider별 Fixture 연계 (FIXTURE_VALIDATED)
  - data/fixtures/providers/ 6종(kma_nowcast·hrfco_hydrology·une_rag·t3q_event·t3q_risk·t3q_spatial) × 대표응답·오류·cases 18파일
  - server/providers 매퍼 export: mapKma/mapHrfco/mapUneRag FixturePayload·Error (실 fetch 경로 무변경), t3qFixtureAdapter.ts 신규(라우트 미연결, 매핑 검증 전용)
  - tests/provider/provider_fixture_gate.cjs + scripts/run_provider_fixture_gate.sh (`npm run test:provider-fixtures`): 6×3=18케이스, fetch 가드로 network calls 0 단언, actual 위장 전수 스캔
  - FIXTURE_VALIDATED 기록: tests/provider/provider_fixture_validation_result.json + PROVIDER_FIXTURE_VALIDATION.md (seed·계약 무변경, current=mock 유지, DEFAULT 미전환)
  - integrations/status.ts message에 FIXTURE_VALIDATED 병기 (validation_state enum 불변)
  - cp949 인코딩 수정: smoke_public_observation_provider.py
  - 회귀 전체 재통과, 계약 동결 diff 0
- **Phase 6 완료 (2026-08-02, evaluator PASS)**: Vercel 배포 + VWorld 도메인 확인
  - 배포 URL: **https://une-aidata-web.vercel.app** (프로젝트 une-aidata-web, GitHub main 자동 배포)
  - Hobby 12함수 제한 대응(사용자 승인): api/ 31라우트 → server/routes/** + api/index.ts catch-all 1함수 + vercel.json rewrite `/api/(.*)→/api`. 외부 HTTP 경로·OpenAPI 계약 불변, 검증은 3자 대조(핸들러↔라우팅테이블↔OpenAPI)로 강화
  - 배포 이슈 해결 여정: build:web workspace 스코프(별칭 추가) → outputDirectory(Root Directory 설정) → 12함수 제한(통합) → ESM ERR_MODULE_NOT_FOUND(.js 확장자 + seeds fs 로딩 + includeFiles data/**) → 대괄호 catch-all 다중 세그먼트 미매칭(index.ts + rewrite)
  - 검증: /·/evidence·/report 직접 URL·새로고침 200, /api/health·map/layers 200 envelope, 미등록 404 envelope, VWorld 타일 실로드 확인("연결 정상" 배지 — tileloadend 기반), 키 하드코딩 0건
- **Phase 5 완료 (2026-08-02, evaluator PASS)**: Playwright E2E 7/7 통과
  - @playwright/test 1.62.1 + chromium-1234 준비, playwright.config.ts webServer에 VITE_USE_SEED_DIRECTLY·VWorld 키 공백 주입
  - SatelliteComparison에 좌우/스와이프 비교 UI 신설(설계 정본 docs/04 SCR-EVD-001·docs/14 §14.5 — 기존 E2E 테스트 3이 요구하던 미구현 기능. radio 좌우비교/스와이프, range "비교 경계 위치", 25/50/75% 버튼)
  - PageHeading: 최초 로드 h1 자동초점 제거(라우트 변경 시에만) — E2E 테스트 2 키보드 접근 수정
  - tests/e2e/multi-page-navigation.spec.ts 신규(직접 URL·reload·뒤로/앞으로·/api 0건, 4테스트)
  - .gitignore에 test-results/·playwright-report/ 추가
  - 회귀 재통과: typecheck·contracts·validate·a11y 구조검증·smoke 3종·runtime-gate·conformance, 계약 동결 diff 0, 기존 spec 무변경(assert 완화 없음)
- **Phase 4 완료 (2026-08-02, evaluator PASS)**: /report 선택 근거·유사도·대응비교 연계
  - apps/web/src/domain/similarEventSeedFallback.ts 신규: server/domain/similarEvents.ts compareResponses의 seed 전용 최소 미러링 (유사도 점수 산정 미복제, Passage evidence 정규화)
  - apiClient loadSimilarEvents fallback: response_comparison·evidence(passage_id) 채움, profile_id='SEED-FALLBACK'·'Seed Fallback 참고 점수' 표기
  - ReportEditor: 유사도 요약(+"Seed 참고사례 · T3Q 실데이터 아님" 배지)·대응비교 표·Passage 근거 목록·초안 검증 패널(draft-validation, 경고 실시간 소멸)·저장 초안 reload 복원(버그픽스)
  - scripts/smoke_report_console.py 신규(8스텝, 포트 5185) + package.json test:report-console 등록
  - 회귀 재통과: typecheck·contracts·validate·유사사례 smoke 3종·콘솔 smoke 3종·runtime-gate·conformance·build, 계약 동결 diff 0
- **Phase 3 완료 (2026-08-02, evaluator PASS)**: /evidence PRE/EVENT/POST 및 근거 선택 흐름 완성
  - apiClient.ts: FORCE_SEED의 selectFloodPhaseAssets가 server/domain/satellitePhaseSelection.ts를 직접 import(단일 소스)해 seed 자산으로 실제 선정 수행 — offset_days_from_target·selection_reason 3건 화면 표시
  - scripts/smoke_evidence_console.py 신규(9스텝: 타일 6개 256×256, phase note, mock 배지, 근거 선택→/report 반영→reload 복원, console/api 에러 0) + package.json에 test:evidence-console 등록
  - scripts/smoke_report_context.py: Windows cp949 호환(encoding='utf-8')
  - 회귀 재통과: typecheck·contracts·validate·위성 smoke 4종·dashboard/evidence console smoke·runtime-gate·conformance·build, 계약·Seed 동결 영역 diff 0
- **Phase 2 완료 (2026-08-02, evaluator PASS)**: /dashboard Mock/Seed 진입~조회 흐름 완결
  - apiClient.ts: FORCE_SEED(`VITE_USE_SEED_DIRECTLY=true`)에서 비-fallback 5종(loadObservations·createSituation·sendAgentMessage·selectFloodPhaseAssets·searchT3qMock)이 /api 요청 없이 seed 기반 동작
  - SituationAgentPanel.tsx: apply/submit unhandled rejection 제거, inline-error(role=alert) 표시
  - MapPanel.tsx: 미존재 GeoJSON ID 비차단 안내(role=status, .map-highlight-notice), mapReady 가드
  - scripts/smoke_dashboard_console.py 신규: vite dev(FORCE_SEED, VWorld 키 무) 10스텝 시나리오 — console/page error 0, /api 요청 0 자동 단언
  - 회귀 재통과: typecheck·contracts(31 op/260 obj)·validate·runtime-gate·provider-conformance·build 전부 PASS, 계약·Seed 동결 영역 diff 0
- 환경 참고: Python 의존성은 `python -m pip install -r requirements.txt` + `python -m playwright install chromium`으로 설치, Git Bash에는 pyenv-win shim으로 python3 사용 가능. **주의: PowerShell에서 `npm run test:runtime-gate` 실행 시 WSL bash로 해석돼 실패할 수 있음 — Git Bash에서 실행할 것**

## In progress
- **AI Agent 상호작용 강화 완료 (2026-08-02)** — POC1(`ref/` 화면캡쳐 3종) 재현:
  - 지도 모든 POI 클릭 → 요약 팝업(위험요인·임계값표·저감대책·사업비·우선순위·근거 문서/페이지). L1 위험지구는 `loadPlanReference()`로 상세 전개
  - 선택 대상 → AI Agent 컨텍스트 칩(최대 5건) → 질의와 함께 전송. **주어 없는 질문("여긴 왜 위험해?")도 성립**. 서버 agent는 컨텍스트·키워드(하천/기준유량/위험지구/피해사례/절차/관측소) 규칙 해석 + evidence에 근거 문서·페이지 부착
  - 우측 `계획·근거` 탭 하드코딩 제거 → 실데이터(위험지구 요약·필터·카드 상세 / 하천 제원 + **지점별 계획홍수량·주의보/경보 기준유량 표**). 그동안 미노출이던 `rivers.json` 최초 활용
  - 유사사례 탭에 피해·대응·복구 정보 렌더(`SimilarEvent.damage` 등 계약에 있으나 미표시였음)
  - 영상지도에서 벡터 라인 고대비 색 + casing 2겹으로 분기
  - 계약·OpenAPI·Seed 무변경. 신규 API 라우트 없음(정적 참고자료는 public/seed 직접 로드)
- **Phase 8 진행 중** — 인증정보 불필요 구간 완료 (2026-08-02):
  - Shadow 하네스: tests/provider/provider_shadow_gate.cjs + scripts/run_provider_shadow_test.sh (`npm run test:provider-shadow -- --provider <id>`). 키 미설정 시 HELD·네트워크 0건, 설정 시 실호출 1회→actual 계약검증→fixture 구조 병행비교→redaction 자기검증
  - 승격 절차: docs/29_provider_shadow_and_promotion_procedure.md (핵심: env 키 설정=즉시 실경로 전환이므로 Shadow는 로컬 셸 env만, Vercel env 설정=SELECTABLE 승격 행위. provider별 2단계 승인)
  - 상태 기록: tests/provider/provider_promotion_status.json (6종 FIXTURE_VALIDATED, t3q 3종은 promotion_hold — 실 Endpoint 미확정)
  - 회귀 번들 기준선 8종 전부 통과 (typecheck·contracts·fixture/runtime gate·콘솔 smoke 3종·observation·E2E 7/7)
- **une_rag Shadow 완료 (2026-08-02)**: 실제 UNI RAG v1.1.0 대상 SHADOW_PASSED (로그인 JWT→/search/ 검색, Passage 5건 actual 정규화, fixture 구조 일치, 비밀정보 0건). 사용자 승인 1 완료 → **SHADOW_TESTED 기록**. 과정에서 uneRag.ts 실스키마 반영: 로그인 필드 설정화(UNE_RAG_LOGIN_ACCOUNT_FIELD=account), doc_id 후보키 추가, fixture 표본을 실응답 스키마({filename,score,text,doc_id})로 갱신
- **une_rag SELECTABLE 보류 (사용자 결정)**: 외부 시연 시 내부망 UNI RAG 접근 불가 → 당분간 Seed 기반 검색 유지, 외부 접근 가능해지면 승인 2 재검토. Vercel env에 UNE_RAG_* 설정 금지 상태 유지
- **대기: kma_nowcast** (공공데이터포털 18시까지 점검 — 키 발급 후 Shadow 가능), **hrfco_hydrology** (공식 관측소 코드 미확정)
- 환경 주의: PowerShell에서 npm run test:provider-shadow 실행 시 bash가 WSL로 잡혀 .runtime-cjs가 깨질 수 있음 — `node tests/provider/provider_shadow_gate.cjs --provider <id>` 직접 실행 권장 (.runtime-cjs 재컴파일: Git Bash에서 `tsc -p tsconfig.runtime.json` + `.runtime-cjs/package.json`({"type":"commonjs"}) 존재 확인)

## Pending — 데이터 수령 대기
- **부산·인제·영천 계획자료 구조화**: 사용자가 자연재해저감 종합계획·하천기본계획 **PDF를 추후 제공** 예정. 수령 후 `data/reference/districts.json`·`rivers.json`·`geo.json`과 동일 스키마로 전사하면 지도 POI 팝업·계획·근거 패널이 그대로 동작한다(코드 변경 불필요). 현재는 의왕 41430(17지구)·구미 47190(6지구)·남원 45190(6지구) + 하천 3개(안양천·구미천·요천)만 커버.
- 참고: 원시 xlsx(`메타데이터 참고자료(T3Q)/`)에는 전국 재해대장 115,563행·위험지구 약 6,300지구가 있으나 **위험요인 서술·임계값·근거 문서페이지·좌표가 없어** 팝업 수준의 정보를 만들 수 없다(그 정보는 저감계획 PDF 판독에서 나옴). 재해대장은 피해금액·복구비 보강용으로 조인 가능.

## Pending approval (Seed 불일치 영향범위 보고)
- `apps/web/public/seed/priority_areas_seed.json`의 `SIT-GM-POC-001`(47190 구미) rank 1이 `spatial_object_id: "GM-A-01"` 참조하나 `geo.json`에 해당 feature 없음(GM 계열은 GM-A-03/04/07, GM-B-10/13, GM-C-01만 존재). 현재 UI 가드로 비차단 안내 처리됨. 근본 수정은 seed 동결 해제 승인 필요 — 택1: (a) geo.json에 GM-A-01 feature 추가, (b) priority_areas_seed의 참조 ID를 기존 ID로 교체

## Next steps (Phase 8 잔여 — provider별 독립 진행)
1. **kma_nowcast (가장 간단, 권장 1순위)**: 공공데이터포털에서 기상청 초단기실황 활용신청 → 서비스키 확보 → 로컬 셸에서 `DATA_GO_KR_SERVICE_KEY=<키>` 설정 후 `npm run test:provider-shadow -- --provider kma_nowcast` → 결과 검토 후 승인1(SHADOW_TESTED) → Vercel Preview env 설정(승인2)·회귀 재통과 → SELECTABLE
2. **hrfco_hydrology**: HRFCO Endpoint·키 + **공식 관측소 코드 확정 필수** (v0.7 규칙 4 — official_station_code 없으면 하네스가 HELD 처리)
3. **une_rag**: UNE RAG URL·계정 준비 → Swagger probe 먼저 (`/api/v1/integrations/une-rag-probe`) → 실제 경로 확인 후 UNE_RAG_SEARCH_PATH 설정 (경로 추정 금지, v0.7 규칙 5)
4. t3q 3종은 실 Endpoint 미확정으로 promotion_hold — Phase 8 승인 대상 아님
5. 주의: 키는 로컬 셸 env로만 (Vercel env 설정은 SELECTABLE 승격 승인 후에만), 키를 채팅·코드·문서에 남기지 말 것, DEFAULT 전환 금지. 상세 절차: docs/29

## Blockers
- 없음. (@playwright/test 404는 재발하지 않음 — 1.62.1 설치 완료)

## How to run
- 의존성: `npm install` (Node >= 22.12.0) + `python -m pip install -r requirements.txt` + `python -m playwright install chromium`
- 검증: `npm run validate` → `npm run test:contracts` → `npm run typecheck:functions` → `npm run test:runtime-gate` → `npm run test:provider-conformance`
- 빌드: `npm run build` / 개발: `npm run dev:web`
- Windows: `python3` 대신 `python`, `.sh`는 Git Bash로 실행
