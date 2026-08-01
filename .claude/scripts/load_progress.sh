#!/usr/bin/env bash
# SessionStart hook: PROGRESS.md + git 상태를 additionalContext로 주입한다.
# 내용은 명령문이 아닌 사실 진술로 구성한다. 10,000자 제한 대비 9,000자로 절단.

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0

CONTEXT=""

if [ -f "PROGRESS.md" ]; then
  CONTEXT+="다음은 이 프로젝트의 인계 기록(PROGRESS.md) 내용이다:
$(cat PROGRESS.md)

"
else
  CONTEXT+="PROGRESS.md가 아직 없다. 첫 Phase 완료 시 생성된다.

"
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
COMMITS=$(git log --oneline -5 2>/dev/null || echo "(커밋 없음)")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

CONTEXT+="git 현재 브랜치: ${BRANCH}
최근 커밋 5개:
${COMMITS}
미커밋 변경 파일 수: ${DIRTY}"

# python3 → python 순으로 JSON 직렬화 시도, 둘 다 없으면 plain stdout 폴백
PY=""
if command -v python3 >/dev/null 2>&1; then
  PY="python3"
elif command -v python >/dev/null 2>&1; then
  PY="python"
fi

if [ -n "$PY" ]; then
  CONTEXT="$CONTEXT" PYTHONIOENCODING=utf-8 "$PY" "${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/load_progress.py"
else
  printf '%s' "$CONTEXT" | head -c 9000
fi
