# PROGRESS.md — 회사↔집 인계 기록

## Last updated
2026-08-02

## Current goal
Phase 5 — Playwright E2E (합격 기준: evaluation_criteria.md Phase 5)

## Done
- 기준선 정리: vercel-source-v1.5.1을 리포 루트로 승격, gate bundle은 archive/ 보관
- GitHub 연결: https://github.com/jazzsalle/une_aidata (main + 태그 design-v1.8.1-source-v1.5.1 push 완료)
- 하네스 구성: planner/generator/evaluator subagent, /phase-run, /handoff, /resume-work, evaluation_criteria.md, SessionStart hook
- **Phase 1 완료 (2026-08-02, evaluator PASS)**: npm install 성공(package-lock.json 생성, playwright 1.62.1 정상 — 404 재발 없음), validate·contracts(OpenAPI 31/31, JSON Schema 260/18)·typecheck:functions·typecheck:web·runtime-gate·provider-conformance 전부 PASS, `npm run build` 성공(apps/web/dist 산출). 계약 파일 변경 0건.

## Done this session
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
- 없음 (Phase 2 완료 직후 상태)

## Pending approval (Seed 불일치 영향범위 보고)
- `apps/web/public/seed/priority_areas_seed.json`의 `SIT-GM-POC-001`(47190 구미) rank 1이 `spatial_object_id: "GM-A-01"` 참조하나 `geo.json`에 해당 feature 없음(GM 계열은 GM-A-03/04/07, GM-B-10/13, GM-C-01만 존재). 현재 UI 가드로 비차단 안내 처리됨. 근본 수정은 seed 동결 해제 승인 필요 — 택1: (a) geo.json에 GM-A-01 feature 추가, (b) priority_areas_seed의 참조 ID를 기존 ID로 교체

## Next steps
1. `/phase-run 5` 실행 — Playwright E2E (@playwright/test 1.62.1 설치됨, tests/e2e/accessibility-navigation.spec.ts PASS + 3페이지 직접 URL·새로고침·뒤로가기 시나리오. 콘솔 smoke 3종이 이미 유사 커버리지 확보 — E2E 스펙과의 관계는 planner 조사)
2. 주의: API·Schema·Seed 계약 변경 금지, 외부 Provider 연결·대규모 UI 개편 착수 금지

## Blockers
- 없음. (@playwright/test 404는 재발하지 않음 — 1.62.1 설치 완료)

## How to run
- 의존성: `npm install` (Node >= 22.12.0) + `python -m pip install -r requirements.txt` + `python -m playwright install chromium`
- 검증: `npm run validate` → `npm run test:contracts` → `npm run typecheck:functions` → `npm run test:runtime-gate` → `npm run test:provider-conformance`
- 빌드: `npm run build` / 개발: `npm run dev:web`
- Windows: `python3` 대신 `python`, `.sh`는 Git Bash로 실행
