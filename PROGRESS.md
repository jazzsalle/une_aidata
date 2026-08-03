# PROGRESS.md — 회사↔집 인계 기록

## Last updated
2026-08-03 회사 PC (시범화면 UI 디자인 핸드오프 반영 2차 — 초와이드 3열 붕괴 P0 수정 + 패널 컴포넌트 스펙. 기준은 `design_handoff_pilot_ui/`, 디자인 원본은 `UNE Design System/`)

## Current goal
Phase 8 — 실제 Provider Shadow Test 및 단계별 승격 (합격 기준: evaluation_criteria.md Phase 8, 승격마다 사용자 승인 필요)

## Done
- 기준선 정리: vercel-source-v1.5.1을 리포 루트로 승격, gate bundle은 archive/ 보관
- GitHub 연결: https://github.com/jazzsalle/une_aidata (main + 태그 design-v1.8.1-source-v1.5.1 push 완료)
- 하네스 구성: planner/generator/evaluator subagent, /phase-run, /handoff, /resume-work, evaluation_criteria.md, SessionStart hook
- **Phase 1 완료 (2026-08-02, evaluator PASS)**: npm install 성공(package-lock.json 생성, playwright 1.62.1 정상 — 404 재발 없음), validate·contracts(OpenAPI 31/31, JSON Schema 260/18)·typecheck:functions·typecheck:web·runtime-gate·provider-conformance 전부 PASS, `npm run build` 성공(apps/web/dist 산출). 계약 파일 변경 0건.

## Done this session
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
  - **[사인오프 대기] 44px 터치타깃 예외 4곳**: 아래 "Pending approval" 절 참고.

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

## Pending approval (Seed 불일치 영향범위 보고)
- **[디자이너 사인오프 필요] 44px 터치타깃 예외 (2026-08-03 UI 반영분 · 패널 스펙 반영으로 4곳 → 7곳으로 확대)**
  - 2차 추가분: `.panel-tabs button[role="tab"]` **32px**(DS Tabs sm), `button.priority-detail-button`·`button.context-add-button` **28px**(DS Button 2xs), `.damage-event-card footer button` **28px**. 모두 AA(24×24) 충족이며 `pointer: coarse` 에서 44px 복원.
  - 예외로 두지 **않은** 것(디자인 스펙보다 D-1 을 우선): `.field` 입력 3종과 `.primary`(질의 실행·현재 조건 적용) — 디자인은 36px 이나 텍스트 입력·주 액션이라 44px 유지. `.map-popup-close` 44px 유지.
  - 벗어난 조항: 인계문서 **D-1 461행** "44px 미만 컨트롤 제안 금지"(`.chip`·`.agent-context-remove`를 개별 44px 지정 대상으로 이름까지 열거), **D-3 511행** 고정 치수 "터치타깃 44px". 핸드오프 README 16~18행도 "절대 깨지 않을 것"에 44px을 올렸다.
  - 대상·현재값: `.map-layer-chips .chip`·`.map-layer-count`·`.map-basemap-switch button` **28px** / `.agent-suggestions > summary` **36px** / `.agent-context-remove` **14px**
  - 줄인 근거: (1) 같은 README가 뒤에서 28px 컨트롤을 지정해 스스로 모순된다(176·202·222행). (2) D-1이 표방한 기준은 **WCAG 2.2 AA**이고 AA의 터치타깃 요구는 24×24 CSS px(2.5.8), **44px은 AAA(2.5.5)** 수준이다 — 28px·36px은 AA를 충족한다. (3) 지도 위 44px 컨트롤은 하단 띠가 지도 높이를 크게 잠식한다.
  - AA 미달은 `.agent-context-remove` 14px **하나뿐**이며, 이것은 README 183행이 유일하게 명시적으로 "44px 터치타깃 예외 대상(밀집 데스크톱 컨트롤)"이라 선언한 컨트롤이다.
  - 완화: `@media (pointer: coarse)`에서 전부 44px(참조 칩 ✕는 24px)로 복원. **이 완화는 두 문서 어디에도 없는 자체 판단이므로 승인 대상이다.**
  - 택1: (a) 현행 유지 승인 + D-1에 예외 조항 추가, (b) 전부 44px 복원(지도 하단 띠 높이 증가 감수), (c) README 예외 선언분(참조 칩 ✕)만 남기고 나머지 44px 복원
  - 코드 위치: `apps/web/src/styles.css`의 `[승인된 이탈 · 사인오프 대기]` 주석 블록
