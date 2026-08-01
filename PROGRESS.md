# PROGRESS.md — 회사↔집 인계 기록

## Last updated
2026-08-02

## Current goal
Phase 1 — 기준선 재현·빌드 정상화 (npm install → validate → contracts → typecheck → runtime/provider gate → build)

## Done
- 기준선 정리: vercel-source-v1.5.1을 리포 루트로 승격, gate bundle은 archive/ 보관
- GitHub 연결: https://github.com/jazzsalle/une_aidata (main + 태그 design-v1.8.1-source-v1.5.1 push 완료)
- 하네스 구성: planner/generator/evaluator subagent, /phase-run, /handoff, /resume-work, evaluation_criteria.md, SessionStart hook

## In progress
- 없음 (하네스 구성 직후 상태)

## Next steps
1. Claude Code 세션 재시작 (subagent·스킬 로드)
2. `/phase-run 1` 실행 — 기준선 재현·빌드 정상화 (합격 기준: evaluation_criteria.md Phase 1)
3. 주의: API·Schema·Seed 계약 변경 금지, 외부 Provider 연결·대규모 UI 개편 착수 금지

## Blockers
- 없음. (참고: 이전 환경에서 @playwright/test registry 404 이력 — Phase 1에서 재확인 필요)

## How to run
- 의존성: `npm install` (Node >= 22.12.0)
- 검증: `npm run validate` → `npm run test:contracts` → `npm run typecheck:functions` → `npm run test:runtime-gate` → `npm run test:provider-conformance`
- 빌드: `npm run build` / 개발: `npm run dev:web`
- Windows: `python3` 대신 `python`, `.sh`는 Git Bash로 실행
