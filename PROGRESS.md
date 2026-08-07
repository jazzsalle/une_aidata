# PROGRESS.md — 회사↔집 인계 기록

## Last updated
2026-08-08 집 PC — 인계문서의 "승인 불필요" 잔여작업(버그 4건 + 검증 게이트 3건) 완료. 신규 게이트: 승격 원장 검사·베이스맵 aria-pressed·seed 이중사본 SHA-256 동기화.
앞서 같은 날: 국가기본도 하천 3종 반입 + 기존 seed(geo.json L2) 제거(PR #6), GM-A-01→GM-A-04 seed 교체(PR #5).

## Current goal
Phase 8 — 실제 Provider Shadow Test 및 단계별 승격 (합격 기준: evaluation_criteria.md Phase 8, 승격마다 사용자 승인 필요)

## Done
- 기준선 정리: vercel-source-v1.5.1을 리포 루트로 승격, gate bundle은 archive/ 보관
- GitHub 연결: https://github.com/jazzsalle/une_aidata (main + 태그 design-v1.8.1-source-v1.5.1 push 완료)
- 하네스 구성: planner/generator/evaluator subagent, /phase-run, /handoff, /resume-work, evaluation_criteria.md, SessionStart hook
- **Phase 1 완료 (2026-08-02, evaluator PASS)**: npm install 성공(package-lock.json 생성, playwright 1.62.1 정상 — 404 재발 없음), validate·contracts(OpenAPI 31/31, JSON Schema 260/18)·typecheck:functions·typecheck:web·runtime-gate·provider-conformance 전부 PASS, `npm run build` 성공(apps/web/dist 산출). 계약 파일 변경 0건.

## Done this session
- **버그 4건 + 검증 게이트 3건 (2026-08-08)** — 인계문서에 "승인 불필요·바로 착수 가능"으로 적혀 있던 항목을 전부 구현했다. 계약 변경 0건.
  - **cp949 크래시 2건**: `smoke_mock_spatial_layers.py`(1곳)·`smoke_t3q_mock_contract.py`(3곳)의 `read_text()` 에 `encoding='utf-8'` 지정. Windows 에서 실행 자체가 안 되던 것이 이제 돈다 — `OK mock GIS 3 layers`, `OK v1.3 Event/Passage/Relation contract`.
  - **`.env.example` 누락 1건**: `UNE_RAG_LOGIN_ACCOUNT_FIELD=account` 추가(`uneRag.ts:24` 가 읽는데 선언이 없었다). 실제 UNI RAG v1.1.0 이 `account` 를 요구한다는 근거를 주석으로 붙였다.
  - **`status.ts` 표기 오류 1건**: `FIXTURE_VALIDATED_NOTE` 를 4개 Provider 전부에 무조건 append 하던 것을 **provider 별 lifecycle 문구로 분기**했다(`PROVIDER_LIFECYCLE` 맵 + `lifecycleNote()`). 원장상 `SHADOW_TESTED` 인 une_rag 가 화면에서는 FIXTURE_VALIDATED 로 나오던 문제가 해소됐다. **`validation_state` enum 은 건드리지 않았다 — 계약 무변경.**
  - **게이트 신설 ①  `scripts/smoke_provider_promotion_status.py`** (`npm run test:promotion-status`): 승격 원장을 읽는 코드가 리포에 하나도 없던 것을 메웠다. 사다리 유효값 · **DEFAULT 금지** · SHADOW_TESTED 이상이면 approvals + `provider_shadow_test_result.json` 의 SHADOW_PASSED 근거 · FIXTURE_VALIDATED 이상이면 fixture 결과 근거 · `promotion_hold` 면 `hold_reason` 필수 · `provider_contracts_seed.json` 의 `current` 전부 mock · **`status.ts` 의 `PROVIDER_LIFECYCLE` 이 원장과 일치** · 비밀값 미포함. 기존 게이트 판정을 재구현하지 않고 결과 파일 교차참조만 한다.
    - **역검증 완료**: DEFAULT 전환 / approvals 누락 / hold_reason 누락 / status.ts 표기 불일치 **4가지를 주입해 전부 FAIL 로 잡히는 것**과 복원 후 PASS 를 확인했다.
  - **게이트 신설 ②  베이스맵 `aria-pressed`**: `smoke_dashboard_console.py` 에 **S13** 추가(false→true→false 전이 + 레이어 칩 `aria-pressed`). 인계문서 D-4-2 585행 계약인데 어느 게이트도 보지 않았고, 실제로 구현 중 한 번 사라졌다가 사후 검토로 되살아난 항목이다. S1~S12 는 불변.
    - 이 스텝이 **실제로 차이를 잡았다** — 후속 Provider 자리표시자 칩(관측소·피해위치·대피소)은 `disabled` 라 `aria-pressed` 가 없다. 그게 맞는 마크업이므로 단언을 "켤 수 있는 칩만" 으로 좁히고, 반대로 자리표시자에 `aria-pressed` 가 붙으면 실패하도록 했다.
  - **게이트 신설 ③  이중 사본 동기화**: `validate_vercel_repo.py` 에 `data/seed`↔`public/seed`, `data/reference`↔`public/seed` 공통 파일명 **SHA-256 비교** 추가(geo.json 이 2MB 라 해시로). 한쪽만 고쳐 실서버 경로와 seed 폴백 화면이 갈라지던 사고를 막는다(Phase 4 report_draft_seed 형식 불일치 전례). 역검증: 한쪽 파일 1바이트 변경 시 FAIL 감지 → 복원 후 PASS.
  - 검증: typecheck·build·validate(6,989 entries)·contracts(OpenAPI 30/30/30 · JSON Schema 265/18)·runtime gate·fixture 18/18·conformance·promotion-status·a11y·seed·priority·integration-adapters·t3q 2종·콘솔 스모크 3종(**13/13**·9/9·8/8, console·pageerror·`/api`·외부도메인 전부 0)·E2E 7/7 전부 PASS.

- **GM-A-01 seed 불일치 해소 (2026-08-07, 사용자 승인 — seed 동결 해제 1건)**: 구미(47190) rank 1 `구미천 하천재해 대표지구`가 `geo.json`에 없는 `GM-A-01`을 참조해 카드 클릭 시 지도 이동 대신 비차단 안내만 뜨던 문제.
  - **택(b) 참조 ID 교체**: `GM-A-01` → **`GM-A-04`(구미천지구)**. `districts.json`에 관리대장 A.4 근거(하천재해·침수위험지구, 구미천, 원평동 964-640, No.29+00~34+83)가 있고 `geo.json`에 point가 실재해 **좌표를 만들어내지 않는다**. 택(a)(geo.json에 GM-A-01 신설)는 계획자료에 없는 좌표를 임의 생성해야 해 채택하지 않았다.
  - 변경 파일은 `data/seed/priority_areas_seed.json`과 동일 사본 `apps/web/public/seed/priority_areas_seed.json` **1줄씩**. seed의 `name`·`score`·`components`·`reasons`는 그대로 뒀다(카드 표기는 POC 서술, 지도 팝업은 GM-A-04 관리대장 표기).
  - **가드 커버리지 재확보**: `smoke_dashboard_console.py` S8이 "GM-A-01 미존재 안내"를 단언하고 있었는데, seed가 고쳐지면 그 경로가 사라진다. 깨진 seed를 남겨 커버리지를 유지하는 대신 **S8을 존재 ID 정상 하이라이트로 바꾸고, S9를 신설해 `page.route`로 seed 응답만 가로채 rank1을 `GM-A-99`로 바꿔 비차단 안내를 검증**한다(파일 무변경, 스텝 종료 시 `unroute`). 이후 스텝은 S10~S12로 번호만 이동.
  - 검증: 대시보드 스모크 **12/12**(console·pageerror·`/api`·외부도메인 전부 0), evidence 9/9·report 8/8, E2E 7/7, typecheck, build, validate·seed·priority·contracts(OpenAPI 30/30/30 · JSON Schema 265/18)·runtime gate·conformance·fixture gate 18/18·a11y 전부 PASS.
  - **주의 — 2026-08-03 "보류 확정"을 뒤집은 결정이다.** `feat/river-layer-multi-source` 브랜치 기록에 08-03 사용자 결정으로 "현행 비차단 가드 유지(보류)"가 남아 있다. 보류 사유였던 "두 안 모두 스모크 S8을 깨뜨린다"는 위 S8/S9 재구성으로 해소했다. 그 브랜치와 머지할 때 이 절과 아래 "Pending approval" 절이 충돌한다 — **이 항목(08-07 승인)이 최신이다.**

- **보고서 수치 나열 → 지표 표 렌더 + 관측값 중복 제거 (2026-08-03)**: 사용자 지적 — 초안 미리보기 `2. 현재 조건`처럼 수치가 여러 줄 나열되면 문단이 아니라 표로 나와야 한다.
  - **표 블록 신설**: `reportDocument.ts`에 `{kind:'table'}` 추가. `toMarkdown`은 GFM 파이프 표로 직렬화(셀 안 `|`는 이스케이프), 미리보기는 `<table class="report-doc-table">`로 렌더하며 첫 열은 `th scope="row"`.
  - **파싱은 강제하지 않는다**: `measurementBlocks()`가 `지표: 값 (자료상태)` 꼴 줄만 표로 모으고, 그 꼴이 아닌 줄은 표 아래 문단으로 남긴다. 표에 넣을 줄이 2개 미만이면 예전처럼 문단 하나. 담당자가 자유롭게 고쳐 쓰는 칸이라 산문을 쓰면 산문 그대로 나온다. 실측 확인: 산문 입력 시 표 0개, 혼합 입력 시 표 1개 + 후행 문단 보존.
  - 적용 대상은 `2. 현재 조건`과 `6. 피해현황`. `자료상태` 열은 괄호 표기가 하나라도 있을 때만 만든다.
  - **Seed 폴백 형식 정렬**: `report_draft_seed.json`의 `current_conditions`는 산문("호우경보 시나리오")이라 표가 되지 않아 실서버 경로와 화면이 달랐다. `apiClient.loadReport` 폴백이 `server/routes/v1/reports/drafts.ts`(29행)와 같은 `지표: 값 (자료상태)` 줄을 만들도록 맞췄다. **Seed 파일은 수정하지 않았다.**
  - **관측값 중복 제거(별건 버그)**: `App.tsx` `mergeObservations`가 `actual`인 지표만 걸러내어, 키 미설정·연계 실패로 폴백만 오면 걸러낼 대상이 없어 두 배열이 그대로 이어붙었다(같은 지표 2회 나열). 기준선 커밋 `5ec0f10`부터 있던 코드다. `type`을 키로 하나만 남기고 우선순위를 **actual > 담당자 적용값 > 그 밖의 조회값**으로 정리했다. 실측: `적용 중인 조건` 중복 0건.
  - 검증: typecheck·build, a11y 구조검증, 스모크 3종(11/11·9/9·8/8) 외부 도메인 0건, E2E 7/7. 마크다운 다운로드 파일에서 GFM 표 구분행 확인.

- **UNE 디자인 시스템 토큰 도입 + 레거시 CSS 일괄 정리 (2026-08-03)**: 1·2차 반영이 닿지 않은 구역(`/evidence` 위성 3구역, 대시보드 하단 4패널)이 예전 스타일로 남아 화면에 두 가지 톤이 섞여 있었다. 값을 손으로 옮기던 방식을 접고 DS 토큰을 직접 참조하도록 바꿨다.
  - **토큰 도입**: `apps/web/src/design-tokens/` 신설. 원본 `UNE Design System/_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/tokens/` 에서 **6개만** 복사한다 — `fig-tokens`·`colors`·`typography`·`spacing`·`elevation`·`motion`. `styles.css` 맨 위에서 `@import`(CSS @import 는 다른 규칙보다 앞서야 한다).
  - **제외 2개 — 갱신 시에도 반드시 지킬 것**:
    - `fonts.css` — jsdelivr CDN 을 `@import` 한다. 스모크 3종이 **외부 도메인 요청 0건**을 PASS 조건으로 걸고 있어 넣으면 게이트가 전부 깨진다. 앱은 이미 Spoqa 를 `public/fonts/` 에 self-host 한다.
    - `base.css` — `body`·`a`·`*` 전역 셀렉터를 덮어써 `styles.css` 와 충돌한다.
    - 복사본 최상단 주석에 이 규칙을 적어뒀다. 유입 검사: `grep -n "@import\|url(" apps/web/src/design-tokens/*.css` 가 0건이어야 한다.
  - **앱 토큰 재배선**: `--surface-*-blue`·`--border-*-blue`·`--accent-line-blue`·`--c-text-error`·`--c-text-success`·`--c-surface-success`·`--c-warn-*-ds`·`--c-field-*`·`--c-border-strong` 14개를 `var(--color-*)` 참조로 교체. 브라우저 실측으로 **14개 전부 이전과 동일한 값**으로 해석됨을 확인했다(값 변화 0, 출처만 이동).
  - **재배선하지 않은 것**: `--c-brand`(#1769aa) 계열 — 핸드오프 §5 "브랜드/액션은 --c-brand 계열 유지". DS `light-blue-500`(#3c69fc)로 바꾸면 화면 전체 브랜드색이 달라진다. `--sh-1`/`--sh-2` 그림자도 유지 — DS `elevation-1`은 눈에 띄게 무겁다.
  - **정리한 블록**: `/evidence` 위성 3구역(`evidence-set-*`·`phase-rule-summary`·`flood-phase-card`·`phase-tile-pair`·`satellite-compare-tool`·`compare-*`·`phase-selection-note`) / 대시보드 하단 4패널(`integration-status`·`t3q-readiness`·`mock-search-panel`·`timeline-list`) / 표(`comparison-table` 을 DS Table 수치로 — 셀 `8px 16px`, 12/18, 헤더면 `--surface-panel-blue`, 행 구분선 `--border-inner-blue`) / 나머지(`similar-event-detail`·`event-card`·`procedure-card`·`observation-list`·`report-event-detail`)
  - **개별 스펙**: 비교방식 라디오는 DS Radio `sm`(16px)에 맞춰 `accent-color: var(--c-brand)`. 빠른이동 버튼은 DS SegmentedControl `sm` 시각(32px·반경 4)을 따르되 **선택 표시는 `aria-pressed` 를 유지**했다 — D-4-2 585행이 "빠른 경계"의 `aria-pressed` 를 계약으로 고정한다(DS 는 `aria-selected` 를 쓴다).
  - **경고색**: DS `AlertBanner intent="warning"` 은 오렌지(#FFF4ED/#FC6B19)지만 **yellow 램프(yellow-25/400/700)를 유지**했다. `.notice-card.warning`·`.status-banner.scenario`·`.agent-turn-confirm` 이 이미 노랑으로 통일돼 있어 한 화면에 두 경고색이 섞이는 쪽이 나쁘다.
  - **정량 결과**: 하드코딩 hex 329 → 207(그중 18개는 `:root` 토큰 정의부라 정상, 실질 189), 비토큰 rem 폰트 크기 **17 → 0**. CSS 번들 78.02 → 111.63 kB(gzip 15.36 → 20.55 kB).
  - 검증: typecheck·build, a11y 구조검증, 스모크 3종(11/11·9/9·8/8) **외부 도메인 요청 0건**·console error 0·pageerror 0·`/api` 0건, E2E 7/7, 폭 16종(3840~320px) 가로 스크롤 0·오버레이 겹침 0px²·≥900px 4열 유지.

- **[P0 회귀 수정] 초와이드 3열 붕괴 (2026-08-03, 프로덕션 반영분에서 발견)**: 2561px 이상에서 `.dashboard-grid` 가 1열로 붕괴해 좌패널·지도·우패널이 세로로 쌓였다. 사용자가 실제 초와이드 모니터(브라우저 폭 약 2900px)에서 발견.
  - 원인: 핸드오프 README §4 의 `minmax(420px, min(1fr, var(--map-max)))` 를 그대로 옮겼는데 **`fr` 은 `min()`·`max()`·`clamp()` 안에 쓸 수 없다.** 선언 전체가 무효가 되어 `grid-template-columns` 가 통째로 버려졌다.
  - 놓친 이유: 최초 폭 스윕이 2560px 에서 끝나 브레이크포인트(2561px) 바로 아래만 검사했다. **이후 스윕에는 3840/3440/2900/2600/2561px 을 반드시 포함한다.**
  - 수정: `minmax(var(--left-panel-w),1fr) 26px minmax(420px,var(--map-max)) minmax(var(--right-panel-w),1.2fr)`. 그리드가 fr 트랙보다 확정 상한 트랙을 먼저 키우므로(CSS Grid §12.6→§12.7) "지도가 상한 도달 후 남는 폭은 우측→좌측 패널 흡수"가 그대로 나온다. 실측 3840px 에서 지도 2400px 상한, 잔여 294px 을 우측 +157 / 좌측 +137 로 흡수.
  - 함께 수정: 팝업 `max-height` 상수 110px → `calc(100% - var(--overlay-inset)*2 - 86px)`, 호버 카드 `bottom` 52px → `calc(var(--overlay-inset) + 40px)`. tier B 에서 `--overlay-inset` 이 12→20px 로 커지는데 상수가 따라가지 못해 팝업이 칩 띠를 파고들었다(실측 2,419px²).

- **패널 컴포넌트 스펙 반영 (2026-08-03, 핸드오프 §6 잔여)**: 1차 반영이 토큰·F항목·지도에 그쳐 좌우 패널이 예전 스타일 그대로였다. 화면 인상을 좌우하는 면적이라 "전반적으로 반영 안 됨"으로 보였다. 레퍼런스 4개 화면 전수 대조 후 잔여분 반영.
  - **패널 탭바**: 회색 면 + 3px 밑줄 → DS Tabs `line/sm`(패널 표면 위 1px 구분선 + 활성 탭 2px 브랜드 밑줄, 굵기 500/700)
  - **우선 확인지역 카드**: 지역명 14/20 700 브랜드색+밑줄, 점수 14/20 700 `text-error`(#d92d20) tabular-nums, 재해유형 20px 알약 배지, 위치 11/17, 하단 버튼 28px(상세보기 outline / 질의에 참조 ghost), 카드 hover 시 브랜드 테두리 + 파랑 틴트 면
  - **입력 폼**: 반경 7px→4px, 테두리 `field-border-default`(#cecfd2), 라벨 11px `field-text-label`(#686d78), 면 흰색
  - **배너**: `.notice-card.warning` → yellow-25/yellow-400/yellow-700(대비 6.5:1), `.page-status` → green-20/border-success/text-success, `.status-banner.scenario` 동일 계열
  - **버튼**: `.primary` 반경 4px·굵기 500, `.page-subnav a` ghost 링크, 피해카드 footer 버튼 28px outline
  - **피해카드 footer 배지 3종 분리**: 전부 같은 노란 pill 이라 "과거 확정 집계"가 경고처럼 읽혔다 → 경고/성공/중립으로 구분
  - **보고서**: 문서 제목 밑줄 `border-strong`(#888c94), 목차 링크 굵기 500
  - DS 상태·필드 토큰 9개를 `:root` 에 승격(`--c-text-error`·`--c-text-success`·`--c-warn-*-ds`·`--c-field-*`·`--c-border-strong`). 값은 DS 라이트 테마 원본(`fig-tokens.css` `:root`, 다크는 `[data-theme="dark"]` 스코프라 혼동 주의)
  - **판단 보류한 것**: 좌측 탭의 개수 배지. README 164행이 "탭에 badge 를 넣지 않는다"고 했으나 그 근거는 "DS Tabs 가 badge 를 라벨 문자열에 이어 붙여 'AI Agent2'로 읽힌다"는 것이다. 현재 구현은 별도 `<span aria-hidden>` 이라 화면낭독기는 "AI Agent"로 읽고 시각적으로도 분리돼 있어 그 문제가 없다. 마크업 구조 변경은 A-1 이 반영 대상에서 제외하므로 그대로 뒀다.
  - 검증: 폭 16종(3840~320px) 가로 스크롤 0 · 오버레이 겹침 0px² · ≥900px 4열 유지, 스모크 3종·E2E 7/7·typecheck·build 통과

- **POC 접근성 범위 확정 (2026-08-03, 사용자 결정)**: **화면낭독기 대응과 WCAG AA 기준(대비·터치타깃 크기)은 POC에서 고려하지 않는다.** 본 개발 단계에서 재검토한다.
  - 효과: 디자인 스펙과 접근성 기준이 충돌하면 **디자인 스펙을 따른다.** 인계문서 D-1 461행·D-3 511행의 "44px 미만 컨트롤 제안 금지"를 근거로 스펙을 벗어나지 않는다. 기존 "44px 예외 사인오프 대기" 항목은 폐기했다.
  - 44px 때문에 보류했던 것을 스펙대로 되돌림: `.field input`·`.field select` 36px, `.primary`·`.agent-send`·`.report-actions button`·`.damage-structure-button` 36px, `.global-nav a` 32px(Tabs sm). 반경·굵기도 DS 값(4px / 500)으로 정리.
  - **단, ARIA 속성·role·라벨은 제거하지 않는다.** 접근성 때문이 아니라 **검증 게이트가 그것에 의존**하기 때문이다 — `validate_multi_page_a11y.py`(skip-link·`aria-label="주요 메뉴"`·`aria-current`·`tabIndex={-1}`·`.focus()`), `smoke_dashboard_console.py`(`get_by_role('tab')`·`role="dialog"`·`aria-modal`), `smoke_report_console.py`(`.sr-only[aria-live]`·`aria-pressed`), `tests/e2e/accessibility-navigation.spec.ts`(`getByRole` navigation/link/radio/slider·`getByLabel`·키보드 Tab). 인계문서 D-4도 이를 계약으로 고정한다. 이걸 지우면 게이트가 깨진다.
  - `@media (pointer: coarse)` 블록은 남겨뒀다 — 준수 요건이 아니라 터치 화면 시연용 편의다.

- **시범화면 UI 디자인 반영 완료 (2026-08-03)**: `design_handoff_pilot_ui/` 핸드오프(README + 30_design_system_handoff.md + design_reference.dc.html) 반영. 변경 범위는 `apps/web/src` 9파일이며 API·OpenAPI·JSON Schema·Seed·Provider 계약 변경 0건.
  - **타입 스케일 고정(§1)**: `--fs-*` 유동 clamp → UNE DS 고정 rem(11/12/14/16/24) + `--fs-title` 20/32 신설, `--lh-*` 동반. 루트 배율 106.25%/112.5%/118.75% 3단 → 100%(≥2400px만 106.25%). 자간 -0.03em 전역, 굵기 750/800 → 700 일괄 32건.
  - **F-14 sticky offset 파생**: `--header-h`(3.125rem) 하나에서 `--sticky-offset`·`--subnav-offset`·`--report-preview-h` 파생. 1600/2000/2400px의 상수 오버라이드(160/172/184px) 3줄 삭제. `AppHeader`가 ResizeObserver로 `--header-h`만 갱신하되, `.header-row` 높이는 리터럴 `min-height`로 둬 높이→변수→높이 되먹임 진동을 차단(이 되먹임이 초기 구현에서 Playwright "element is not stable" 무한 대기를 유발).
  - **블루 크롬(§5)**: `--surface-page-blue`/`--surface-panel-blue`/`--border-panel-blue`/`--border-inner-blue`/`--accent-line-blue` 5개 시맨틱 승격 후 `--c-bg`·`--c-canvas`·`--c-surface-alt`·`--c-line`·`--c-line-soft`에 매핑. 값은 DS `tokens/fig-tokens.css` 원본(light-blue 20/25/75/50/200). 상태색은 파랑으로 바꾸지 않음. 노랑 면 위 11px 텍스트는 yellow-700(#8a5600, 6.5:1)로 교체.
  - **F-5 지도 오버레이 띠 재배치**: 상단 좌측 연결상태 필 / 상단 우측 베이스맵 전환 버튼 1개(`영상지도로`↔`일반지도로`) / 상단 우측 상세 팝업(기본 닫힘) / 중단 POI 핀 / 좌하단 호버 요약 카드 / 하단 레이어 칩 행. 팝업의 앵커 추종·말풍선 꼬리 배치계산 전량 제거(`onPopupAnchorMove` 폐기).
  - **POI 마커·호버 요약 카드 신규**: `VWorldMapAdapter`에 `onPoiChange` 추가 — L1 점 피처의 화면 픽셀을 postrender마다 계산하되 위치 서명이 바뀔 때만 React로 올린다. L1은 캔버스 원 스타일을 없애고(`styleFor` 조기 반환) HTML 핀이 호버·포커스·클릭을 직접 받는다. 요약 카드는 핀을 따라다니지 않고 좌하단 고정(220px 다크 네이비, 지역명/주소/지표 1개 = 우선순위 순위·점수 또는 재해유형).
  - **F-15 피해 카드 열 배분**: `.damage-columns[data-history=both|response|recovery|none]`. 빈 열 대신 카드 하단 데이터 상태 줄(점선 상자 + `대응/복구 이력 미확보` 아웃라인 배지)로 이동 — "미확보" 문구 유지(D-2).
  - **F-16 tier B(>2560px)**: `--map-max` 2400px, 패널 폭 확대, `--overlay-inset` 20px, `--map-poi-size` 28px. 우측 패널 초과 폭에서 우선 확인지역 카드 2열(`.priority-list` 래퍼 신설).
  - **헤더 4항목 축소(§7)**: 브랜드(+h1)·지역 Select·전역 내비·상황뷰 저장만 남기고, 기준시각·모드·재난유형은 `<main>` 최상단 컨텍스트 줄(`SituationContextRow`)로 이동 — 헤더 `overflow:hidden`이 시각을 "2026-08-02 14"로 잘라 틀린 값을 보이던 문제 제거. 수축 경로는 브랜드 h1 말줄임 하나뿐.
  - **좌측 패널**: 추천질문 사각 버튼 → 알약 칩(28px, flex-wrap, 접힘 기본 + summary에 건수), 참조 칩 → 컴팩트 아웃라인 알약(22px/10px, ✕ 14px), 말풍선 반경 12px(꼬리 4px)·본문 14/20, 컴포저 textarea rows 6→3 + min-height 76px.
  - **4열 상황판 하한 1280px → 900px**: `max-width:1280px` 조기 붕괴 제거(그 폭에서 우측 판단 패널이 아래로 밀려났음). 900px 실측 지도폭 282px.
  - **핸드오프 README 수치를 벗어난 3곳**(각각 코드 주석에 근거 기재):
    - 팝업 `max-height: calc(100% - 80px)` → `calc(100% - 110px)`, `top: 56px` → `calc(--overlay-inset + 46px)`. 원 수치는 프로토타입(`design_reference.dc.html` 292행)에 실제 구현돼 있으나 **한 줄짜리 짧은 연결상태 문구를 전제**한다. 이 서비스의 seed-only 문구는 지도 282px에서 두 줄이 되고, 그 상태로 원 수치를 쓰면 팝업이 두 줄 필(실측 232px²)과 40px 칩 띠를 덮어 **README 자신이 이 배치의 목적으로 적은 "서로 다른 가로띠를 점유해 겹치지 않는다"가 깨진다**. 이탈 근거는 상위 원칙이 아니라 README의 배치 의도와 실측의 불일치다.
    - 연결상태 필 `nowrap`·"고정 폭" → `word-break:keep-all` + `max-width`. **이 이탈은 인계문서 D-1 463행 "고정폭(px) 요소 추가 금지"가 뒷받침한다**(임의 판단 아님). 말줄임이 아니라 줄바꿈이므로 자료성격 문구는 온전히 남는다(D-2). 참고로 README 200행이 근거로 든 "필 152px / 버튼 135px"은 인계문서·프로토타입 어디에도 없는 서술 전용 수치다.
    - 추천질문 칩 `nowrap` → 넘칠 때만 어절 단위 접기. 실제 추천질문은 한 문장이라 nowrap이면 320px에서 가로 스크롤이 생긴다(D-1 463행).
  - **베이스맵을 단일 토글 버튼으로 (D-4-2 585행 위반 사후 수정)**: 최초 구현에서 2버튼(각각 `aria-pressed`)을 단일 **액션** 버튼(`영상지도로`↔`일반지도로`)으로 바꾸며 `aria-pressed`를 없앴는데, D-4-2 585행이 베이스맵의 `aria-pressed`를 검증 대상으로 명시한다. 버튼 1개는 유지하되(README 199~202행의 폭 제약) 라벨을 `영상지도` 고정으로 두고 `aria-pressed={baseMap === 'satellite'}`를 복원했다. 눌림 상태는 레이어 칩과 같은 브랜드 면 채움으로 시각화. 어느 스모크·E2E도 이 항목을 단언하지 않아 게이트로는 잡히지 않았다.
  - **44px 터치타깃**: 아래 "POC 접근성 범위" 절 참고 — 디자인 스펙 수치를 그대로 쓴다.

- **인계문서 사후 확인 경위 (2026-08-03)**: 위 UI 반영 작업은 `design_handoff_pilot_ui/README.md`만 읽고 진행했고, README 264행이 "제약·검증 셀렉터·고정 문구의 근거"로 지목한 **원본 인계문서 `30_design_system_handoff.md`(750행)를 읽지 않았다.** 사후에 D절 전체를 대조해 2건을 발견했다.
  - **정정 1 — 근거 표기 오류**: 코드 주석에 "띠끼리 겹치지 않게 한다는 F-5 원칙"이라고 적었으나, F-5(인계문서 723행)는 "지도 팝업이 지도 오버레이 요소를 가린다"는 *문제 제기*이고 요청 내용은 "팝업 회피 규칙 **또는** 오버레이 재배치안" 중 택일이다. 확정 원칙이 아니다. '가로띠' 배치는 README 6-2절(151~163행)의 제안이며 **인계문서 D절에는 오버레이 겹침 조항이 없다.** 해당 주석 3곳을 출처 분리해 재작성했다.
  - **정정 2 — 실제 계약 위반**: 위 베이스맵 `aria-pressed` 건. 수정 완료.
  - **위반 없음을 확인한 항목**: D-4-1 셀렉터 41종, D-4-2 나머지 `aria-pressed`(레이어 칩·침수흔적·사례·빠른 경계), D-4-3 고정 문구 33종(변경한 `추천질문 4건`·`대응 이력 미확보`는 목록에 없음), D-4-4 구조 토큰, D-2 고정 문구·`미확보` 규칙, D-3 256×256 타일. D-5는 불변 제약이 아니라 기존 미디어쿼리 **목록**이므로 브레이크포인트 변경(1280→899 / 1281→901)은 위반이 아니다.
  - **문서 결함 2건 (다음 세션 주의)**:
    - `README.md`에 한글 문자 손상이 있다 — 151·160·165·201·207행의 `띄`(→띠), `좀하단`(→좌하단), `오퀈0`, `컴트롤`(→컨트롤), `반짝이`. **"띠"로 검색하면 아무것도 안 잡힌다**(실제 바이트는 전부 `띄` U+B744).
    - z-index 체계가 문서 간 불일치한다. 실제 코드 기준(인계문서 265~272행) `.map-connection` 3 / `.map-layer-chips` 3 / `.map-basemap-switch` 4 / 팝업 5, README·프로토타입 기준 4 / 3 / 4 / 7(+호버 카드 6). 현재 구현은 후자를 따랐다.
  - **폭별 회귀 실측**(2560/1920/1600/1366/1280/1024/900/899/768/480/320px): 가로 스크롤 0, 오버레이 상호 겹침 0px², 헤더 51px·`상황뷰 저장` 우측 끝 뷰포트 내.
  - **게이트 재통과**: typecheck(functions+web)·build·a11y 구조검증·smoke_dashboard(11/11)·smoke_evidence(9/9)·smoke_report(8/8) 모두 console error 0 / pageerror 0 / `/api` 0건, E2E 7/7, validate_vercel_repo·smoke_priority_logic·smoke_seed_contracts·smoke_t3q_readiness·smoke_t3q_search_preview PASS.
  - **환경 이슈(코드 무관, 기존 트리에서도 동일 재현)**: `smoke_mock_spatial_layers.py`는 `read_text()`에 encoding 미지정이라 Windows cp949에서 UnicodeDecodeError, `validate_json_schema_contracts.py`는 `jsonschema` 모듈 미설치로 실행 불가.
- **Phase 7 완료 (2026-08-02, evaluator PASS)**: 외부 Provider별 Fixture 연계 (FIXTURE_VALIDATED)
  - data/fixtures/providers/ 6종(kma_nowcast·hrfco_hydrology·une_rag·t3q_event·t3q_risk·t3q_spatial) × 대표응답·오류·cases 18파일
  - server/providers 매퍼 export: mapKma/mapHrfco/mapUneRag FixturePayload·Error (실 fetch 경로 무변경), t3qFixtureAdapter.ts 신규(라우트 미연결, 매핑 검증 전용)
  - tests/provider/provider_fixture_gate.cjs + scripts/run_provider_fixture_gate.sh (`npm run test:provider-fixtures`): 6×3=18케이스, fetch 가드로 network calls 0 단언, actual 위장 전수 스캔
  - FIXTURE_VALIDATED 기록: tests/provider/provider_fixture_validation_result.json + PROVIDER_FIXTURE_VALIDATION.md (seed·계약 무변경, current=mock 유지, DEFAULT 미전환)
  - integrations/status.ts message에 FIXTURE_VALIDATED 병기 (validation_state enum 불변)
  - cp949 인코딩 수정: smoke_public_observation_provider.py
  - 회귀 전체 재통과, 계약 동결 diff 0
- **Phase 6 완료 (2026-08-02, evaluator PASS)**: Vercel 배포 + VWorld 도메인 확인
  - 배포 URL: **https://une-aidata-web.vercel.app** (프로젝트 une-aidata-web, GitHub main 자동 배포)
  - Hobby 12함수 제한 대응(사용자 승인): api/ 31라우트 → server/routes/** + api/index.ts catch-all 1함수 + vercel.json rewrite `/api/(.*)→/api`. 외부 HTTP 경로·OpenAPI 계약 불변, 검증은 3자 대조(핸들러↔라우팅테이블↔OpenAPI)로 강화
  - 배포 이슈 해결 여정: build:web workspace 스코프(별칭 추가) → outputDirectory(Root Directory 설정) → 12함수 제한(통합) → ESM ERR_MODULE_NOT_FOUND(.js 확장자 + seeds fs 로딩 + includeFiles data/**) → 대괄호 catch-all 다중 세그먼트 미매칭(index.ts + rewrite)
  - 검증: /·/evidence·/report 직접 URL·새로고침 200, /api/health·map/layers 200 envelope, 미등록 404 envelope, VWorld 타일 실로드 확인("연결 정상" 배지 — tileloadend 기반), 키 하드코딩 0건
- **Phase 5 완료 (2026-08-02, evaluator PASS)**: Playwright E2E 7/7 통과
  - @playwright/test 1.62.1 + chromium-1234 준비, playwright.config.ts webServer에 VITE_USE_SEED_DIRECTLY·VWorld 키 공백 주입
  - SatelliteComparison에 좌우/스와이프 비교 UI 신설(설계 정본 docs/04 SCR-EVD-001·docs/14 §14.5 — 기존 E2E 테스트 3이 요구하던 미구현 기능. radio 좌우비교/스와이프, range "비교 경계 위치", 25/50/75% 버튼)
  - PageHeading: 최초 로드 h1 자동초점 제거(라우트 변경 시에만) — E2E 테스트 2 키보드 접근 수정
  - tests/e2e/multi-page-navigation.spec.ts 신규(직접 URL·reload·뒤로/앞으로·/api 0건, 4테스트)
  - .gitignore에 test-results/·playwright-report/ 추가
  - 회귀 재통과: typecheck·contracts·validate·a11y 구조검증·smoke 3종·runtime-gate·conformance, 계약 동결 diff 0, 기존 spec 무변경(assert 완화 없음)
- **Phase 4 완료 (2026-08-02, evaluator PASS)**: /report 선택 근거·유사도·대응비교 연계
  - apps/web/src/domain/similarEventSeedFallback.ts 신규: server/domain/similarEvents.ts compareResponses의 seed 전용 최소 미러링 (유사도 점수 산정 미복제, Passage evidence 정규화)
  - apiClient loadSimilarEvents fallback: response_comparison·evidence(passage_id) 채움, profile_id='SEED-FALLBACK'·'Seed Fallback 참고 점수' 표기
  - ReportEditor: 유사도 요약(+"Seed 참고사례 · T3Q 실데이터 아님" 배지)·대응비교 표·Passage 근거 목록·초안 검증 패널(draft-validation, 경고 실시간 소멸)·저장 초안 reload 복원(버그픽스)
  - scripts/smoke_report_console.py 신규(8스텝, 포트 5185) + package.json test:report-console 등록
  - 회귀 재통과: typecheck·contracts·validate·유사사례 smoke 3종·콘솔 smoke 3종·runtime-gate·conformance·build, 계약 동결 diff 0
- **Phase 3 완료 (2026-08-02, evaluator PASS)**: /evidence PRE/EVENT/POST 및 근거 선택 흐름 완성
  - apiClient.ts: FORCE_SEED의 selectFloodPhaseAssets가 server/domain/satellitePhaseSelection.ts를 직접 import(단일 소스)해 seed 자산으로 실제 선정 수행 — offset_days_from_target·selection_reason 3건 화면 표시
  - scripts/smoke_evidence_console.py 신규(9스텝: 타일 6개 256×256, phase note, mock 배지, 근거 선택→/report 반영→reload 복원, console/api 에러 0) + package.json에 test:evidence-console 등록
  - scripts/smoke_report_context.py: Windows cp949 호환(encoding='utf-8')
  - 회귀 재통과: typecheck·contracts·validate·위성 smoke 4종·dashboard/evidence console smoke·runtime-gate·conformance·build, 계약·Seed 동결 영역 diff 0
- **Phase 2 완료 (2026-08-02, evaluator PASS)**: /dashboard Mock/Seed 진입~조회 흐름 완결
  - apiClient.ts: FORCE_SEED(`VITE_USE_SEED_DIRECTLY=true`)에서 비-fallback 5종(loadObservations·createSituation·sendAgentMessage·selectFloodPhaseAssets·searchT3qMock)이 /api 요청 없이 seed 기반 동작
  - SituationAgentPanel.tsx: apply/submit unhandled rejection 제거, inline-error(role=alert) 표시
  - MapPanel.tsx: 미존재 GeoJSON ID 비차단 안내(role=status, .map-highlight-notice), mapReady 가드
  - scripts/smoke_dashboard_console.py 신규: vite dev(FORCE_SEED, VWorld 키 무) 10스텝 시나리오 — console/page error 0, /api 요청 0 자동 단언
  - 회귀 재통과: typecheck·contracts(31 op/260 obj)·validate·runtime-gate·provider-conformance·build 전부 PASS, 계약·Seed 동결 영역 diff 0
- 환경 참고: Python 의존성은 `python -m pip install -r requirements.txt` + `python -m playwright install chromium`으로 설치, Git Bash에는 pyenv-win shim으로 python3 사용 가능. **주의: PowerShell에서 `npm run test:runtime-gate` 실행 시 WSL bash로 해석돼 실패할 수 있음 — Git Bash에서 실행할 것**

## In progress
- **UI 재구성 완료 (2026-08-03)** — 발주처·행안부 담당자가 볼 화면 기준으로 정리. 전 항목 배포 완료:
  - 수계마스크 픽셀 분석 **제거**(영상분석은 벤더 산출물 범위 — OpenAPI 31→30, 승인된 계약 변경)
  - 와이드 모니터 대응: 사이드 상한 축소(340/400) + **본문 폭 상한 제거**(`--page-max: none`) → 해상도에 따라 중앙 지도만 신축 (지도 폭 1366:627 → 1920:1065 → 2560:1675 → 3840:2950, 전 구간 가로 스크롤 0)
  - 상단 여백 확보: 헤더 2줄→**1줄 통합**(`.header-row`), 큰 제목·설명 블록 제거, h1은 헤더로 축소 이동 → 1920px 상단 여백 267→81px
  - `현재 판단` 카드: `지도에서 보기` 버튼 제거 → **카드 클릭=지도 이동**, 재해유형 태그·위치 요약, `상세보기`→모달. 신규 공용 `DistrictDetail.tsx`(지도 팝업과 공유)·`DetailModal.tsx`
  - `과거 피해·대응·복구 사례`(구 NDMS 교체 대비 Seed): 원시 JSON 덤프 제거 → 피해금액·복구비 억원 환산·집계 출처·시설구분 표로 재구성, 원시 구조는 `응답 구조 보기` 팝업으로
  - PRE·EVENT·POST 영상자료 **메타데이터 표 삭제**(타일 카드와 정보 중복, a11y 검증 토큰은 실제 대안으로 교체)
  - `docs/30_design_system_handoff.md` 최신화 + 캡처 11장 재촬영
- **재해대장 조인 완료 (2026-08-02)**: 행안부 재해대장 115,563행에서 5건 매칭 — 유사사례에 실제 피해금액·복구비 표시(예: 구미 태풍 산바 80.9억/311.9억, 남원 2020 호우 437.6억/1,504.5억)
- **AI Agent 상호작용 강화 완료 (2026-08-02)** — POC1(`ref/` 화면캡쳐 3종) 재현:
  - 지도 모든 POI 클릭 → 요약 팝업(위험요인·임계값표·저감대책·사업비·우선순위·근거 문서/페이지). L1 위험지구는 `loadPlanReference()`로 상세 전개
  - 선택 대상 → AI Agent 컨텍스트 칩(최대 5건) → 질의와 함께 전송. **주어 없는 질문("여긴 왜 위험해?")도 성립**. 서버 agent는 컨텍스트·키워드(하천/기준유량/위험지구/피해사례/절차/관측소) 규칙 해석 + evidence에 근거 문서·페이지 부착
  - 우측 `계획·근거` 탭 하드코딩 제거 → 실데이터(위험지구 요약·필터·카드 상세 / 하천 제원 + **지점별 계획홍수량·주의보/경보 기준유량 표**). 그동안 미노출이던 `rivers.json` 최초 활용
  - 유사사례 탭에 피해·대응·복구 정보 렌더(`SimilarEvent.damage` 등 계약에 있으나 미표시였음)
  - 영상지도에서 벡터 라인 고대비 색 + casing 2겹으로 분기
  - 계약·OpenAPI·Seed 무변경. 신규 API 라우트 없음(정적 참고자료는 public/seed 직접 로드)
- **Phase 8 진행 중** — 인증정보 불필요 구간 완료 (2026-08-02):
  - Shadow 하네스: tests/provider/provider_shadow_gate.cjs + scripts/run_provider_shadow_test.sh (`npm run test:provider-shadow -- --provider <id>`). 키 미설정 시 HELD·네트워크 0건, 설정 시 실호출 1회→actual 계약검증→fixture 구조 병행비교→redaction 자기검증
  - 승격 절차: docs/29_provider_shadow_and_promotion_procedure.md (핵심: env 키 설정=즉시 실경로 전환이므로 Shadow는 로컬 셸 env만, Vercel env 설정=SELECTABLE 승격 행위. provider별 2단계 승인)
  - 상태 기록: tests/provider/provider_promotion_status.json (6종 FIXTURE_VALIDATED, t3q 3종은 promotion_hold — 실 Endpoint 미확정)
  - 회귀 번들 기준선 8종 전부 통과 (typecheck·contracts·fixture/runtime gate·콘솔 smoke 3종·observation·E2E 7/7)
- **une_rag Shadow 완료 (2026-08-02)**: 실제 UNI RAG v1.1.0 대상 SHADOW_PASSED (로그인 JWT→/search/ 검색, Passage 5건 actual 정규화, fixture 구조 일치, 비밀정보 0건). 사용자 승인 1 완료 → **SHADOW_TESTED 기록**. 과정에서 uneRag.ts 실스키마 반영: 로그인 필드 설정화(UNE_RAG_LOGIN_ACCOUNT_FIELD=account), doc_id 후보키 추가, fixture 표본을 실응답 스키마({filename,score,text,doc_id})로 갱신
- **une_rag SELECTABLE 보류 (사용자 결정)**: 외부 시연 시 내부망 UNI RAG 접근 불가 → 당분간 Seed 기반 검색 유지, 외부 접근 가능해지면 승인 2 재검토. Vercel env에 UNE_RAG_* 설정 금지 상태 유지
- **대기: kma_nowcast** (공공데이터포털 18시까지 점검 — 키 발급 후 Shadow 가능), **hrfco_hydrology** (공식 관측소 코드 미확정)
- 환경 주의: PowerShell에서 npm run test:provider-shadow 실행 시 bash가 WSL로 잡혀 .runtime-cjs가 깨질 수 있음 — `node tests/provider/provider_shadow_gate.cjs --provider <id>` 직접 실행 권장 (.runtime-cjs 재컴파일: Git Bash에서 `tsc -p tsconfig.runtime.json` + `.runtime-cjs/package.json`({"type":"commonjs"}) 존재 확인)

## Pending — 데이터 수령 대기
- **타이포 스케일 확정**: 현재 크기는 상황실 원거리 시인성 전제의 잠정값(1920px 본문 17.7px). 접근성 요구가 아니라 설계 판단이며, 디자인 실험실 산출물(type scale) 수령 후 `styles.css` `:root`의 `--fs-*` clamp 5개 + 확대 브레이크포인트 루트 배율 3개만 교체하면 됨. 상세: `docs/30_design_system_handoff.md` B-7
- **부산·인제·영천 계획자료 구조화**: 사용자가 자연재해저감 종합계획·하천기본계획 **PDF를 추후 제공** 예정. 수령 후 `data/reference/districts.json`·`rivers.json`·`geo.json`과 동일 스키마로 전사하면 지도 POI 팝업·계획·근거 패널이 그대로 동작한다(코드 변경 불필요). 현재는 의왕 41430(17지구)·구미 47190(6지구)·남원 45190(6지구) + 하천 3개(안양천·구미천·요천)만 커버.
- 참고: 원시 xlsx(`메타데이터 참고자료(T3Q)/`)에는 전국 재해대장 115,563행·위험지구 약 6,300지구가 있으나 **위험요인 서술·임계값·근거 문서페이지·좌표가 없어** 팝업 수준의 정보를 만들 수 없다(그 정보는 저감계획 PDF 판독에서 나옴). 재해대장은 피해금액·복구비 보강용으로 조인 가능.

## Pending approval
- 없음. **GM-A-01 seed 불일치는 2026-08-07 승인으로 해소**(PR #5 머지 · `GM-A-04 구미천지구`로 참조 교체, 스모크 S8/S9 재구성으로 미존재 ID 가드 보존). 08-03 의 "보류 확정"은 이 결정으로 대체됐다.

## 다음 세션에서 이어서 할 일 (2026-08-03 저녁 기준 · 우선순위)

> **결론: Phase 8은 Provider 6종 전부 "사용자만 할 수 있는 선행조건"에 막혀 있다.** 코드측 승격 준비는 100% 끝나 있어 키·Endpoint 없이 미리 할 수 있는 승격 작업은 없다. 그래서 아래 0~1번(사용자 조치)과 2번(승인 불필요 코드 작업)을 분리했다.

0. `git pull` → **`python -m pip install -r requirements.txt`** (jsonschema 미설치 — 위 Blockers 참고). 신규 환경이면 `npm install` + `python -m playwright install chromium`도.
1. **[사용자] `DATA_GO_KR_SERVICE_KEY` 발급** — 공공데이터포털 기상청 초단기실황 활용신청. **Phase 8에서 가장 간단한 건이고 이 키 하나면 그날 Shadow Test → 승인1까지 간다.** 실행: `DATA_GO_KR_SERVICE_KEY=<키> node tests/provider/provider_shadow_gate.cjs --provider kma_nowcast`. 키는 **로컬 셸 env로만** — Vercel env 설정은 그 자체가 SELECTABLE 승격이라 승인2 이후 사용자가 직접 한다(docs/29 §17-18).
   - 함정 2가지: 기상청이 `base_time` 발표 전이면 `NO_DATA(03)`을 반환해 FAILED로 떨어진다 → `KMA_REQUEST_LAG_MINUTES`를 60~70으로 올려 재시도(코드 변경 불필요). 신규 키는 활용신청 승인 반영 전 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR(30)`가 온다 → 시간 두고 재시도.
2. ~~**[승인 불필요] 버그 4건 + 검증 게이트 3건**~~ → **2026-08-08 완료.** 아래 "Done this session" 참고. (상세 계획은 "다음 작업 상세" 절에 배경으로 남겨 둠)
3. 디자인 산출물 수령 시 타이포 스케일 확정 (`docs/30` B-7 — 교체 지점 2곳뿐)
4. 부산·인제·영천 계획 PDF 수령 시 전사 (코드 변경 불필요).

### (완료됨 · 배경) 다음 작업 상세 — 2026-08-08 에 7건 전부 구현

**버그 4건**
- `scripts/smoke_mock_spatial_layers.py:6`, `scripts/smoke_t3q_mock_contract.py:4-6` — `read_text()`에 encoding 누락으로 **Windows에서 실행 자체가 크래시**(cp949). 다른 스크립트는 Phase 3·7에서 이미 같은 수정을 받았다. → `read_text(encoding='utf-8')`
- `.env.example` — `server/providers/uneRag.ts:24`가 읽는 `UNE_RAG_LOGIN_ACCOUNT_FIELD`가 선언돼 있지 않다(코드 전 env 이름 대조 결과 누락은 이 1건뿐). → `UNE_RAG_LOGIN_ACCOUNT_FIELD=account` 추가
- `server/routes/v1/integrations/status.ts:9` — `FIXTURE_VALIDATED_NOTE`를 `:54,:63,:73,:91`에서 **4개 Provider 전부에 무조건 append**한다. 원장상 `une_rag`는 이미 `SHADOW_TESTED`인데 화면은 FIXTURE_VALIDATED로 표기 중. → provider별 lifecycle 문구로 분기. **`validation_state` enum(`server/contracts.ts:55`)은 건드리지 않는다 = 계약 무변경.** 이 문자열을 단언하는 테스트는 없음을 확인했다.

**검증 게이트 3건**
- **(핵심) `provider_promotion_status.json`을 읽는 코드가 리포에 하나도 없다.** Phase 8이 승격 기록을 쌓아갈 원장인데 단계 역행·`approvals` 누락·`promotion_hold` 위반을 아무도 검사하지 않는다. → `scripts/smoke_provider_promotion_status.py` 신설 + `package.json`에 `test:promotion-status` 등록. 검사: 사다리 유효값 / **DEFAULT 금지**(CLAUDE.md:133) / SHADOW_TESTED 이상이면 `approvals` 기록 + `provider_shadow_test_result.json`의 SHADOW_PASSED 근거 존재 / `promotion_hold`면 `hold_reason` 필수 / `provider_contracts_seed.json`의 `current`가 전부 `mock` / 비밀값 미포함. 기존 게이트 판정 규칙을 재구현하지 말고 결과 파일 교차참조만.
- 베이스맵 `aria-pressed` 단언이 없다 — 인계문서 D-4-2 585행 계약인데 어느 게이트도 안 본다. → `smoke_dashboard_console.py`에 스텝 추가(false→true→false 전이 + 레이어 칩 `aria-pressed` 존재). **PR #5 로 이미 S12 까지 차 있으므로 신설분은 S13 이고 S1~S12 는 불변이다.**
- `data/seed` ↔ `apps/web/public/seed` 이중 사본의 동기화를 검사하는 게이트가 없다(지금은 전부 SYNC). → `validate_vercel_repo.py`에 공통 파일명 SHA-256 비교 추가(`geo.json` 2MB라 해시로). `data/reference` ↔ `public/seed` 공통분(criteria·districts·geo·rivers)도 포함.

계획 원문: `C:\Users\kyh\.claude\plans\bright-kindling-comet.md`

**현재 상태 요약**: Phase 1~7 완료. Phase 8은 une_rag만 SHADOW_TESTED(SELECTABLE 보류 — 내부망이라 외부 시연 불가), 나머지는 FIXTURE_VALIDATED. **실제 연결된 Provider는 없으며 배포본은 전부 Seed/Mock 동작.** 전 게이트 통과 상태(typecheck·OpenAPI 30/30/30·JSON Schema·conformance·runtime gate·fixture gate 18/18·a11y·build).

## 하천 레이어 정합 조사 (2026-08-07) — 결론: 우리 변환은 정상, 데이터셋 교체가 필요

지도에서 하천경계가 베이스맵과 어긋나 보인다는 보고로 조사. 실제 VWorld 키로 API를 호출해 실측했다.

**확정된 사실**
- **`geo.json` L2 == VWorld 2D데이터 API 의 `LT_C_WKMSTRM` 현재 응답.** 요천 기준 정점 5629개 전부 최근접거리 **0.000 m**, 평균 오프셋 **0.00 m**. → **오프라인 추출·재투영 오류는 없다.** 좌표 소수점 14자리는 VWorld API 원본이 그렇게 준다(재투영 흔적이 아님).
- **VWorld 에 하천 레이어는 `lt_c_wkmstrm`(하천망) 하나뿐.** WMS GetCapabilities 실측 177개 레이어 중 수자원 계열은 하천망 + 대/중/표준권역뿐이고 **실폭·중심선·법정 하천구역 별도 레이어는 없다.** VWorld 안에서는 대안이 없다.
- **어긋남은 상수 오프셋이 아니다.** 일반지도(Base)가 그리는 하천면과 대조하면 지점마다 E −19~+24 m, N 0~+53 m 로 방향·크기가 제각각이고 일부 지점은 0 m. 데이텀·투영 오류라면 전 지점 동일해야 한다. → **두 자료(하천망 vs 베이스맵 도식)가 서로 다른 제품**인 것이 원인.
- 위성영상 기준으로는 하천망 경계가 제방·물가를 대체로 잘 따라간다. 어긋남이 두드러지는 쪽은 **일반지도**다.

**VWorld API 제약 (실측)**
- `DOMAIN` 파라미터는 키에 등록된 서비스 URL 과 대조된다. `localhost` 로 보내면 키가 유효해도 `INCORRECT_KEY`. 로컬 개발용으로 `VITE_VWORLD_SERVICE_DOMAIN` 을 추가했다.
- **WMS 는 `Access-Control-Allow-Origin` 을 보내지 않는다**(WMTS 는 `*` 로 보낸다). 서버 응답 자체는 정상(200, image/png)이지만 OpenLayers 10 의 fetch 기반 이미지 로더에서 ORB 로 차단된다. **브라우저 직결 불가** — 우회하려면 서버측 프록시가 필요하다. 다만 WMS 가 렌더하는 형상은 우리가 이미 가진 것과 동일하므로 정합 개선 효과는 없다.

**남은 선택지 (외부 자료 조달 필요)**
- 국토지리정보원 기본공간정보 수계(하천경계·하천중심선) — 베이스맵과 계보가 같아 정합 가능성이 가장 높다. 국가공간정보포털/공공데이터포털 WMS·WFS. **미확인: 제공 형태·인증키**
- river.go.kr(RIMGIS) 하천구역 — 법정 경계라 물길보다 넓다. 공개 REST 오픈API 미확인, 성과품 SHP 신청·다운로드로 보인다
- 환경부 KRF(Korean Reach File) — 중심선 계열
- 외부 WMS 를 붙일 경우 CORS 를 또 만날 가능성이 높으므로 `/api` 하위 프록시 라우트 도입 여부를 먼저 결정해야 한다(계약 추가라 승인 대상)

**코드 상태**: 하천을 의미별 다중 소스로 분리한 카탈로그(`apps/web/src/features/map/riverLayerSources.ts`)와 런타임(`riverLayers.ts`)이 들어갔다. 소스 추가는 객체 1개 추가로 끝난다. 현재 활성 소스는 `seed-wkmstrm`(기존 geo.json L2, 표시 내용은 종전과 동일)이고, WMS·중심선·하천구역은 `unverified` 로 두어 화면에서 비활성 칩으로만 보인다. ~~**`geo.json` L2 는 대체 자료 확정 전까지 제거하지 않는다.**~~ → **2026-08-08 에 대체 자료가 확정되어 L2 를 제거했다(아래 절 참고).**

### 완료 (2026-08-08) — 국가기본도 하천 3종 반입, 기존 seed 교체

사용자가 실폭·하천경계·중심선 zip 3개를 리포 루트에 넣어 아래 계획을 그대로 수행했다. **결론: 국가기본도가 확실히 낫고, 기존 `seed-wkmstrm`(geo.json L2)은 제거했다.**

- **원자료 확인**: 3종 모두 `Korea_2000_Korea_Unified_CS`(FE 1,000,000 / FN 2,000,000 / CM 127.5 / k 0.9996) = **EPSG:5179**, CP949. `TN_RIVER_BT` 실폭 Polygon 28,262 / `TN_RIVER_BNDRY` 경계 Polygon 140,851 / `TN_RIVER_CTLN` 중심선 PolyLine **3,224,769**.
- **`RIVER_NM` 은 중심선에만 있다.** 실폭·경계에는 하천명 속성이 아예 없다(테이블정의서 실측). `RIVER_SE` 코드도 정의서 `세부코드` 시트에서 읽었다 — RVC001 국가하천 / 002 지방하천 / 003 소하천 / 004 기타하천 / **005 세류**. 남원 중심선 61,869건 중 52,912건이 세류라 그대로 그리면 하천망이 묻힌다 → **세류 제외**.
- **정합 판단(핵심)**: 영상지도 위 실측에서 기존 L2 는 일반화가 거칠고 남서로 밀려 물가선을 벗어났고, 같은 지점에서 국가기본도 실폭은 물가선·모래톱까지 따라갔다. 두 자료 정점 거리는 요천 중앙값 **11.7 m** · 안양천 13.1 m · 구미천 29.6 m. 캡처는 `build/river/compare/` 4장.
- **`geo.json` L2 3건(RIV-YC·GMC·AYC) 제거** — 사용자 승인. `data/reference` · `apps/web/public/seed` 양쪽 **순수 삭제 31,733줄 · 추가 0줄**(나머지 바이트 동일).
  - **끊길 뻔한 연결 2가지를 살렸다**: ① 지도 하천 클릭 → `rivers.json` 제원 팝업 ② Agent 의 `RIV-*` highlight(CLAUDE.md 규칙 7). 실폭·경계에는 이름이 없으므로 **이름을 가진 중심선으로 공간조인**해 `river_id` 를 붙였다(요천 5 · 구미천 1 · 안양천 2 폴리곤). **이름을 추정해 붙이지 않는다 — 중심선이 실제로 그 도형을 지날 때만 연결한다.**
  - 한 하천이 여러 폴리곤이므로 `highlightFeature` 가 **조각 전부를 잡아 합친 범위로 fit** 하도록 고쳤다(한 조각만 잡으면 엉뚱하게 확대된다).
  - 실측: 실폭 폴리곤 클릭 시 `요천 · 국가하천 · 유역면적 485.7 km² · 연장 17.83 km · 남원수위표 계획홍수량 2,005㎥/s(주의보 1,003 / 경보 1,404) · 근거 문서·페이지`까지 그대로 나온다.
- **신규 소스 4개**: `ngii-realwidth`(대표, 기본 표시 · 칩 행 `하천`) · `ngii-boundary` · `ngii-centerline` · `ngii-river-name`. 나머지 3개는 레이어 메뉴에서 비교용으로 켠다.
- **하천명 POI 레이어**: 중심선 조각마다 글자를 붙이면 같은 이름이 수천 번 겹친다 → **하천당 가장 긴 조각의 중간 정점 1개**만 대표점으로 쓴다(좌표를 새로 만들지 않는다). 지자체별 33·87·100개, 10~29 KB.
- **지연 로딩**: 파일이 지역당 0.5~3.5 MB 라 초기 로드에 얹지 않는다. `dataUrlTemplate` 소스는 **켤 때 처음 받고** 받은 지역은 캐시하며, 지역이 바뀌면 이전 형상을 치우고 켜져 있는 소스만 다시 받는다.
- **경량화**: 2 m Douglas-Peucker + 좌표 6자리로 원본의 6~24%. 반입 `apps/web/public/reference/rivers/` 12파일 **17 MB**. 원본 SHP·`build/` 는 gitignore.
- **스크립트 3종 신설**: `extract_river_layers.py`(3종 추출 · `.prj` 가드 · 중심선 dbf 832 MB 전건 파싱 회피) · `build_river_web_layers.py`(단순화·세류 제외·`river_id` 조인·라벨 생성) · `compare_river_alignment.py`(정합 측정). **형상만 옮기고 면적·하폭 등 파생 지표는 만들지 않는다**(ADR-011).
- **부수 수정**: `.env` 의 `VITE_VWORLD_MAP_KEY==…` (등호 2개) 때문에 키 앞에 `=` 가 붙어 배경지도가 전부 실패하고 있었다. 그 문자만 제거해 일반·영상지도 정상. dev 서버 콘솔의 502 24건은 백엔드 없는 `/api/v1/*` 폴백이며 VWorld 와 무관하다.
- **주의**: `compare_river_alignment.py` 는 L2 를 기준으로 삼으므로 이 커밋 이후로는 그대로 돌지 않는다(스크립트 안에 사유 기재).
- **미정리**: `scripts/extract_realwidth_river.py` 는 `extract_river_layers.py` 가 완전히 대체한다(중복). 사용자 판단 대기.
- 검증: typecheck·build·validate(6,931 entries)·seed·priority·contracts(OpenAPI 30/30/30 · JSON Schema 265/18)·runtime gate·fixture 18/18·conformance·spatial assets·a11y·콘솔 스모크 3종(11/11·9/9·8/8, console·pageerror·`/api`·외부도메인 전부 0)·E2E 7/7 전부 PASS.

### (배경) 2026-08-07 중단 지점 — 위 작업으로 해소됨

**다음 후보: 국토지리정보원 국가기본도_실폭하천** — VWorld 디지털트윈국토
`https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=MK&dsId=20250122DS00007`
SHP · EPSG:5179(UTM-K) · 전국 218MB · 2025-02-21 갱신.
**VWorld 베이스맵과 같은 국가기본도 계보**라 정합 가능성이 가장 높다(가설 — 숫자로 확인 전까지 확정 아님).

1. **파일 확보 (사용자 작업).** 다운로드는 `/dtmk/downloadResourceFile.do?ds_id=…&fileNo=…` 이고 **로그인 세션이 필요**하다. 비로그인 호출은 200/Content-Length 0 로 빈 응답. 500MB 이상은 '선택다운로드'를 요구하지만 218MB 라 직접 받기 대상이다.
   - 2026-08-07 시도분(`국가기본도_하천중심선/`)에는 SHP 이 없고 **라온K 다운로드 관리자 설치파일(raonkSetup.exe)** 과 테이블정의서만 받아졌다. 브라우저 설정에 따라 관리자 경유로 빠지므로 실제 `.zip` 이 떨어졌는지 확인 필요. 받은 것은 **실폭하천이 아니라 하천중심선**이었다.
2. **추출·변환.** 준비된 스크립트: `<scratchpad>/extract_realwidth_river.py` (zip 경로만 인자로 주면 됨). 전국 SHP 을 스트리밍으로 훑어 `geo.json` L3 실경계 bbox(의왕·구미·남원, 2km 여유)에 걸리는 도형만 EPSG:4326 GeoJSON 으로 뽑는다. `.prj` 를 먼저 읽어 5179 가정이 맞는지 확인하는 가드가 들어 있다.
3. **정합 비교.** 일반지도·위성영상에 얹어 기존 `lt_c_wkmstrm` 와 나란히 놓고 오프셋 수치화. 측정 스크립트도 scratchpad 에 있다(`measure_base.py`, `outline_overlay.py`). 세션이 바뀌어 scratchpad 가 사라졌으면 재작성.
4. 더 잘 맞으면 카탈로그에 소스 추가 → `geo.json` L2 교체 검토(**Seed 변경이라 승인 대상, 별도 PR**).

**도구**: `pyshp`, `pyproj` 전역 설치 완료(requirements.txt 에는 아직 미반영 — 실제로 쓰기로 확정되면 추가). `openpyxl` 없음(테이블정의서 판독 시 필요).

**주의**: 외부 SHP 원본은 `.gitignore` 로 막아 리포에 들어가지 않는다. 전처리 산출물만 `data/` 아래로 반입한다.

## Next steps (Phase 8 잔여 — provider별 독립 진행)
1. **kma_nowcast (가장 간단, 권장 1순위)**: 공공데이터포털에서 기상청 초단기실황 활용신청 → 서비스키 확보 → 로컬 셸에서 `DATA_GO_KR_SERVICE_KEY=<키>` 설정 후 `npm run test:provider-shadow -- --provider kma_nowcast` → 결과 검토 후 승인1(SHADOW_TESTED) → Vercel Preview env 설정(승인2)·회귀 재통과 → SELECTABLE
2. **hrfco_hydrology**: HRFCO Endpoint·키 + **공식 관측소 코드 확정 필수** (v0.7 규칙 4 — official_station_code 없으면 하네스가 HELD 처리)
3. **une_rag**: UNE RAG URL·계정 준비 → Swagger probe 먼저 (`/api/v1/integrations/une-rag-probe`) → 실제 경로 확인 후 UNE_RAG_SEARCH_PATH 설정 (경로 추정 금지, v0.7 규칙 5)
4. t3q 3종은 실 Endpoint 미확정으로 promotion_hold — Phase 8 승인 대상 아님
5. 주의: 키는 로컬 셸 env로만 (Vercel env 설정은 SELECTABLE 승격 승인 후에만), 키를 채팅·코드·문서에 남기지 말 것, DEFAULT 전환 금지. 상세 절차: docs/29

## Blockers
- **`jsonschema` 미설치로 `npm run test:contracts`의 절반이 실행 불가** (2026-08-03 확인). `scripts/validate_json_schema_contracts.py:5`가 import하는데 `requirements.txt:4`에 선언만 있고 설치가 안 돼 있다. `test:contracts` = `test:openapi-contracts && test:schema-contracts`이므로 **Phase 8 승인2 전 회귀 번들 8종 중 2번 항목이 통째로 실패**한다. 해소: `python -m pip install -r requirements.txt` 한 줄. (`test:openapi-contracts`는 정상 — 실측 `30 handler routes = 30 routing-table entries = 30 operations`.)
- **PowerShell에서 `.sh` 게이트 실행 주의 — Phase 8 주 실행 경로에 직접 걸린다.** `npm run test:provider-shadow` = `bash scripts/run_provider_shadow_test.sh`이고 그 `:10`이 `rm -rf .runtime-cjs`를 한다. bash가 WSL로 잡히면 `.runtime-cjs`가 삭제된 채 재컴파일에 실패할 수 있다. 우회: Git Bash에서 `tsc -p tsconfig.runtime.json` + `.runtime-cjs/package.json`(`{"type":"commonjs"}`) 확인 후 `node tests/provider/provider_shadow_gate.cjs --provider <id>` 직접 실행.
- (해소됨) @playwright/test 404는 재발하지 않음 — 1.62.1 설치 완료.

## How to run
- 의존성: `npm install` (Node >= 22.12.0) + `python -m pip install -r requirements.txt` + `python -m playwright install chromium`
- 검증: `npm run validate` → `npm run test:contracts` → `npm run typecheck:functions` → `npm run test:runtime-gate` → `npm run test:provider-conformance`
- 빌드: `npm run build` / 개발: `npm run dev:web`
- Windows: `python3` 대신 `python`, `.sh`는 Git Bash로 실행
