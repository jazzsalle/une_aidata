---
name: handoff
description: 자리를 뜨기 전 인계 기록을 남긴다. PROGRESS.md를 갱신하고 커밋한다. (회사↔집 PC 전환용)
disable-model-invocation: true
---

# 핸드오프 (퇴근/이동 전 인계)

사용자가 `/handoff`를 실행하면:

1. 이번 세션에서 한 일을 파악한다 (`git log --oneline -10`, `git status --short`, 대화 맥락).
2. **`PROGRESS.md`를 다음 섹션 구조로 갱신**한다 (기존 내용을 최신 상태로 대체):
   - `## Last updated` — 오늘 날짜 + 작업 장소(선택)
   - `## Current goal` — 지금 진행 중인 Phase/목표
   - `## Done` — 완료된 것 (Phase 단위 + 이번 세션 작업)
   - `## In progress` — 하다 만 것과 중단 지점
   - `## Next steps` — 다음에 이어서 할 일 (구체적으로, 파일·명령 포함)
   - `## Blockers` — 막힌 것·기다리는 것 (없으면 "없음")
   - `## How to run` — 빌드·검증 명령 요약
3. `git add -A && git commit` 한다 (커밋 메시지: "handoff: <날짜> <요약>").
4. **push는 자동으로 하지 않는다** — "git push 후 이동하세요. 다음 PC에서: git pull → claude 시작"을 안내한다.
