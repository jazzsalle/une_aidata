---
name: phase-run
description: /phase-run N 또는 "Phase N 실행" 요청 시 호출. planner→generator(병렬)→evaluator 사이클로 해당 Phase를 오케스트레이션한다.
allowed-tools: Read, Edit, Write, Bash(git *), Task
---

# Phase 오케스트레이션

사용자가 `/phase-run N`(또는 "Phase N 실행")을 요청하면 **메인 세션이 직접 오케스트레이션**한다.
Phase 정의는 `CLAUDE.md`의 "## Phase" 섹션, 합격 기준은 `evaluation_criteria.md`를 따른다.

## 절차

### a) 분해
`@planner` subagent(Task 도구)로 Phase N을 태스크 목록으로 분해한다.
planner에게 Phase 목표와 evaluation_criteria.md의 해당 기준을 전달한다.

### b) 병렬 디스패치
- `[PARALLEL]` 표시 태스크들은 각각 `@generator`를 **Task 도구로 동시에**(한 메시지에 여러 Task 호출) 띄워 병렬 처리한다.
- `[AFTER: …]` 태스크는 선행 태스크 완료를 확인한 뒤 순차 실행한다.
- 병렬화는 generator 내부가 아니라 **여기(phase-run)에서 Task를 여러 개 띄우는 방식**으로만 한다.
- 같은 파일을 수정하는 태스크는 병렬로 띄우지 않는다(충돌 방지 — 순차로 전환).

### c) 검증
모든 태스크 완료 후 `@evaluator`로 Phase N을 검증한다 (PASS/FAIL).

### d) FAIL 처리
거절 노트를 해당 `@generator`에 전달해 수정시킨다. **최대 3회 반복.**
3회 후에도 FAIL이면 멈추고 사용자에게 상황·원인·거절 노트를 보고한다.

### e) PASS 처리 ★
1. **`PROGRESS.md`를 반드시 갱신**한다 (핸드오프 장치와의 연결선):
   - `Last updated`: 오늘 날짜
   - `Done this session`: 이번 Phase에서 한 일 요약
   - `Next steps`: 다음 Phase 및 남은 작업
2. "Phase N 완료"를 선언하고 결과(변경 파일·검증 결과)를 요약한다.
3. 커밋 메시지를 제안한다. `git add -A && git commit`은 수행하되 **자동 push는 금지** — push는 사용자 또는 /handoff에서.

## 프로젝트 고정 제약 (모든 subagent 프롬프트에 포함할 것)
- OpenAPI·JSON Schema·Seed ID·Provider 계약 변경 금지. 필요 시 영향범위 보고 후 사용자 승인 대기.
- 실제 T3Q·공공 API 호출 금지. Mock/Seed/Fixture 기반 유지.
- 피해예측·공식 위험도·자동 조치결정 표현 금지.
- Windows 환경: `python3` → `python`, bash 스크립트는 Git Bash로 실행.
