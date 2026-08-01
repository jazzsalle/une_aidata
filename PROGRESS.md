# PROGRESS.md — 회사↔집 인계 기록

## Last updated
2026-08-02

## Current goal
Phase 3 — /evidence PRE/EVENT/POST 및 근거 선택 흐름 완성 (합격 기준: evaluation_criteria.md Phase 3)

## Done
- 기준선 정리: vercel-source-v1.5.1을 리포 루트로 승격, gate bundle은 archive/ 보관
- GitHub 연결: https://github.com/jazzsalle/une_aidata (main + 태그 design-v1.8.1-source-v1.5.1 push 완료)
- 하네스 구성: planner/generator/evaluator subagent, /phase-run, /handoff, /resume-work, evaluation_criteria.md, SessionStart hook
- **Phase 1 완료 (2026-08-02, evaluator PASS)**: npm install 성공(package-lock.json 생성, playwright 1.62.1 정상 — 404 재발 없음), validate·contracts(OpenAPI 31/31, JSON Schema 260/18)·typecheck:functions·typecheck:web·runtime-gate·provider-conformance 전부 PASS, `npm run build` 성공(apps/web/dist 산출). 계약 파일 변경 0건.

## Done this session
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
1. `/phase-run 3` 실행 — /evidence PRE/EVENT/POST phase 선택 규칙(offset_days_from_target·selection_reason 표시), 256×256 독립 타일, 근거 선택 상태 /report 전달, mock/seed 표시 유지
2. 주의: API·Schema·Seed 계약 변경 금지, 외부 Provider 연결·대규모 UI 개편 착수 금지

## Blockers
- 없음. (@playwright/test 404는 재발하지 않음 — 1.62.1 설치 완료)

## How to run
- 의존성: `npm install` (Node >= 22.12.0) + `python -m pip install -r requirements.txt` + `python -m playwright install chromium`
- 검증: `npm run validate` → `npm run test:contracts` → `npm run typecheck:functions` → `npm run test:runtime-gate` → `npm run test:provider-conformance`
- 빌드: `npm run build` / 개발: `npm run dev:web`
- Windows: `python3` 대신 `python`, `.sh`는 Git Bash로 실행
