---
name: resume-work
description: 사용자가 "이어서", "계속", "resume", "어디까지 했지" 등 이전 작업을 이어가려 할 때 호출. PROGRESS.md와 git 상태를 확인하고 기록된 Next steps부터 재개한다.
---

# 작업 재개 (SessionStart hook이 비었을 때의 수동 폴백)

## 현재 인계 기록

!`cat PROGRESS.md 2>/dev/null || echo "PROGRESS.md가 아직 없습니다."`

## git 상태

!`git branch --show-current && git log --oneline -5 && git status --short | head -20`

## 진행 방법

1. 위 PROGRESS.md의 **Next steps**를 확인하고, 거기 기록된 다음 작업부터 이어간다.
2. In progress 항목이 있으면 중단 지점을 파악한 뒤 이어서 완료한다.
3. 미커밋 변경이 있으면 내용을 확인하고 사용자에게 상태를 요약 보고한 뒤 진행한다.
4. Phase 단위 작업은 `/phase-run N`으로 실행한다 (Phase 정의: CLAUDE.md "## Phase").
