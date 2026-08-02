#!/usr/bin/env bash
# Provider Fixture 검증 게이트 실행 — runtime gate와 동일하게 .runtime-cjs CJS 컴파일 후 node로 게이트를 실행한다.
# 실제 네트워크 호출 없음(fixture 매퍼만 실행). 결과: tests/provider/provider_fixture_validation_result.json / PROVIDER_FIXTURE_VALIDATION.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
rm -rf .runtime-cjs
tsc -p tsconfig.runtime.json
printf '{"type":"commonjs"}\n' > .runtime-cjs/package.json
node tests/provider/provider_fixture_gate.cjs