- `apps/web/public/seed/priority_areas_seed.json`의 `SIT-GM-POC-001`(47190 구미) rank 1이 `spatial_object_id: "GM-A-01"` 참조하나 `geo.json`에 해당 feature 없음(GM 계열은 GM-A-03/04/07, GM-B-10/13, GM-C-01만 존재). 현재 UI 가드로 비차단 안내 처리됨. 근본 수정은 seed 동결 해제 승인 필요 — 택1: (a) geo.json에 GM-A-01 feature 추가, (b) priority_areas_seed의 참조 ID를 기존 ID로 교체

## 회사 PC에서 이어서 할 일 (2026-08-03 기준 우선순위)
0. `git pull` → (신규 환경이면 `npm install` + `pip install -r requirements.txt` + `python -m playwright install chromium`)
1. **GM-A-01 seed 불일치 결정** — 승인 한 번이면 끝. 아래 "Pending approval" 절 택1. 검수에서 눈에 띌 수 있는 항목
2. **kma_nowcast 실연계** — 공공데이터포털 키 발급이 유일한 선행조건. 가장 간단한 Phase 8 진행 건
3. 디자인 산출물 수령 시 타이포 스케일 확정 (`docs/30` B-7 — 교체 지점 2곳뿐)
4. 부산·인제·영천 계획 PDF 수령 시 전사 (코드 변경 불필요)

**현재 상태 요약**: Phase 1~7 완료. Phase 8은 une_rag만 SHADOW_TESTED(SELECTABLE 보류 — 내부망이라 외부 시연 불가), 나머지는 FIXTURE_VALIDATED. **실제 연결된 Provider는 없으며 배포본은 전부 Seed/Mock 동작.** 전 게이트 통과 상태(typecheck·OpenAPI 30/30/30·JSON Schema·conformance·runtime gate·fixture gate 18/18·a11y·build).

## Next steps (Phase 8 잔여 — provider별 독립 진행)
1. **kma_nowcast (가장 간단, 권장 1순위)**: 공공데이터포털에서 기상청 초단기실황 활용신청 → 서비스키 확보 → 로컬 셸에서 `DATA_GO_KR_SERVICE_KEY=<키>` 설정 후 `npm run test:provider-shadow -- --provider kma_nowcast` → 결과 검토 후 승인1(SHADOW_TESTED) → Vercel Preview env 설정(승인2)·회귀 재통과 → SELECTABLE
2. **hrfco_hydrology**: HRFCO Endpoint·키 + **공식 관측소 코드 확정 필수** (v0.7 규칙 4 — official_station_code 없으면 하네스가 HELD 처리)
3. **une_rag**: UNE RAG URL·계정 준비 → Swagger probe 먼저 (`/api/v1/integrations/une-rag-probe`) → 실제 경로 확인 후 UNE_RAG_SEARCH_PATH 설정 (경로 추정 금지, v0.7 규칙 5)
4. t3q 3종은 실 Endpoint 미확정으로 promotion_hold — Phase 8 승인 대상 아님
5. 주의: 키는 로컬 셸 env로만 (Vercel env 설정은 SELECTABLE 승격 승인 후에만), 키를 채팅·코드·문서에 남기지 말 것, DEFAULT 전환 금지. 상세 절차: docs/29

## Blockers
- 없음. (@playwright/test 404는 재발하지 않음 — 1.62.1 설치 완료)

## How to run
- 의존성: `npm install` (Node >= 22.12.0) + `python -m pip install -r requirements.txt` + `python -m playwright install chromium`
- 검증: `npm run validate` → `npm run test:contracts` → `npm run typecheck:functions` → `npm run test:runtime-gate` → `npm run test:provider-conformance`
- 빌드: `npm run build` / 개발: `npm run dev:web`
- Windows: `python3` 대신 `python`, `.sh`는 Git Bash로 실행
