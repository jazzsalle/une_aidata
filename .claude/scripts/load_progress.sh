#!/usr/bin/env bash
# SessionStart hook: PROGRESS.md + git 상태를 additionalContext로 주입한다.
# 내용은 명령문이 아닌 사실 진술로 구성한다. 10,000자 제한 대비 9,000자로 절단.

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0

# python3 → python → py 순으로 인터프리터를 찾는다. 섹션 선별과 JSON 직렬화가 모두 이걸 쓴다.
#
# **존재 확인(command -v)만으로는 안 된다.** Windows 에는 `python3` 자리에 Microsoft Store
# 설치 유도 스텁이 깔려 있는 경우가 많다(`~/AppData/Local/Microsoft/WindowsApps/python3`).
# 이 스텁은 PATH 에 실재하므로 command -v 를 통과하지만, 무엇을 시켜도 "Python" 한 줄만 찍고
# exit 49 로 죽는다. 그러면 이 훅 전체가 실패해 **재개 컨텍스트가 조용히 하나도 주입되지 않는다**
# (2026-08-14 회사 PC 에서 실제로 그 상태였다). 그래서 실제로 코드가 도는지까지 확인한다.
PY=""
for candidate in python3 python py; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "pass" >/dev/null 2>&1; then
    PY="$candidate"
    break
  fi
done

CONTEXT=""

if [ -f "PROGRESS.md" ]; then
  # PROGRESS.md 전문을 앞에서부터 자르면 파일이 길어질수록 'Done' 이력만 남고
  # In progress·Next steps·Blockers 가 통째로 잘려 나간다(실제로 그렇게 됐다).
  # 그래서 재개에 필요한 섹션을 골라 넣고, 완료 이력은 뒤로 돌린다.
  # PYTHONIOENCODING 필수: Windows 기본 stdout 이 cp949 라 '—' 하나에 전체가 죽는다.
  SELECTED=$(SRC="PROGRESS.md" PYTHONIOENCODING=utf-8 "${PY:-python}" - <<'PYEOF' 2>/dev/null || cat PROGRESS.md
import os,re,sys
src=os.environ.get('SRC','PROGRESS.md')
text=open(src,encoding='utf-8').read()
parts=re.split(r'\n(?=## )',text)

# 중요도 순. 짧고 결정적인 절(Blockers·How to run)을 앞에 둬야 예산에 밀리지 않는다.
# 뒤로 갈수록 길고 서술적이라 잘려도 손실이 작다.
#
# 'Pending'(데이터 수령 대기)이 'Pending approval' 보다 앞이다. 이 프로젝트는 진행이
# 자료 수령에 막혀 있어서, "무엇이 오면 무엇이 풀리는지"가 재개 판단에 직결된다.
# 맨 뒤에 두면 예산에 밀려 매번 잘려 나간다(2026-08-14 실제로 그랬다).
# 'Pending' 은 파일에 먼저 나오는 절부터 잡으므로 두 Pending 절이 각각 한 번씩 걸린다.
ORDER=['Last updated','Current goal','Blockers','Next steps','이어서 할 일',
       'Pending','Pending approval','How to run','In progress']
BUDGET=7600      # git 상태 블록과 JSON 직렬화 여유를 남긴다
PER_SECTION=1800 # 한 절이 예산을 독식하지 못하게 한다

def head(p): return p.split('\n',1)[0].lstrip('# ').strip()

used=set()
picked=[]
for want in ORDER:
    for i,p in enumerate(parts):
        if i in used or want.lower() not in head(p).lower():
            continue
        used.add(i)
        picked.append(p if len(p)<=PER_SECTION else p[:PER_SECTION]+'\n  …(이 절 이하 생략)')

out=''
for p in picked:
    if len(out)+len(p)+1>BUDGET:
        out+='\n…(남은 절 생략 — PROGRESS.md 직접 확인)'
        break
    out+=('\n' if out else '')+p

# 남는 예산이 있으면 완료 이력을 덧붙인다. 재개 정보는 이미 위에 확보돼 있다.
spare=BUDGET-len(out)
if spare>600:
    tail='\n'.join(p for i,p in enumerate(parts) if i not in used)
    if tail:
        out+='\n'+(tail if len(tail)<=spare else tail[:spare]+'\n…(완료 이력 이하 생략)')
sys.stdout.write(out)
PYEOF
)
  CONTEXT+="다음은 이 프로젝트의 인계 기록(PROGRESS.md)에서 재개에 필요한 절을 뽑은 것이다:
${SELECTED}

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

# JSON 직렬화. 인터프리터가 없으면 plain stdout 폴백.
if [ -n "$PY" ]; then
  CONTEXT="$CONTEXT" PYTHONIOENCODING=utf-8 "$PY" "${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/load_progress.py"
else
  printf '%s' "$CONTEXT" | head -c 9000
fi
