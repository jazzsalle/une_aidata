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
   - `## 완료 요약` — **날짜별 한 줄씩만.** 상세 서술은 여기 쓰지 않는다
   - `## In progress` — 하다 만 것과 중단 지점
   - `## Pending` / `## Pending approval` — 대기 중인 것, 승인 필요한 것
   - `## Next steps` — 다음에 이어서 할 일 (구체적으로, 파일·명령 포함)
   - `## Blockers` — 막힌 것·기다리는 것 (없으면 "없음")
   - `## How to run` — 빌드·검증 명령 요약

   **완료 이력의 상세 서술은 `docs/PROGRESS_ARCHIVE.md` 맨 위에 덧붙인다.** PROGRESS.md 에 쌓지 않는다 —
   SessionStart 훅이 이 파일에서 재개용 절만 뽑아 주입하는데, 파일이 길어지면 정작 필요한
   `Next steps`·`Blockers` 가 잘려 나간다(2026-08-09 실제로 그래서 분리했다).
   **PROGRESS.md 가 8,000자를 넘으면 완료 서술을 아카이브로 옮긴다.**
3. `git add -A && git commit` 한다 (커밋 메시지: "handoff: <날짜> <요약>").
4. **push는 자동으로 하지 않는다** — "git push 후 이동하세요. 다음 PC에서: git pull → claude 시작"을 안내한다.
