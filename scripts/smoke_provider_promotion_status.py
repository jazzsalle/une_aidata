#!/usr/bin/env python3
"""Provider 승격 원장(`tests/provider/provider_promotion_status.json`) 검사.

Phase 8 은 이 원장에 승격 기록을 쌓아가는데, 지금까지 **이 파일을 읽는 코드가 리포에
하나도 없었다.** 단계 역행·`approvals` 누락·`promotion_hold` 위반을 아무도 검사하지 않았다.

기존 게이트의 판정 규칙을 다시 구현하지 않는다. 결과 파일을 교차참조만 한다.

검사 항목
  1. lifecycle 이 사다리의 유효값인가
  2. DEFAULT 로 올라간 Provider 가 없는가            (CLAUDE.md Phase 규칙 — DEFAULT 전환 금지)
  3. SHADOW_TESTED 이상이면 approvals 기록이 있고,
     `provider_shadow_test_result.json` 에 SHADOW_PASSED 근거가 있는가
  4. FIXTURE_VALIDATED 이상이면 `provider_fixture_validation_result.json` 에 근거가 있는가
  5. promotion_hold 면 hold_reason 이 있는가
  6. `provider_contracts_seed.json` 의 current 가 전부 mock 인가  (실 Provider 미전환)
  7. `server/routes/v1/integrations/status.ts` 의 PROVIDER_LIFECYCLE 이 원장과 일치하는가
  8. 원장에 비밀값처럼 보이는 문자열이 없는가
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / 'tests/provider/provider_promotion_status.json'
SHADOW = ROOT / 'tests/provider/provider_shadow_test_result.json'
FIXTURE = ROOT / 'tests/provider/provider_fixture_validation_result.json'
CONTRACTS = ROOT / 'data/seed/provider_contracts_seed.json'
STATUS_TS = ROOT / 'server/routes/v1/integrations/status.ts'

LADDER = ['DRAFT', 'FIXTURE_VALIDATED', 'SHADOW_TESTED', 'SELECTABLE', 'DEFAULT']
# Phase 8 은 승인 기반 단계 승격만 허용한다. DEFAULT 는 범위 밖이다.
FORBIDDEN = {'DEFAULT'}
# 값이 실수로 들어오면 안 되는 이름들. 원장은 비밀값을 담지 않는다.
SECRET_HINT = re.compile(r'(service[_-]?key|api[_-]?key|password|authorization|bearer\s)\s*[=:]\s*\S', re.I)

failures: list[str] = []
notes: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)


def load(path: Path):
    if not path.exists():
        failures.append(f'{path.relative_to(ROOT)} 이 없다')
        return None
    return json.loads(path.read_text(encoding='utf-8'))


def stage_index(value: str) -> int:
    return LADDER.index(value) if value in LADDER else -1


def main() -> int:
    ledger = load(LEDGER)
    if ledger is None:
        print('\n'.join(failures))
        return 1

    providers = ledger.get('providers') or []
    check(bool(providers), '원장에 providers 가 비어 있다')

    shadow = load(SHADOW) or {}
    fixture = load(FIXTURE) or {}
    shadow_text = json.dumps(shadow, ensure_ascii=False)
    fixture_text = json.dumps(fixture, ensure_ascii=False)

    for row in providers:
        pid = row.get('provider_id', '(id 없음)')
        stage = row.get('lifecycle', '')
        index = stage_index(stage)

        check(index >= 0, f'{pid}: lifecycle "{stage}" 가 사다리에 없다 ({" -> ".join(LADDER)})')
        check(stage not in FORBIDDEN,
              f'{pid}: lifecycle 이 {stage} 다 — Phase 8 에서 DEFAULT 전환은 금지다')

        if index >= stage_index('FIXTURE_VALIDATED'):
            check(pid in fixture_text,
                  f'{pid}: {stage} 인데 provider_fixture_validation_result.json 에 근거가 없다')

        if index >= stage_index('SHADOW_TESTED'):
            approvals = row.get('approvals') or []
            check(bool(approvals),
                  f'{pid}: {stage} 인데 approvals 가 비어 있다 — 승격은 승인 기록이 있어야 한다')
            check(any(a.get('step') == 'SHADOW_TESTED' for a in approvals),
                  f'{pid}: SHADOW_TESTED 승인 항목이 approvals 에 없다')
            check(pid in shadow_text and 'SHADOW_PASSED' in shadow_text,
                  f'{pid}: {stage} 인데 provider_shadow_test_result.json 에 SHADOW_PASSED 근거가 없다')
            for approval in approvals:
                for field in ('approved_by', 'approved_at', 'evidence'):
                    check(bool(approval.get(field)),
                          f'{pid}: approvals[{approval.get("step")}] 에 {field} 가 없다')

        if row.get('promotion_hold'):
            check(bool(row.get('hold_reason')),
                  f'{pid}: promotion_hold 인데 hold_reason 이 비어 있다')
            notes.append(f'{pid}: {stage} (보류)')
        else:
            notes.append(f'{pid}: {stage}')

    # 실 Provider 로 전환된 것이 없어야 한다.
    contracts = load(CONTRACTS)
    if contracts is not None:
        rows = contracts.get('providers') or contracts.get('contracts') or []
        current = [(c.get('capability') or c.get('provider_id') or c.get('id'), c.get('current'))
                   for c in rows if isinstance(c, dict) and 'current' in c]
        check(bool(current), 'provider_contracts_seed.json 에서 current 필드를 찾지 못했다')
        for name, value in current:
            check(value == 'mock', f'provider_contracts_seed: {name} 의 current 가 "{value}" 다 (mock 이어야 한다)')

    # 화면 표기가 원장과 어긋나면 사용자가 잘못된 단계를 본다.
    if STATUS_TS.exists():
        source = STATUS_TS.read_text(encoding='utf-8')
        block = re.search(r'PROVIDER_LIFECYCLE\s*:\s*Record<string,\s*string>\s*=\s*\{(.*?)\}', source, re.S)
        check(block is not None, 'status.ts 에서 PROVIDER_LIFECYCLE 을 찾지 못했다')
        if block:
            declared = dict(re.findall(r"(\w+)\s*:\s*'([A-Z_]+)'", block.group(1)))
            ledger_stage = {r.get('provider_id'): r.get('lifecycle') for r in providers}
            for pid, stage in declared.items():
                check(pid in ledger_stage, f'status.ts PROVIDER_LIFECYCLE 의 {pid} 가 원장에 없다')
                if pid in ledger_stage:
                    check(stage == ledger_stage[pid],
                          f'status.ts 의 {pid}={stage} 가 원장의 {ledger_stage[pid]} 와 다르다')

    check(not SECRET_HINT.search(LEDGER.read_text(encoding='utf-8')),
          '원장에 비밀값으로 보이는 문자열이 있다')

    print('provider promotion ledger')
    for note in notes:
        print(f'  {note}')
    if failures:
        print(f'FAIL provider promotion status: {len(failures)}건')
        for item in failures:
            print(f'  - {item}')
        return 1
    print(f'PASS provider promotion status: {len(providers)} providers · DEFAULT 0 · 승인 근거 교차확인')
    return 0


if __name__ == '__main__':
    sys.exit(main())
