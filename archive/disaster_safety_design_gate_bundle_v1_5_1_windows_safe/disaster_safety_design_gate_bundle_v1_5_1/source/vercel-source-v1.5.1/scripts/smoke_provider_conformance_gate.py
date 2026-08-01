#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "data/seed/provider_conformance_cases_seed.json"
OUT_DIR = ROOT / "tests/provider"
OUT_JSON = OUT_DIR / "provider_conformance_result.json"
OUT_MD = OUT_DIR / "PROVIDER_CONFORMANCE_RESULT.md"

VALID_FIXTURE = "VALID"


def evaluate_case(case: dict[str, Any]) -> tuple[str, str, list[str]]:
    fixtures = case["fixtures"]
    selections = case["provider_selection"]
    messages: list[str] = []

    # Hard contract failures first.
    if fixtures.get("spatial") == "INVALID_CRS":
        return "FAIL", "DRAFT", ["공간 Geometry/CRS가 허용 계약과 불일치"]
    if fixtures.get("event") == "MISSING_EVIDENCE":
        return "FAIL", "DRAFT", ["Event 결과에 Evidence/lineage 누락"]
    if fixtures.get("risk") == "MISSING_UNIT":
        return "FAIL", "DRAFT", ["위험 임계값에 단위 또는 산정근거 누락"]

    # External provider selected but no fixture/contract sample.
    external_missing = []
    for domain, provider in selections.items():
        if provider in {"t3q", "openapi"} and fixtures.get(domain) == "MISSING":
            external_missing.append(f"{domain}:{provider}")
    if external_missing:
        return "BLOCKED", "DRAFT", ["외부 Provider 대표응답/Fixture 미확보: " + ", ".join(external_missing)]

    # Stale observation is usable only with explicit warning and confidence downgrade.
    if fixtures.get("observation") == "STALE":
        return "CONDITIONAL_PASS", "FIXTURE_VALIDATED", [
            "관측 최신성 기준 초과",
            "STALE 배지·관측시각 표출 및 판단 신뢰도 하향 필요",
        ]

    external_selected = any(v in {"t3q", "openapi"} for v in selections.values())
    all_valid = all(v == VALID_FIXTURE for v in fixtures.values())
    if external_selected and all_valid:
        return "CONDITIONAL_PASS", "FIXTURE_VALIDATED", [
            "Fixture 계약 적합",
            "실 Endpoint shadow 시험·출처배지·Fallback 회귀시험 전에는 SELECTABLE 불가",
        ]

    if all(v == "mock" for v in selections.values()) and all_valid:
        return "PASS", "SELECTABLE", ["Mock/Seed 기본운영 계약 적합"]

    messages.append("정의되지 않은 조합")
    return "FAIL", "DRAFT", messages


def main() -> None:
    data = json.loads(SEED.read_text(encoding="utf-8"))
    results = []
    for case in data["cases"]:
        actual_status, lifecycle, messages = evaluate_case(case)
        expected_status = case["expected_status"]
        expected_lifecycle = case["expected_lifecycle"]
        matched = actual_status == expected_status and lifecycle == expected_lifecycle
        results.append(
            {
                "case_id": case["case_id"],
                "name": case["name"],
                "actual_status": actual_status,
                "expected_status": expected_status,
                "lifecycle": lifecycle,
                "expected_lifecycle": expected_lifecycle,
                "matched": matched,
                "messages": messages,
            }
        )

    counts = Counter(r["actual_status"] for r in results)
    payload = {
        "version": "1.5.1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total": len(results),
            "pass": counts["PASS"],
            "conditional_pass": counts["CONDITIONAL_PASS"],
            "blocked": counts["BLOCKED"],
            "fail": counts["FAIL"],
        },
        "results": results,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# Provider Conformance Gate Result — Source v1.5.1",
        "",
        "## Summary",
        "",
        f"- Total: {len(results)}",
        f"- PASS: {counts['PASS']}",
        f"- CONDITIONAL_PASS: {counts['CONDITIONAL_PASS']}",
        f"- BLOCKED: {counts['BLOCKED']}",
        f"- FAIL: {counts['FAIL']}",
        "",
        "## Cases",
        "",
        "| ID | Scenario | Actual | Lifecycle | Expected | Match |",
        "|---|---|---|---|---|---|",
    ]
    for r in results:
        lines.append(
            f"| {r['case_id']} | {r['name']} | {r['actual_status']} | {r['lifecycle']} | "
            f"{r['expected_status']} / {r['expected_lifecycle']} | {'PASS' if r['matched'] else 'FAIL'} |"
        )
    lines += [
        "",
        "## Interpretation",
        "",
        "- PASS는 현재 Mock/Seed 기본운영 계약이 공통 Domain Model과 상태표시 원칙에 맞음을 의미한다.",
        "- CONDITIONAL_PASS는 Fixture 수준 적합이며, 실제 Endpoint shadow 시험과 화면·보고서 회귀시험 전에는 기본 Provider로 승격할 수 없다.",
        "- BLOCKED는 Endpoint·인증·대표응답 또는 필수 Fixture가 없어 선택할 수 없는 상태다.",
        "- FAIL은 CRS, 단위, Evidence/lineage 등 필수 계약을 위반한 상태이며 화면에 실제 데이터로 표출하지 않는다.",
        "- 본 결과는 실제 T3Q RAG 성능이나 공공 API 정확도를 평가하지 않는다.",
    ]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    mismatches = [r for r in results if not r["matched"]]
    if mismatches:
        raise SystemExit("Provider conformance mismatch: " + ", ".join(r["case_id"] for r in mismatches))

    print(
        "provider-conformance PASS "
        f"total={len(results)} pass={counts['PASS']} conditional={counts['CONDITIONAL_PASS']} "
        f"blocked={counts['BLOCKED']} fail={counts['FAIL']}"
    )


if __name__ == "__main__":
    main()
