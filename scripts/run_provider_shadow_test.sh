#!/usr/bin/env bash
# Provider Shadow Test 하네스 실행 — fixture 게이트와 동일하게 .runtime-cjs CJS 컴파일 후 node로 게이트를 실행한다.
# 지정 provider 1종만 실호출을 시도하며, env·선행조건 미충족 시 HELD(보류)로 기록하고 네트워크 호출 0건으로 종료한다(dry-run).
# 결과: tests/provider/provider_shadow_test_result.json (provider별 병합 기록)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# npm run 밖(직접 bash 실행)에서도 로컬 tsc를 쓰도록 node_modules/.bin을 PATH에 추가한다.
export PATH="$ROOT/node_modules/.bin:$PATH"
rm -rf .runtime-cjs
tsc -p tsconfig.runtime.json
printf '{"type":"commonjs"}\n' > .runtime-cjs/package.json
node tests/provider/provider_shadow_gate.cjs "$@"
