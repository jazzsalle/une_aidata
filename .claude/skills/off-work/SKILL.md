---
name: off-work
description: 퇴근 모드 — 하던 개발을 커밋·PR·머지·배포 확인까지 마무리하고, 인계 기록(/handoff)과 정리를 거쳐 하루를 닫는다. 사용자가 "퇴근", "퇴근 모드", "집에 간다", "오늘 마무리하자" 등을 말할 때 호출.
---

# 퇴근 모드 (하루 마감 절차)

`/off-work` 실행 시 아래 순서로 진행한다. 각 단계는 **결과를 짧게 보고**하며 진행하고,
판단이 필요한 곳(머지할지 보류할지 등)만 사용자에게 묻는다.

## 1. 작업 마무리 — 커밋·PR·머지

1. `git status --short` + `git branch --show-current` 로 미커밋 변경·작업 브랜치를 파악한다.
2. **완성된 변경**: 해당 게이트를 돌리고(아래 참고) 브랜치 → 커밋 → PR → 머지.
   main 직접 푸시 금지(머지가 곧 프로덕션 배포다). 커밋 메시지는 `git commit -F <파일>`.
3. **하다 만 변경**: 임의로 머지하지 않는다. WIP 브랜치에 커밋·푸시해 두고
   PROGRESS.md `In progress` 에 중단 지점을 적을지, 버릴지 사용자에게 묻는다.
4. 게이트(변경 범위에 맞게): `tsc -p tsconfig.functions.json --noEmit` ·
   `apps/web` `tsc -b` · `python scripts/validate_vercel_repo.py` ·
   `python scripts/smoke_priority_logic.py` · 관련 smoke · `npx playwright test`(e2e) ·
   서버 로직을 바꿨으면 `tsc -p tsconfig.runtime.json` 재컴파일 + `node tests/runtime/runtime_regression_gate.cjs`.

## 2. 배포 확인 (오늘 머지가 있었으면)

1. 머지 커밋 sha 앞 8자가 번들 토큰(`?v=<sha8>`)으로 서빙될 때까지 백그라운드로 기다린다:
   `until curl -s .../assets/<index-*.js> | grep -q "v=<sha8>"; do sleep 15; done`
2. 프로덕션(https://une-aidata-web.vercel.app)을 Playwright 로 핵심 화면 1~2개 확인.
   **판정은 상태칩·실제 렌더 기준** — 요청 수 0건만 보고 실패로 단정하지 않는다(docs/16 §2.2).

## 3. 정리

1. 이 세션이 띄운 백그라운드 프로세스(vite dev·preview·API 셔밍 등)를 멈춘다.
   TaskStop 은 npx 래퍼만 죽일 수 있으므로 **좀비 리스너를 포트로 재확인**한다:
   `netstat -ano | grep -E ":(4173|4174|5080|5175) " | grep LISTENING` → 남으면 `taskkill //PID <pid> //F`.
2. 리포 안에 임시 산출물(dist-seed 등)을 만들었으면 지운다. 스크래치 디렉터리는 그대로 둔다.

## 4. 인계 기록 — /handoff 규칙대로

1. `/handoff` 스킬의 PROGRESS.md 갱신 규칙을 그대로 따른다
   (Last updated / Current goal / 완료 요약 — 날짜별 한 줄 / In progress / Pending·Pending approval /
   Next steps / Blockers / How to run. 상세 서술은 `docs/PROGRESS_ARCHIVE.md` 맨 위로, 8,000자 규칙).
2. 인계 커밋도 **브랜치 + PR + 머지**로 남긴다 (`chore/handoff-YYYYMMDD`,
   메시지 "handoff: <날짜> <요약>"). 문서만의 변경이라도 main 직접 푸시는 하지 않는다.

## 5. 메모리 점검

오늘 새로 확정된 **오래갈 사실**(사용자 지시 원칙·환경 제약·오진 교훈)이 메모리에 없으면 저장한다.
리포에 이미 기록된 것(코드 구조·PR 내용)은 저장하지 않는다.

## 6. 마감 보고

한눈에 읽히게 짧게:
- 오늘 머지된 PR 목록(번호·한 줄) · 프로덕션 상태(번들 토큰·검증 결과)
- 대기/보류 중인 것 (사용자 결정 대기 항목 포함)
- 내일 첫 할 일 1~3개
- 다음 PC 안내: "git pull → claude 시작(SessionStart 훅이 PROGRESS.md 를 주입) 또는 /resume-work"

## 주의

- 회사 PC 전용 작업(침수흔적도 API `npm run data:flood-traces`, GIS_data 필요 스크립트)이
  Next steps 에 있으면 **장소 표시**를 붙인다 — 집 PC 에서 헛걸음하지 않게.
- 키·인증정보는 어떤 기록에도 쓰지 않는다.
