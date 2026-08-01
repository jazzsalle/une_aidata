#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
rm -rf .runtime-cjs
tsc -p tsconfig.runtime.json
printf '{"type":"commonjs"}\n' > .runtime-cjs/package.json
node tests/runtime/runtime_regression_gate.cjs
python3 scripts/browser_runtime_regression.py
