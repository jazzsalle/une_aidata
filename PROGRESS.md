# PROGRESS.md — 회사↔집 인계 기록

## Last updated
2026-08-02

## Current goal
Phase 2 — /dashboard Mock/Seed 사용자 흐름 완성 (합격 기준: evaluation_criteria.md Phase 2)

## Done
- 기준선 정리: vercel-source-v1.5.1을 리포 루트로 승격, gate bundle은 archive/ 보관
- GitHub 연결: https://github.com/jazzsalle/une_aidata (main + 태그 design-v1.8.1-source-v1.5.1 push 완료)
- 하네스 구성: planner/generator/evaluator subagent, /phase-run, /handoff, /resume-work, evaluation_criteria.md, SessionStart hook
- **Phase 1 완료 (2026-08-02, evaluator PASS)**: npm install 성공(package-lock.json 생성, playwright 1.62.1 정상 — 404 재발 없음), validate·contracts(OpenAPI 31/31, JSON Schema 260/18)·typecheck:functions·typecheck:web·runtime-gate·provider-conformance 전부 PASS, `npm run build` 성공(apps/web/dist 산출). 계약 파일 변경 0건.

## Done this session
- Phase 1 실행: planner→generator(T1 install ∥ T2 python 검증 → T3+T5 typecheck·build ∥ T4 runtime/provider gate)→evaluator PASS
- 호환 수정 3건: VWorldMapAdapter.ts(DEFAULT_CENTER fallback, TS noUncheckedIndexedAccess), apps/web/tsconfig.node.json(TS 6.0 allowImportingTsExtensions 제거), tsconfig.runtime.json(ignoreDeprecations "6.0"), scripts/browser_runtime_regression.py(chromium 경로 조건화 — Linux 하드코딩 제거)
- 환경 참고: Python 의존성은 `python -m pip install -r requirements.txt` + `python -m playwright install chromium`으로 설치(requirements.txt 추가됨), Git Bash에는 pyenv-win shim으로 python3 사용 가능

## In progress
- 없음 (Phase 1 완료 직후 상태)

## Next steps
1. `/phase-run 2` 실행 — /dashboard Mock/Seed 사용자 흐름 완성 (콘솔 에러 0, 위험등급·피해확률 표현 금지, v0.5 UI 규칙)
2. 주의: API·Schema·Seed 계약 변경 금지, 외부 Provider 연결·대규모 UI 개편 착수 금지

## Blockers
- 없음. (@playwright/test 404는 재발하지 않음 — 1.62.1 설치 완료)

## How to run
- 의존성: `npm install` (Node >= 22.12.0) + `python -m pip install -r requirements.txt` + `python -m playwright install chromium`
- 검증: `npm run validate` → `npm run test:contracts` → `npm run typecheck:functions` → `npm run test:runtime-gate` → `npm run test:provider-conformance`
- 빌드: `npm run build` / 개발: `npm run dev:web`
- Windows: `python3` 대신 `python`, `.sh`는 Git Bash로 실행
