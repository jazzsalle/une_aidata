"""load_progress.sh 보조: 환경변수 CONTEXT를 SessionStart additionalContext JSON으로 직렬화."""
import json
import os

ctx = os.environ.get("CONTEXT", "")
if len(ctx) > 9000:
    ctx = ctx[:9000] + "\n...(절단됨)"

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": ctx,
    }
}, ensure_ascii=False))
