# 30. UNE 디자인 시스템 인계 문서 — 재난안전 AI 대응지원 POC

| 항목 | 값 |
|---|---|
| 대상 코드 | `apps/web` (React 19 + TypeScript + Vite, OpenLayers/VWorld 2D) |
| 스타일 단일 파일 | `apps/web/src/styles.css` (1,350행 · 전역 CSS 1개, CSS-in-JS·Tailwind 없음) |
| 페이지 | `/` 대시보드 · `/evidence` 근거 · `/report` 보고서 (SPA, `apps/web/src/hooks/useRoute.ts`) |
| 본문 폰트 | Spoqa Han Sans Neo (self-host, SIL OFL 1.1, `apps/web/public/fonts/*.subset.woff2`) |
| 작성 기준 | Design v1.8.1 / Source vercel-source-v1.5.1 · 본 문서는 코드를 직접 읽어 전사했다 |

---

## A. 이 문서 사용법 (디자이너 먼저 읽기)

### A-1. 산출물은 "완성 CSS"가 아니라 **토큰 값 + 컴포넌트 스펙**으로 주세요

| 요청하는 것 | 요청하지 않는 것 |
|---|---|
| 토큰표 (B절 형식 그대로, 토큰명 유지 + 새 값) | `styles.css`를 대체할 완성 CSS 파일 |
| 컴포넌트별 스펙 (배경/테두리/반경/여백/타이포/상태별 변화) | 새 클래스명 체계·유틸리티 클래스 도입 |
| 상태 변형 정의 (hover / active / selected / open / disabled / hidden / focus) | 마크업(HTML 구조·요소 종류) 변경안 |
| 대비비(contrast ratio) 계산값이 포함된 색 팔레트 | 아이콘 폰트·외부 CDN·새 웹폰트 추가 |

**이유.** 현재 마크업은 접근성 요건(터치타깃 44px, `aria-*` 상태, 포커스 링, 320px reflow)과 자동화 검증(스모크·E2E)이 클래스명·문구에 직접 걸려 있다(D-4, D-5절). 외부에서 만든 CSS를 통째로 덮으면 (1) 44px 터치타깃·포커스 링이 사라지고, (2) `.priority-card .priority-title strong` 같은 검증 셀렉터가 깨지며, (3) 데이터 상태 배지 문구가 시각적으로 축약되어 안전 요건(D-2)을 위반한다.

### A-2. 산출물을 받으면 코드에 이렇게 반영된다

1. **토큰표** → `apps/web/src/styles.css`의 `:root` 블록(26–91행) 값만 교체. 토큰명은 유지.
2. **컴포넌트 스펙** → 해당 클래스 규칙의 색·여백·반경·그림자만 조정. 선택자 자체는 유지.
3. **레이아웃 변경** → C절 인벤토리의 그리드 정의(`.dashboard-grid`, `.report-layout`, `.evidence-page` 등) 값만 조정. D-5의 브레이크포인트 동작을 함께 제시할 것.
4. 반영 후 `python scripts/smoke_dashboard_console.py` / `smoke_evidence_console.py` / `smoke_report_console.py` / `validate_multi_page_a11y.py` / `npm run test:e2e`를 재실행해 회귀를 확인한다.

### A-3. 우선순위 (POC1 대비 개선 요청 순)

1. 좌측 AI Agent 대화 영역의 세로 배분 (F-3, F-4)
2. 지도 팝업 `.map-feature-popup`과 지도 오버레이 요소(연결상태·레이어 칩·베이스맵 스위치)의 층위·회피 규칙 (F-5)
3. 우측 패널 `계획·근거` 탭의 정보밀도(표·팩트리스트) 가독성 (F-9)
4. 데이터 상태 배지(`.seed-badge` / `.status-badge` / `.chip`) 체계 통일 및 미정의 변형 보강 (F-1, F-2)

---

## B. 현재 디자인 토큰 (`apps/web/src/styles.css` `:root`, 26–91행 전사)

> 값은 **실제 파일에서 그대로** 옮겼다. 임의 보정·환산 없음.

### B-1. 타이포 스택

| 토큰 | 현재 값 | 용도 | 주 사용처 |
|---|---|---|---|
| `--font-sans` | `"Spoqa Han Sans Neo", Pretendard, "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | 전역 폰트 스택 — **이 토큰 한 곳에서만 관리** | `:root { font-family: var(--font-sans) }` |

부가 설정: `font-synthesis: none`, `text-rendering: optimizeLegibility`. 웨이트는 400/500/700 3종만 self-host(4–24행). CSS에서 `font-weight: 750/800`을 쓰는 곳이 다수라 실제로는 700으로 렌더된다.

### B-2. 색

| 토큰 | 현재 값 | 용도 | 주 사용처 |
|---|---|---|---|
| `--c-text` | `#142033` | 본문 기본 글자 | `:root color`, `.map-popup-facts dd`, `.plan-fact-list dd`, `.plan-district-detail ul` |
| `--c-text-strong` | `#123e63` | 제목·강조 글자 | `.app-page-title`(헤더 h1), `.map-popup-head h3`, `.report-doc-title`, `.plan-*-head strong`, `.event-damage-block h4` |
| `--c-text-muted` | `#5b6f82` | 보조설명·정의어(dt) | `.map-popup-facts dt`, `.plan-summary dt`, `.plan-evidence`, `.plan-station-table caption` |
| `--c-text-soft` | `#66798b` | 섹션 부연 문구 | `.section-heading-row p`, `.section-heading-row span` |
| `--c-brand` | `#1769aa` | 주 브랜드·주요 액션 | `.map-popup-badge`, `.map-popup-action`, `.agent-tab-badge`, `.plan-badge.type`, `.report-doc-ranked-item::marker`, `.panel-resizer-handle:hover::before` |
| `--c-brand-deep` | `#154b7a` | 주요 액션 hover | `.map-popup-action:hover` |
| `--c-brand-ink` | `#14486f` | 진한 브랜드 면/글자 | `.agent-turn.user` 배경, `.agent-context-chip` 글자, `button.context-add-button` 글자 |
| `--c-brand-soft` | `#eef6fc` | 옅은 브랜드 면 | `.agent-turn.assistant` 배경, `.agent-context-chip` 배경, `button.context-add-button` 배경, `.plan-district-toggle:hover` |
| `--c-brand-line` | `#cfe1ef` | 옅은 브랜드 테두리·구분선 | `.agent-turn.assistant` 테두리, `.agent-turn-summary` 상단선, `.agent-turn-context` 상단선, `.plan-damage-list li` 좌측선 |
| `--c-surface` | `#fff` | 카드·패널 표면 | `.evidence-section`, `.report-outline/.report-form/.report-preview`, `.map-feature-popup`, `.plan-*-card`, `.suggestion` |
| `--c-surface-alt` | `#f6f8fb` | 보조 표면(푸터바·요약칩) | `.agent-suggestions`, `.agent-context-bar`, `.map-popup-foot`, `.plan-summary > div`, `.plan-source-note` |
| `--c-bg` | `#eef2f6` | 루트 배경 | `:root background` |
| `--c-canvas` | `#e8eef4` | 문서(body) 배경 | `body background` |
| `--c-line` | `#cbd6e2` | 기본 테두리 | `.evidence-section`, `.report-*` 카드, `.map-feature-popup`, `.site-footer` 상단선, `.panel-resizer-handle::before` |
| `--c-line-soft` | `#d8e2ec` | 내부 구분선 | `.map-popup-head/foot` 경계, `.agent-composer` 상단선, `.plan-*-card` 테두리, `.map-popup-table` 셀선 |
| `--c-warn-bg` | `#fff6df` | 경고 면 | `.report-warning`, `.draft-validation` |
| `--c-warn-line` | `#ebcf82` | 경고 테두리 | `.report-warning`, `.draft-validation`, `.map-popup-flag`, `.damage-quantity-note` |
| `--c-warn-text` | `#6b4c07` | 경고 글자 | `.agent-turn-confirm`, `.damage-quantity-note` |
| `--c-neutral-bg` | `#eef1f5` | 중립 알림 면 | `.agent-turn-notes.limitations`, `.plan-badge.grade` |
| `--c-neutral-line` | `#ccd6e0` | 중립 알림 테두리 | 위와 동일 |
| `--c-neutral-text` | `#3f5364` | 중립 알림 글자 | 위와 동일 |
| `--c-focus` | `#ffbf47` | **포커스 링 색(변경 시 대비 재검증 필수)** | `:focus-visible { outline: 3px solid var(--c-focus); outline-offset: 3px }`, `.agent-thread:focus-visible`, `.report-preview-doc:focus-visible` |

> 토큰화되지 않은 하드코딩 색이 아직 많다(예: `.priority-title span #c84b42`, `.rank` 배경 `#1769aa`, `.procedure-card` 좌측선 `#3b87bd`, `.status-badge.actual #e4f6e9/#195f2f`, `.seed-badge #fff3d5/#664b06/#e6ca78`, `.map-connection` 상태점 `#16845b/#e8a519/#c73f3a/#777`). **팔레트를 제안할 때 이 하드코딩 값들도 함께 매핑해 주면 토큰화까지 한 번에 반영할 수 있다.**

### B-3. 간격

| 토큰 | 현재 값 | 용도 |
|---|---|---|
| `--sp-1` | `4px` | 아이콘·칩 내부 최소 간격 |
| `--sp-2` | `6px` | 라벨-값, 칩 간격, 소제목 하단 |
| `--sp-3` | `9px` | 카드 내부 요소 간격, 팝업 본문 상단 |
| `--sp-4` | `12px` | 카드 패딩 기본, 대화 말풍선 좌우 패딩 |
| `--sp-5` | `16px` | 섹션 패딩, 대화 스레드 하단 |
| `--sp-6` | `22px` | (정의만, 사용처 없음) |
| `--sp-7` | `30px` | (정의만, 사용처 없음) |
| `--sp-gap` | `clamp(10px, .78vw, 20px)` | 최상위 그리드 간격 — `.dashboard-grid`, `.evidence-page`, `.report-layout` |
| `--page-pad` | `clamp(12px, 1.15vw, 32px)` | 페이지 좌우 패딩 — `.page-main`, `.header-row`, `.site-footer` |
| `--page-max` | `2200px` | 본문 최대폭 — `.page-main { width: min(var(--page-max), 100%) }` |

### B-4. 반경·그림자

| 토큰 | 현재 값 | 용도 |
|---|---|---|
| `--r-sm` | `6px` | 작은 버튼, 말풍선 꼬리쪽 모서리, `.panel-resizer-buttons button` |
| `--r-md` | `8px` | 표준 컨트롤·알림 상자 |
| `--r-lg` | `10px` | 카드·패널·팝업 |
| `--r-xl` | `14px` | 대화 말풍선 `.agent-turn` |
| `--r-pill` | `999px` | 배지·칩 (`.seed-badge`, `.map-popup-badge`, `.plan-badge`, `.agent-context-chip`, `.agent-tab-badge`) |
| `--sh-1` | `0 1px 4px rgba(27, 54, 86, .08)` | 얕은 그림자 (`.panel-resizer-buttons button`) |
| `--sh-2` | `0 2px 9px rgba(24, 49, 77, .08)` | 패널 그림자 |

> 실제로는 `.evidence-section`·`.report-*`가 `box-shadow: 0 2px 9px rgba(24,49,77,.06)`을 하드코딩하고, `.map-feature-popup`은 `0 8px 26px rgba(19,43,69,.24)`를 쓴다. **그림자 단계를 3–4단계로 정리한 제안을 권장한다.**

### B-5. 유동 타이포 스케일

아래 환산값은 **루트 폰트 배율을 반영한 실제 렌더 크기**다(320·1366px는 root 16px, 1920px는 17px, 2560px는 19px).

| 토큰 | 현재 값 | 320px | 1366px | 1920px | 2560px | 주 사용처 |
|---|---|---|---|---|---|---|
| `--fs-xs` | `clamp(.6875rem, .26vw + .521rem, .9375rem)` | 11.0px | 11.9px | 13.8px | 16.6px | 배지·캡션·표 본문(`.comparison-table`, `.plan-station-table`), `.agent-turn-role/-time`, `.map-popup-flag` |
| `--fs-sm` | `clamp(.75rem, .26vw + .583rem, 1rem)` | 12.0px | 12.9px | 14.9px | 17.7px | 카드 본문, `.map-popup-facts`, `.seed-badge`, `.panel-tabs button` |
| `--fs-md` | `clamp(.875rem, .33vw + .667rem, 1.1875rem)` | 14.0px | 15.2px | 17.7px | 21.1px | 대화 본문 `.agent-turn`, `.agent-input`, `.report-preview-doc`, `.global-nav a`, `.map-popup-head h3` |
| `--fs-lg` | `clamp(1rem, .39vw + .75rem, 1.375rem)` | 16.0px | 17.3px | 20.1px | 24.2px | h2 (`.section-heading-row h2`, `.report-*  h2`, `.report-doc-heading`) |
| `--fs-xl` | `clamp(1.1875rem, .59vw + .8125rem, 1.75rem)` | 19.0px | 20.8px | 24.2px | 30.5px | `.report-doc-title` |

h1은 상단 여백 축소를 위해 헤더 한 줄(`.header-row`) 안에 배치되며 `.app-page-title { font-size: var(--fs-sm); font-weight:750 }`을 쓴다(별도 축소 분기 없음).

**루트 폰트 배율**(rem 기반 토큰이 함께 커진다): `≥1600px` → `106.25%`, `≥2000px` → `112.5%`, `≥2400px` → `118.75%`. clamp의 `vw` 성분과 이 배율이 **곱해져** 넓은 화면에서 증가폭이 커진다 — B-7 참조.

### B-6. 레이아웃 변수

| 토큰 | 현재 값 | 용도 |
|---|---|---|
| `--panel-min-h` | `clamp(620px, 70vh, 1040px)` | 대시보드 3패널 높이 (≥1600px: `clamp(660px,72vh,1080px)`, ≥2000px: `clamp(700px,74vh,1160px)`) |
| `--sticky-offset` | `148px` | sticky 요소 상단 오프셋 — `.report-outline`, `.report-preview`, `.page-subnav`(−16px) (≥1600px: 160 / ≥2000px: 172 / ≥2400px: 184) |
| `--left-panel-w` | (기본값 없음) | **런타임 주입** — `PanelResizer.tsx`가 인라인으로 넣는다. 없으면 `.dashboard-grid`가 `clamp(300px, 19vw, 460px)` 사용 |
| `--map-popup-tail-x` | 기본 `20px` | **런타임 주입** — `MapPanel.tsx`가 말풍선 꼬리 x좌표를 px로 넣는다 |

### B-7. 타이포 스케일 — **디자인 확정 대기 (결정 지점)**

현재 값은 **잠정값**이다. 반응형 작업 당시 "상황실 대형 모니터를 원거리에서 본다"는
전제로 확대한 설계 판단이며, **접근성·품질지침이 요구한 크기가 아니다**.

- KWCAG 2.2 / WCAG 2.2 에는 **최소 글자크기 규정이 없다**.
- 관련 기준 1.4.4(Resize text 200%)는 크기가 아니라 **상대단위(rem) 사용 여부**의 문제이고,
  현재 rem 기반이라 이미 충족한다. 따라서 **크기를 줄여도 접근성 위반이 아니다**.
- 반응형 작업 이전 하드코딩 값은 본문 13~14px / 보조 11~12px 였다(현재 1920px에서 17.7 / 13.8px).

**디자인 산출물이 오면 교체할 지점은 두 곳뿐이다.**

| 교체 지점 | 위치 | 내용 |
|---|---|---|
| 유동 타이포 5개 | `apps/web/src/styles.css` `:root` (B-5 표) | `--fs-xs|sm|md|lg|xl` 의 `clamp(최소, vw기울기 + rem기준, 최대)` |
| 루트 배율 3개 | `apps/web/src/styles.css` 확대 브레이크포인트 | `:root { font-size: 106.25% / 112.5% / 118.75% }` (≥1600 / ≥2000 / ≥2400px) |

**요청 형식**: 완성 CSS가 아니라 **type scale**(크기·행간·자간·굵기)과 **뷰포트별 기준값**
(예: 1366 / 1920 / 2560px에서의 본문·보조·제목 크기)으로 주면 위 두 지점에 바로 반영한다.

**축소하더라도 지켜야 할 것**: rem 기반 유지(1.4.4), 대비 AA, 320px reflow 가로 스크롤 0,
터치타깃 44px. 작은 글씨에 연회색 조합 금지(D-1 참조).

---

## C. 화면·컴포넌트 인벤토리

상태 표기: `H`=hover, `A`=`.active` 클래스, `S`=`.selected`, `O`=`.open`, `D`=`:disabled`, `P`=`aria-pressed="true"`, `C`=`aria-current="page"`, `X`=`[hidden]`, `F`=`:focus-visible`.

### C-1. 공통 셸 (`App.tsx`, `AppHeader.tsx`, `PageHeading.tsx`)

| 클래스 | 역할 | 상태 변형 |
|---|---|---|
| `.app-shell.multi-page-shell` | 최상위 셸. `min-height:100vh`, `grid-template-rows: auto 1fr auto` | — |
| `.site-header` | sticky 상단 헤더 (`top:0`, `z-index:20`) | ≤900px에서 `position:static` |
| `.skip-link` | 본문 바로가기. 평소 `translateY(-180%)`로 숨김 | `:focus` → `translateY(0)` |
| `.header-row` | 브랜드+페이지명(h1) · 현재상황 컨텍스트 · 전역 내비를 한 줄로 배치(`flex-wrap`) | 폭이 부족하면 자동 줄바꿈, ≤900px 세로 스택 |
| `.brand-block` | 서비스명(`strong`) + 페이지명 h1(`.app-page-title`) | ≤900px 전체폭 |
| `.global-nav` | `<nav aria-label="주요 메뉴">` | `a:hover` 배경 `#eef5fa` / `a[aria-current="page"]` **C**: 글자 `#0d5e97`, 배경 `#e9f3fa`, 테두리 `#8cbadb` |
| `.context-bar` | 지역·기준시각·모드·재난유형 + 상황뷰 저장. `.header-row` 안의 flex 묶음 | 폭이 부족하면 wrap, ≤900px 전체폭 (D-5) |
| `.context-select` / `.context-item` | 셀렉트 / 읽기전용 값 (`span` 라벨 + `strong` 값, 가로 배치) | 모든 폭에서 표시 유지, ≤560px 항목별 전체폭 |
| `.secondary-action` | 헤더 보조 버튼(상황뷰 저장) | — |
| `.page-main` | `width: min(--page-max, 100%)`, `padding: --page-pad` | ≤560px `padding:12px` |
| `.page-status` | 라우트 상태 알림 (`role="status"`), `<main>` 최상단, 녹색 계열 | `color:#245b35 !important` 하드 지정 |
| `.site-footer` | 하단 상태문구 2개 | ≤900px 세로 스택 |
| `.global-error` | 전역 오류 배너 (`position:fixed; top:75px; 중앙`) | — |

### C-2. 대시보드 `/` — 그리드

| 클래스 | 역할 | 상태 변형 |
|---|---|---|
| `.dashboard-grid` | 4열: `var(--left-panel-w, clamp(300px,19vw,460px))` / `26px`(구분자) / `minmax(420px,1fr)`(지도) / `clamp(350px,23.5vw,560px)`(우측) | ≥1281px: `height: var(--panel-min-h)` 고정, 각 패널 자체 스크롤 / ≤1280px: 2열 / ≤900px: 1열 |
| `.panel-resizer` | 좌측 패널 폭 조절 구분자 컬럼 | `.dragging` → 핸들 색 `--c-brand` / ≤1280px `display:none` |
| `.panel-resizer-handle` | `role="separator"`, `tabIndex=0`, `cursor:col-resize`. 4px 세로 바(`::before`) | **H**/`.dragging` → `::before` 배경 `--c-brand` |
| `.panel-resizer-buttons` | 좁히기·넓히기·기본값 버튼 3개 (각 26×44px) | **H** → 배경 `--c-brand-soft` |
| `body.panel-resizing` | 드래그 중 전역 커서·선택 방지 | — |
| `.left-panel` / `.right-panel` | 세로 flex 패널 (흰 배경, 테두리, 반경 9px) | — |
| `.dashboard-timeline` | 하단 관측 타임라인 섹션 | — |
| `.timeline-list` | 가로 스크롤 그리드 `grid-auto-columns: minmax(170px,1fr)` | ≥1600px 200px / ≥2000px 230px |
| `.section-heading-row` | h2 + 부연 좌우 배치 | — |

### C-3. 대시보드 좌측 — AI Agent (`SituationAgentPanel.tsx`)

| 클래스 | 역할 | 상태 변형 |
|---|---|---|
| `.panel-tabs` | 2열 탭바 (`재난상황 입력` / `AI Agent`) | `button.active` **A**: 글자 `#1769aa`, 배경 `#fff`, 하단선 3px |
| `.agent-tab-badge` | AI Agent 탭의 컨텍스트 개수 배지(파란 알약, `aria-hidden`) | 컨텍스트 0건이면 렌더 안 함 |
| `.panel-scroll` | 탭 패널 스크롤 영역 (`padding:14px`) | — |
| `.panel-scroll.agent-chat` | 대화 탭 전용. `padding:0`, `overflow:hidden`, 세로 flex (2-클래스 선택자로 특이성 확보) | ≤900px `min-height:520px` |
| `.agent-thread` | 대화 로그 (`role="log" aria-live="polite" tabIndex=0`), 세로 그라데이션 배경 | **F** → `outline:3px solid var(--c-focus); outline-offset:-3px` |
| `.agent-thread-intro` | 대화 시작 안내 (점선 테두리) | — |
| `.agent-turn` | 말풍선 공통. `max-width:88%`, `--r-xl` | ≥1600px 84% / ≤900px 94% / ≤400px 100% |
| `.agent-turn.user` | 담당자 질문 — 우측 정렬, 배경 `--c-brand-ink`, 흰 글자, 우하단 모서리 `--r-sm` | — |
| `.agent-turn.assistant` | AI 답변 — 좌측 정렬, 배경 `--c-brand-soft`, 테두리 `--c-brand-line`, `max-width:94%` | — |
| `.agent-turn-head` / `-role` / `-time` | 말풍선 머리말(역할·시각). `-time`은 `tabular-nums` | user일 때 `-time` 색 `#cfe2f2` |
| `.agent-turn-body` | 본문 문단 (`word-break: keep-all`) | — |
| `.agent-turn-context` / `-context-label` / `-context-item` | 질의와 함께 전달한 선택 대상 목록 | user 말풍선에서 테두리·글자색 반전 |
| `.agent-turn-summary` | "근거 N건 · 유사사례 N건 · 지도 이동 …" 요약줄 | user일 때 상단선·글자색 반전 |
| `.agent-turn-notes.warnings` | 확인 필요 안내 (연노랑 `#fff4d9`) | — |
| `.agent-turn-notes.limitations` | 자료 한계 (중립 `--c-neutral-*`) | — |
| `.agent-turn-confirm` | **"담당자 확인 필요 · 공식 위험도·피해예측·자동 조치결정이 아닌 참고정보입니다."** 알약 | 삭제·축약 금지 (D-2) |
| `.agent-turn-pending` | "답변을 정리하는 중입니다…" 점선 말풍선 | 전송 중에만 |
| `.agent-composer` | 입력부 컨테이너 (상단선, `flex:0 0 auto`) | ≤860px(높이) 패딩 축소 |
| `.agent-context-bar` / `.agent-context-hint` | 컨텍스트 칩 구획 + 안내문 | 컨텍스트 0건이면 렌더 안 함 |
| `.agent-context-chips` / `.agent-context-chip` | 선택 대상 칩 목록 | 종류별: `.kind-district`(파랑) / `.kind-similar_event`(노랑) / `.kind-river`(청록) |
| `.agent-context-chip-text` | 칩 텍스트 (`nowrap` + `ellipsis`) | — |
| `.agent-context-remove` | 칩 제거 버튼 44×44 원형 | **H** → 배경 `rgba(19,74,114,.14)` |
| `.agent-input` | 질의 textarea, `min-height:120px` | ≤860px(높이) 92px / ≥1600px 132px / ≥2000px 150px |
| `.agent-composer-hint` | "Ctrl(⌘)+Enter로 전송합니다." | — |
| `.agent-send` | 질의 실행 버튼 (`.primary.full.agent-send`) | **D** 전송 중·상황 미선택 |
| `.agent-suggestions` | 추천질문 `<details>`. `max-height:40%` | 첫 질문 후 자동 접힘(`open=false`) / ≤860px(높이) `max-height:32%` |
| `.agent-suggestion-list` | `repeat(auto-fit, minmax(150px,1fr))` 자동 2열 | — |
| `.suggestion` | 추천질문 버튼 (`min-height:44px`) | **H** → 테두리 `#9cc4e5`, 배경 `#f5faff` |
| `.status-banner.scenario` / `.hybrid` | 입력 탭 상단 모드 배너 (노랑 / 파랑) | — |
| `.field` / `.field-grid` | 라벨+입력 세트 / 2열 입력 그리드 | ≤560px `.field-grid` 1열 |
| `.observation-list` | 적용 중인 조건 목록 (`article` 3열 구성) | — |
| `.inline-error` | `role="alert"` 오류 문구 (분홍 `#fff1f2`) | — |
| `.primary` / `.primary.full` / `.primary.ghost` | 주요 버튼 변형 | **D** `opacity:.55; cursor:not-allowed` |

### C-4. 대시보드 중앙 — 지도 (`features/map/MapPanel.tsx`)

| 클래스 | 역할 | 상태 변형 |
|---|---|---|
| `.map-panel` | 지도 섹션 (`position:relative`). h2·설명은 `.sr-only` | `.compact`(근거 페이지용) `min-height:360px` |
| `.map-canvas` | OpenLayers 타겟 (`aria-hidden="true"`), 기본 그라데이션 배경 | `min-height`: 420 → ≥1600px 500 / ≥2000px 600 / ≥2400px 680 |
| `.map-connection` | 좌상단 연결상태 배지 (`role="status"`), `z-index:3` | `.connected`/`.connecting`/`.error`/`.seed-only` → `.status-dot` 색 변경 |
| `.status-dot` | 8px 상태점 | 위 4상태 |
| `.map-error` | 오류 배너 (`role="alert"`, 좌상단) | — |
| `.map-highlight-notice` | **존재하지 않는 GeoJSON ID 안내**(비차단), 좌상단 52px | 미존재 ID일 때만 |
| `.map-basemap-switch` | 우상단 일반지도/영상지도 토글 (`z-index:4`) | `button[aria-pressed="true"]` **P**: 배경 `#1769aa`, 흰 글자 |
| `.map-layer-chips` | 좌하단 레이어 칩 그룹 (`z-index:3`) | — |
| `.chip` | 레이어·필터 칩 (`min-height:44px` in 지도/계획탭) | **A** `.active`: 테두리·글자 `#1769aa`, `font-weight:800`, 지도에서는 `inset 0 0 0 2px #145c8f` / **D** `opacity:.55` (관측소·피해위치·대피소는 미연결) / `.chip.pending`은 CSS만 존재, 현재 미사용 |
| `.map-feature-popup` | POI 말풍선 (`role="dialog"`, `tabIndex=-1`). 폭 `clamp(320px,21rem,360px)`. position/left/top/z-index(5)/max-width/max-height/visibility는 **JS 인라인 지정** | `.district` → 폭 `clamp(336px,22rem,360px)` / `.place-above` `.place-below` `.place-side`(꼬리 숨김) |
| `.map-popup-head` | sticky 머리말 (제목 + 배지 + 닫기) | `.place-below`일 때 `padding-top:19px` |
| `.map-popup-badge` | 재해유형 배지 (브랜드색, `max-width:10em` ellipsis) | — |
| `.map-popup-close` | 44×44 닫기 버튼 | **H** → 배경 `--c-surface-alt` |
| `.map-popup-body` | 본문 | ≤400px 좌우 패딩 축소 |
| `.map-popup-flags` / `.map-popup-flag` | Mock·잠정 플래그 알약(경고색) | — |
| `.map-popup-facts` | `dt`/`dd` 2열 (`100px + 1fr`) | ≤400px 1열 |
| `.map-popup-section` | 위험요인/임계값/저감대책/시행·사업/피해이력/근거 하위 섹션 | — |
| `.map-popup-list` | 목록 (`::marker #6f93ae`) | — |
| `.map-popup-table` | 임계값 5열 표. `display:block; overflow-x:auto`로 팝업을 밀지 않음 | — |
| `.map-popup-source` | 근거·비고 소문자 문구 | — |
| `.map-popup-foot` | sticky 꼬리말 (액션 + 면책문구) | `.place-above`일 때 `padding-bottom:19px` |
| `.map-popup-action` | "질의에 참조 추가" (전폭, 44px) | **H** → `--c-brand-deep` |
| `.map-popup-disclaimer` | **"본 요약은 … 공식 위험등급 판정이나 피해예측이 아닙니다."** | 삭제·축약 금지 (D-2) |
| `.map-popup-tail` | 말풍선 꼬리. `left: var(--map-popup-tail-x, 20px)` | above=아래꼬리 / below=위꼬리 / side=`display:none` |

### C-5. 대시보드 우측 — 판단 패널 (`InsightPanel.tsx`)

| 클래스 | 역할 | 상태 변형 |
|---|---|---|
| `.panel-tabs.compact` | 4열 탭바 (`현재 판단`/`유사사례`/`대응절차`/`계획·근거`) | `button.active` **A** |
| `.notice-card.warning` | 노란 경고 카드 (현재 판단·계획근거 탭 상단) | — |
| `.notice-card.info` | 유사사례 탭 상단 카드 | **CSS 규칙 없음 → F-1 참조** |
| `.priority-card` | 우선 확인지역 카드 (`32px + 1fr` 그리드) | — |
| `.rank` | 순위 원형 배지 (28px, 브랜드색) | — |
| `.priority-title` | 지역명 + 점수 (`span`이 `#c84b42` 굵게) | — |
| `.card-action-row` | 카드 하단 버튼 줄 | — |
| `.priority-card button` | "지도에서 보기" | — |
| `button.context-add-button` | "질의에 참조" (요소+클래스 선택자로 특이성 확보) | **H** → 배경 `#dcecf9`, 테두리 `#7fb2dc` |
| `.event-list` / `.event-card-row` | 유사사례 목록 / 카드+참조버튼 한 쌍 | — |
| `.event-card` | 유사사례 카드 버튼 | **S** `.selected`: 테두리 `#1769aa` + `0 0 0 2px rgba(23,105,170,.12)` |
| `.event-score` | 카드 우상단 점수 알약 | — |
| `.similarity-meta` | 비교/신뢰/Graph 소형 태그 | — |
| `.event-damage-line` | "피해기록 … · 대응 N건 · 복구 N건" | — |
| `.evidence-count` | "근거 N건 · 문서관련도 …" | — |
| `.similar-event-detail` | 선택 사례 비교 상세 섹션 | 선택 사례가 있을 때만 |
| `.event-damage-block` / `h4` / `h5` | 피해정보(과거 기록) 블록 (좌측 4px 파란선) | — |
| `.event-damage-columns` | `repeat(auto-fit, minmax(190px,1fr))` | — |
| `.damage-fact-list` / `.condition-fact-list` | dt/dd 2열 (`76px + 1fr`) | ≤400px 1열 |
| `.event-history-list` | 대응·복구 이력 `ol` | — |
| `.damage-quantity-note` | **정량 피해수치 미확보/기록값 안내**(경고 테두리) | 삭제 금지 (D-2) |
| `.table-scroll` | 표 가로 스크롤 상자 (`tabIndex=0` + `aria-label`) | — |
| `.comparison-table` | 요인별 점수표 / 현재-과거 대응 비교표 / 임계값표 / 지점표 공통 | `thead th` 배경 `#eef4f8` |
| `.safety-note` | **"… 실제 T3Q 검색성능·공식 대응결정이 아닙니다."** 좌측 4px 회색선 | 삭제·축약 금지 (D-2) |
| `.procedure-card` | 대응절차 카드 (좌측 4px `#3b87bd`) | — |
| `.badge-row` | "대상지 공식 아님" / "담당자 확인 필요" 배지 줄 | ≤400px wrap |
| `.evidence-list.plan-reference` | 계획·근거 탭 루트 | — |
| `.plan-status` / `.plan-empty` | 로딩 문구 / 자료 미확보 카드(점선) | `planState`에 따라 |
| `.plan-district-section` / `.plan-river-section` | 위험지구 / 하천기본계획 구획 | — |
| `.plan-summary` | 요약 dt/dd 2열 카드 | ≤560px 1열 |
| `.plan-filter-chips` / `.plan-filter-status` | 재해유형 필터 칩 + "N개소 표시 중" | 칩 **A**/`aria-pressed` |
| `.plan-district-card` | 위험지구 카드 | **O** `.open`: 테두리 `#9cc4e5` + `0 0 0 2px rgba(23,105,170,.10)` |
| `.plan-district-toggle` | 카드 헤더 버튼 (`aria-expanded`) | **H** → 배경 `--c-brand-soft` |
| `.plan-district-head` / `.plan-district-sub` | 지구명+배지 / 부제 3줄 | — |
| `.plan-badge.type` | 재해유형 배지(브랜드색 채움) | — |
| `.plan-badge.grade` | 하천등급 배지(중립 테두리형) | — |
| `.plan-district-detail` | 펼침 상세 (`hidden` 속성 존중) | **X** `[hidden] { display:none }` |
| `.plan-damage-list` | 피해이력 목록 (좌측 3px `--c-brand-line`) | — |
| `.plan-evidence` | "근거 · 문서명 · 페이지" (점선 상단) | — |
| `.plan-source-note` | "그 밖의 근거자료" 안내 카드 | — |
| `.plan-fact-list` | dt/dd 2열 (`88px + 1fr`) | ≤400px 1열 |
| `.plan-river-card` / `.plan-river-head` | 하천 카드 / 하천명+등급 | — |
| `.plan-station-table` | 지점별 계획홍수량 표 (`--fs-xs`, 숫자 우측정렬 `tabular-nums`) | — |
| `.plan-station-version` | 계획본 표기 소문자 | — |

### C-6. 대시보드 하단 패널

| 클래스 | 역할 | 상태 변형 |
|---|---|---|
| `.integration-status` / `-toggle` | 연계 상태 접이식 패널 (`aria-expanded`) | 열림/닫힘 |
| `.status-badge` | 상태 알약 (`min-width:68px; height:28px`) | `.actual`(녹색) / `.provisional`(노랑) / **`.derived`·`.error`는 CSS 미정의 → F-2** |
| `.t3q-readiness` / `-toggle` / `-body` | T3Q 준비상태 접이식 패널 | 열림/닫힘 |
| `.readiness-summary` | "N/6 준비·설정" 우측 요약 | — |
| `.readiness-notice` | 주의 안내 (좌측 4px `#d99a1b`) | — |
| `.readiness-dimensions` / `.readiness-card` | 6차원 카드 그리드 (기본 3열) | ≤1100px 2열 / ≤700px 1열 / ≥2000px 3열 / ≥2400px 6열 |
| `.cq-coverage` / `.cq-title` | 핵심질문 5문 목록 (기본 2열) | ≤1100px 1열 / ≥2000px 3열 |
| `.consultation-items` | 개발제약·교체확인 항목 (`columns:2`) | ≤700px 1열 |
| `.mock-search-panel` / `-header` / `-controls` / `.mock-search-results` / `.mock-result-grid` | T3Q 구조 Mock 검색 패널 | ≤900px 1열 |

### C-7. 근거 페이지 `/evidence`

| 클래스 | 역할 | 상태 변형 |
|---|---|---|
| `.evidence-page` | 페이지 루트 (`grid; gap: --sp-gap`) | — |
| `.page-subnav` | 페이지 내 앵커 이동 (sticky, `top: --sticky-offset - 16px`) | ≤900px `position:static` |
| `.evidence-section` | 섹션 카드 공통 (흰 배경, `padding: clamp(14px,1.1vw,28px)`) | — |
| `.evidence-set-registry` | 증거세트 섹션 (좌측 4px `#395f86`) | — |
| `.evidence-set-select` | 증거세트 셀렉트 (`min-height:44px`) | ≤900px 세로 스택 |
| `.evidence-set-alert` | **대상지역 일치 여부 안내**(`role="note"`, 노랑) | 삭제 금지 (D-2) |
| `.evidence-set-summary` | 사건·기간·자산·Provider 요약 3열 | ≤900px 1열 |
| `.summary-definition-list` | 정의 목록 4열 | ≤900px 1열 |
| `.accessible-data-table-wrap` | 표 가로 스크롤 래퍼 | — |
| `.phase-rule-summary` | PRE/EVENT/POST 선정 규칙 안내(`role="note"`) | — |
| `.flood-phase-grid` | 3단계 카드 3열 | ≤1100px 1열 |
| `.flood-phase-card` | 단계 카드 | — |
| `.phase-selection-note` | **선정편차 ±N일 · 선정사유**(연파랑 소형 박스) | 삭제 금지 (D-4 검증 대상) |
| `.phase-tile-pair` | 위성영상 + 수계마스크 세로 2장 | ≤1100px 2열 / ≤620px 1열 |
| `.phase-tile-pair img` | **256×256 고정** (`width:256px; height:256px`, 검은 배경, 회색 테두리) | ≤620px `width:min(256px,100%); aspect-ratio:1/1` |
| `.satellite-compare-tool` | PRE·EVENT 비교 도구 섹션 | — |
| `.compare-mode-fieldset` | 좌우 비교 / 스와이프 라디오 (`label min-height:44px`) | ≤560px wrap |
| `.compare-side-pair` | 좌우 비교 2열 (`minmax(0,256px)` 고정) | ≤620px 1열 |
| `.compare-swipe-block` / `-stage` / `-line` | 스와이프 무대 256×256 + 노란 경계선 | — |
| `.compare-swipe-controls` / `-value` | range + 현재값 문구 | — |
| `.compare-swipe-quick button` | 25/50/75% 빠른 이동 (`min-width:56px; min-height:44px`) | **P** `aria-pressed="true"`: 배경 `#dcebf7`, 테두리 `#5b7898` |
| `.compare-note` | **"…지리면적·침수심·피해 정도를 의미하지 않습니다."** | 삭제·축약 금지 (D-2) |
| `.evidence-map-section` | 침수흔적도·지도 근거 섹션 | — |
| `.evidence-map-grid` | 지도 + 요약 정의목록 (`2fr / minmax(260px,1fr)`) | ≤900px 1열 |
| `.evidence-action-row` | 근거 반영 버튼 줄 | — |
| `.selection-status` | "보고서 근거로 선택됨" (`role="status"`, 녹색 굵게) | 선택 시에만 렌더 |
| `.seed-badge` | **Seed·비공식 상태 배지** (노랑 알약, `min-height:32px`) | 삭제·축약 금지 (D-2) |
| `.damage-event-grid` / `.damage-event-card` | 과거 피해·대응·복구 사례 카드 | — |
| `.damage-event-card > header` | 사건명·일자·행정명 + 유사도 점수 | ≤560px 세로 스택 |
| `.damage-columns` | 피해참고/대응이력/복구이력 3열 (`1.25fr 1fr 1fr`) | ≤900px 1열 |
| `.damage-event-card > footer` | **"현재 피해예측 아님" / "담당자 검토 필요" / "향후 T3Q Provider 교체"** 배지 + 반영 토글 | 배지 삭제 금지 (D-2) |
| `.damage-event-card footer button` | 보고서 참고사례 반영 토글 (`aria-pressed`) | **P** 라벨이 "보고서 근거에서 제외"로 변경 |
| `.safety-note` | 위성 섹션 하단 대상지역·용도 제한 문구 | 삭제·축약 금지 (D-2) |

### C-8. 보고서 페이지 `/report` (`ReportEditor.tsx`)

| 클래스 | 역할 | 상태 변형 |
|---|---|---|
| `.report-layout` | 3열: `clamp(215px,13.5vw,320px)` / `minmax(380px,1.15fr)` / `minmax(340px,.95fr)` | ≤1280px `200px 1fr` + 미리보기 전체폭 / ≤900px 1열 |
| `.report-outline` | 좌측 목차 (sticky `top: --sticky-offset`) | ≤900px `static` |
| `.report-warning` | "검토용 초안 / NDMS 자동등록 없음" (경고색) | 삭제 금지 (D-2) |
| `.report-form` | 가운데 편집 폼 (세로 flex) | — |
| `.report-form > label` | 라벨+textarea 세트 (`#report-overview` 등 id 부여) | — |
| `.report-form textarea` | `min-height:125px`, 세로 리사이즈 | — |
| `.report-selected-evidence` | 선택된 참고근거 요약 박스 (`#report-evidence`) | — |
| `.report-event-detail` | 선택 사례별 상세 (유사도 요약 + 대응비교표 + Passage) | — |
| `.report-event-detail .event-meta` | **"사건 유사도 N점 · 비교범위 N% · 신뢰 X · 데이터상태 Y"** | 형식 고정 (D-4 정규식 검증) |
| `.report-event-detail .seed-badge` | **"Seed 참고사례 · T3Q 실데이터 아님"** (소형 변형) | 문구 고정 (D-4) |
| `.report-event-empty` | "대응비교 미확보" / "근거 Passage 미확보" | — |
| `.report-passage-list` / `.passage-excerpt` / `.passage-status` | 근거 Passage 목록·발췌·상태 | — |
| `.draft-validation` | 초안 검증 패널 (`section role="status"`, 경고색) | — |
| `.draft-validation-list` | 미입력·미선택 경고 목록 | 경고 있을 때 |
| `.draft-validation-ok` | "누락 없음 —" 문구 | 경고 0건일 때 |
| `.draft-validation-note` | "확인 안내이며 저장·다운로드를 차단하지 않습니다." | 항상 |
| `.report-actions` | 저장·다운로드 버튼 줄 (우측 정렬) | `.primary`는 Markdown 다운로드 |
| `.report-preview` | 우측 미리보기 (sticky, 배경 `#f2f6f9`) | ≤1280px 전체폭·static |
| `.report-preview-doc` | **문서(종이) 렌더** (`tabIndex=0`, `max-height: calc(100vh - 245px)`) | **F** → 포커스 링 / ≤560px `max-height:none` |
| `.report-doc-title` | 문서 제목 (`--fs-xl`, 하단 2px 선) | — |
| `.report-doc-section` / `.report-doc-heading` | 대제목 섹션 (h3) | — |
| `.report-doc-subsection` / `.report-doc-subheading` | 소제목 섹션 (h4, 좌측 3px 선) | `:last-of-type` 하단 여백 0 |
| `.report-doc-paragraph` | 문단 (`line-height:1.75`) | — |
| `.report-doc-ranked-list` / `-ranked-item` | 우선 확인지역 순위 목록 (`::marker` 브랜드색) | ≥2000px 들여쓰기 확대 |
| `.report-doc-list` / `-item` / `-item-text` | 커스텀 불릿 목록 (`::before` 6px 원 `#4a86b5`) | — |
| `.report-doc-sublist` / `-subitem` | 하위 목록 (`--fs-sm`) | — |
| `.report-doc-note` | **"…NDMS 자동 제출 또는 공식 피해예측 결과가 아닙니다."** blockquote | 삭제·축약 금지 (D-2) |
| `.report-preview-source` | "Markdown 원문 보기" `<details>` + `<pre tabIndex=0>` | 열림/닫힘 |

### C-9. 공통 원자 요소

| 클래스/선택자 | 역할 | 비고 |
|---|---|---|
| `.sr-only` | 화면낭독기 전용 텍스트 | 모든 속성 `!important` — 변경 금지 |
| `.skip-link` | 본문 바로가기 | 첫 Tab 대상 |
| `button, select, input, textarea, a` | **`min-height: 44px` 전역 적용** | D-1 |
| `:focus-visible` | `outline: 3px solid var(--c-focus); outline-offset: 3px` | D-1 |
| `table` / `th` / `td` / `caption` | 표 기본 (`border-collapse`, `th` 배경 `#f2f6f9`, caption 좌측정렬 굵게) | — |
| `a` | 링크 색 `#145f96` | — |
| `html { scroll-behavior: smooth }` | 앵커 이동 | `prefers-reduced-motion`에서 `auto` |

---

## D. 불변 제약 — 디자인이 지켜야 할 선

### D-1. 접근성 (KWCAG 2.2 / WCAG 2.2 AA)

| 항목 | 현재 구현 | 디자인 제약 |
|---|---|---|
| 터치타깃 | `button, select, input, textarea, a { min-height:44px }` + 개별 44px 지정(`.map-popup-close`, `.agent-context-remove`, `.panel-resizer-buttons button`, `.compare-swipe-quick button`, `.chip`) | 44px 미만 컨트롤 제안 금지 |
| 명도대비 | **본문·보조문구 모두 AA 이상** | 작은 글씨(`--fs-xs` 11px)에 연회색(#9x 이상 밝기) 사용 금지. 배지 글자/배경 조합도 4.5:1 이상 |
| Reflow | `body { min-width: 320px }`, 320px에서 **가로 스크롤 0** | 고정폭(px) 요소 추가 금지. 표는 `.table-scroll`/`.accessible-data-table-wrap`으로 감싼다 |
| 확대 | 200% 확대에서 콘텐츠 손실 없음. rem 기반 유동 타이포 | `px` 고정 폰트 크기 확산 금지 |
| 모션 | `@media (prefers-reduced-motion: reduce)` — animation/transition `.01ms`, `scroll-behavior:auto` | 새 애니메이션 제안 시 reduce 대응 명시 |
| 포커스 | `:focus-visible` 3px `--c-focus` 외곽선 + 3px offset. 컨테이너 내부는 `outline-offset:-3px` | 포커스 링 제거·투명화 금지 |
| 색 단독 전달 금지 | 상태는 항상 텍스트 동반(`.status-badge` 라벨, `.seed-badge` 문구, `.map-connection` 메시지, `.chip` 이름) | 색·아이콘만으로 상태 구분하는 안 금지 |
| 대체수단 | 지도 정보는 우측 목록·표로 동등 제공. 스와이프에는 라디오·range·25/50/75 버튼 대체. 드래그 리사이저에는 버튼·키보드 대체 | 대체수단 제거 금지 |

체크리스트 원본: `tests/accessibility/multi-page-a11y-checklist.md`

### D-2. 데이터 상태 표기는 디자인이 아니라 **안전 요건**

`mock` / `seed` / `scenario` / `provisional` / `derived` / `actual` 구분과 아래 문구류는 **축소·제거·의역 불가**. 배지·색으로 시각적 구분을 강화하는 것은 가능하다.

| 위치 | 고정 문구(요지) |
|---|---|
| `.notice-card.warning` (현재 판단) | "공식 위험도·피해예측 결과가 아니며 담당자 확인이 필요합니다." |
| `.agent-turn-confirm` | "담당자 확인 필요 · 공식 위험도·피해예측·자동 조치결정이 아닌 참고정보입니다." |
| `.map-popup-disclaimer` | "본 요약은 관리대장·계획문서 판독 및 Mock/Seed 기반 참고 정보이며, 공식 위험등급 판정이나 피해예측이 아닙니다." |
| `.seed-badge` (위성 섹션) | "대상지역 외 POC Seed · 공식자료 아님" |
| `.seed-badge` (피해·복구) | "실제 NDMS 자료 아님" |
| `.seed-badge` (침수흔적) | "현재 GeoJSON Seed" |
| `.seed-badge` (보고서 사례) | "Seed 참고사례 · T3Q 실데이터 아님" |
| `.safety-note` (위성) | "본 표본은 부산·인제·영천 자료가 아니며 위치정합·면적계산·피해판정·공식 침수범위 산정에 사용하지 않습니다." |
| `.safety-note` (유사사례 상세) | "Mock 가중치와 과거 참고사례를 이용한 비교이며 실제 T3Q 검색성능·공식 대응결정이 아닙니다." |
| `.safety-note` (보고서) | "과거 참고정보이며 권고 조치나 자동 결정이 아닙니다. 담당자 확인이 필요합니다." |
| `.compare-note` | "…지리면적·침수심·피해 정도를 의미하지 않습니다." |
| `.damage-quantity-note` | "정량 피해수치 미확보 …" / "기록값 표시(과거 실적이며 현재 피해예측이 아닙니다)." |
| `.damage-event-card > footer` | "현재 피해예측 아님" / "담당자 검토 필요" / "향후 T3Q Provider 교체" |
| `.badge-row` (대응절차) | "대상지 공식 아님" / "담당자 확인 필요" |
| `.report-warning` | "NDMS 자동등록과 공식 보고 승인은 수행하지 않습니다." |
| `.report-doc-note` | "본 문서는 담당자 검토용 초안이며 NDMS 자동 제출 또는 공식 피해예측 결과가 아닙니다." |
| `.evidence-set-alert` | "시범 대상지역 자료" / "시범 대상지역 외 자료" |
| `.plan-station-table caption` | "주의보·경보 열은 계획홍수량 50%/70% 산출 참고값이며 고시 발령값이 아닙니다." |
| `.comparison-table caption` (임계값) | "계획서 판독값이며 발령기준이 아닙니다." |
| `.mock-search-panel` | "시연용 Mock" 배지 + "Seed Fallback 결과이며 T3Q 실데이터가 아닙니다." |

또한 값이 없는 항목은 **"미확보"**로 표기한다(`InsightPanel.tsx` / `MapPanel.tsx`의 `MISSING` 상수). 빈칸·placeholder·"-"로 대체하는 디자인은 금지.

### D-3. 고정 치수

| 항목 | 고정값 | 근거 |
|---|---|---|
| 위성영상·수계마스크 타일 | **256 × 256 px** (`width="256" height="256"` 속성 + CSS `width:256px; height:256px`) | 설계 규칙(v0.7~v0.9). `scripts/smoke_evidence_console.py` S2 + `scripts/validate_multi_page_a11y.py`가 검사 |
| 타일 표출 방식 | VWorld 2D 베이스맵에 **오버레이 금지**, 독립 카드로만 표시 | 설계 규칙 |
| 타일 개수 | `/evidence`에 6장 (`.phase-tile-pair img` 정확히 6개) | 스모크 검증 |
| 터치타깃 | 44px | D-1 |

### D-4. 자동화 검증이 참조하는 셀렉터·문구 (**클래스명·문구 변경 금지**)

> 아래 목록은 `scripts/smoke_dashboard_console.py`, `scripts/smoke_evidence_console.py`, `scripts/smoke_report_console.py`, `scripts/validate_multi_page_a11y.py`, `tests/e2e/*.spec.ts`에서 직접 뽑았다. **이 문서의 핵심이다.**

#### D-4-1. 클래스·ID 셀렉터

| 셀렉터 | 참조하는 검증 | 용도 |
|---|---|---|
| `.context-select select` / `… option` | dashboard, evidence | 지역·상황 셀렉트, 옵션 수 = Seed 상황 수 |
| `.priority-card` | dashboard | 우선 확인지역 카드 존재 |
| `.priority-card .priority-title strong` | dashboard | 1위 지역명 텍스트 일치 |
| `.priority-card button` (텍스트 `지도에서 보기`) | dashboard | 지도 하이라이트 실행 |
| `.map-highlight-notice` | dashboard S7/S8 | 존재 ID면 **없어야**, 미존재 ID면 **있어야** 함 |
| `.page-status` (+ `:has-text(…)`) | dashboard, evidence | 라우트 상태 알림 |
| `#situation-panel-input` / `#situation-panel-agent` | dashboard | 좌측 탭 패널 id |
| `#situation-tab-0` / `#situation-tab-1` | (마크업) | 좌측 탭 버튼 id |
| `#insight-panel-0` … `#insight-panel-3` | dashboard S6 | 우측 탭 패널 id (0=현재 판단 … 3=계획·근거) |
| `#insight-panel-0 .notice-card.warning` | dashboard | 현재 판단 경고 카드 |
| `#insight-panel-1 .event-card` / `.event-card.selected` | dashboard S6/S9 | 유사사례 카드·선택 상태 |
| `#insight-panel-2 .procedure-card` | dashboard | 대응절차 카드 |
| `#insight-panel-3 .evidence-list` | dashboard | 계획·근거 루트 |
| `.similar-event-detail` | dashboard S9 | 선택 사례 상세 |
| `.inline-error` | dashboard | 오류 표시 (0건이어야 PASS) |
| `.mock-search-controls select option` / `… button` / `.mock-search-results` / `.mock-search-results h3` / `.mock-search-panel .inline-error` | dashboard S10 | T3Q Mock 검색 |
| `.evidence-page` | evidence | 근거 페이지 루트 |
| `.phase-tile-pair img` | evidence S2 | **정확히 6개**, `width`/`height` 속성 `256`, `naturalWidth>0`, src에 `placeholder` 금지 |
| `.phase-selection-note` | evidence S3 | **정확히 3개** |
| `section[aria-labelledby="satellite-title"] .seed-badge` | evidence S4 | 위성 섹션 배지 |
| `section[aria-labelledby="satellite-title"] .safety-note` | evidence S4 | 위성 섹션 안전문구 |
| `.evidence-set-alert strong` | evidence S4 | 대상지역 안내 |
| `section[aria-labelledby="satellite-title"] .selection-status` | evidence S5, report S1 | 선택 상태 |
| `.evidence-map-section .evidence-action-row button` | evidence S6, report S1 | 침수흔적 토글 (`aria-pressed`) |
| `.evidence-map-section .selection-status` | evidence S6 | 선택 상태 |
| `.damage-event-card` / `… header strong` / `… footer button` | evidence S7, report S1 | 사례 카드·이름·토글(`aria-pressed`) |
| `.global-nav a[href="/report"]` | evidence S8, report S2 | 내비 링크 |
| `.report-selected-evidence` / `… ul li` / `… .safety-note` | evidence S8/S9, report S2/S4 | 선택 근거 요약 |
| `.report-preview .report-preview-doc` | evidence S8, report S5 | 미리보기 본문 |
| `#report-overview textarea` / `#report-conditions textarea` / `#report-actions textarea` / `#report-damage textarea` | report | 4개 입력 |
| `.report-event-detail` / `… h4` / `… .event-meta` / `… .seed-badge` | report S3 | 선택 사례 상세 |
| `.report-event-detail .comparison-table` (+ `caption`, `thead th`, `tbody tr`, `th[scope="row"]`) | report S4 | 대응비교 표 |
| `.report-event-detail .report-passage-list li` | report S5 | Passage 목록 |
| `section.draft-validation` (`role="status"`, **1개**) | report S6 | 초안 검증 패널 |
| `.draft-validation-list li` / `.draft-validation-ok` | report S6 | 경고 목록 / 누락 없음 |
| `.report-actions button` (`브라우저에 저장`) / `.report-actions button.primary` (`Markdown 다운로드`) | report S7 | 액션 버튼 |
| `.sr-only[aria-live="polite"]` | report S7 | 저장 상태 알림 |
| `h1` (**정확히 1개**, 헤더 안) | e2e | 페이지별 단일 h1 |

#### D-4-2. ARIA·role 셀렉터

| 셀렉터 | 참조 |
|---|---|
| `role="tab"` name `현재 판단` / `유사사례` / `대응절차` / `계획·근거` | dashboard S6/S9 |
| `role="button"` name `현재 조건 적용·재산정` | dashboard S5 |
| `role="navigation"` name `주요 메뉴` (또는 `/주요|전역/`) | e2e |
| `role="link"` name `피해·변화 근거` / `상황보고서 초안` (`/피해.*변화/`) | e2e |
| `role="radio"` name `좌우 비교` / `스와이프` | e2e a11y |
| `role="slider"` name `/비교 경계 위치/` | e2e a11y |
| `role="button"` name `50%` | e2e a11y |
| `getByLabel('상황 개요')` | e2e a11y |
| `aria-pressed` (침수흔적 토글, 사례 토글, 레이어 칩, 베이스맵, 빠른 경계) | 스모크 다수 |

#### D-4-3. 고정 텍스트 문구

| 문구 | 위치 | 참조 |
|---|---|---|
| `지도 기반 재난 상황판 \| 재난안전 AI 대응지원` | `document.title` | dashboard, e2e |
| `위성영상·침수흔적·피해복구 근거 \| 재난안전 AI 대응지원` | `document.title` | evidence, report, e2e |
| `상황보고서 초안 작성 \| 재난안전 AI 대응지원` | `document.title` | report, e2e |
| `지도 기반 재난 상황판` / `위성영상·침수흔적·피해복구 근거` / `상황보고서 초안 작성` | 각 페이지 h1 | e2e |
| `3시간 강우` / `12시간 강우` / `수위` / `유량` / `현장징후` | 좌측 입력 라벨 (`label:has-text`) | dashboard S5 |
| `현재 조건 적용·재산정` | 버튼 | dashboard S5 |
| `현재 조건을 적용하고` | `.page-status` | dashboard S5 |
| `지도에서 보기` | 버튼 | dashboard S7/S8 |
| `Mock 검색` / `Event Master` | T3Q 패널 | dashboard S10 |
| `선정편차 ±N일 · …` + (`가장 가까운 유효 후보` \| `EVENT 유효구간`) | `.phase-selection-note` (정규식) | evidence S3 |
| `대상지역 외` / `공식자료 아님` / `실제 NDMS 자료 아님` | 배지 | evidence S4 |
| `부산·인제·영천 자료가 아니며` | `.safety-note` | evidence S4 |
| `6개 타일 근거를 보고서에 반영` | 버튼 | evidence S5, report S1 |
| `현재 보고서 근거로 선택됨` / `보고서 근거로 선택됨` | `.selection-status` | evidence S5/S6 |
| `보고서 근거에 반영했습니다` | `.page-status` | evidence S5 |
| `침수흔적도 근거를 보고서에 반영` ↔ `침수흔적도 근거 제외` | 토글 라벨 | evidence S6 |
| `보고서 참고사례로 반영` ↔ `보고서 근거에서 제외` | 토글 라벨 | evidence S7, report S1 |
| `과거 피해·대응·복구 사례 선택을 보고서에 반영했습니다` | `.page-status` | evidence S7 |
| `증거세트 {id} 선택됨` / `침수흔적도: 포함` / `과거 피해·복구 사례: 1건` | `.report-selected-evidence ul li` | evidence S8/S9, report S2 |
| `시범 대상지역 자료가 아닙니다` | `.report-selected-evidence .safety-note` | evidence S8 |
| `PRE·EVENT·POST 증거세트 {id}` / `6개 타일` / `침수흔적도 Seed 근거 포함 (공식 침수범위 아님)` | 미리보기 본문 | evidence S8 |
| `사건 유사도 N점 · 비교범위 N% · 신뢰 X · 데이터상태 Y` | `.event-meta` (정규식) | report S3 |
| `Seed 참고사례 · T3Q 실데이터 아님` | `.report-event-detail .seed-badge` | report S3 |
| `과거 참고정보 · 담당자 확인 필요` | 대응비교표 `caption` | report S4 |
| `현재 확인사항` / `과거 조치` | 대응비교표 `thead th` | report S4 |
| `과거 참고정보이며 권고 조치나 자동 결정이 아닙니다` + `담당자 확인이 필요합니다` | `.safety-note` | report S4 |
| `근거 Passage:` | Passage 목록 + 미리보기 | report S5 |
| `상황 개요가 미입력` / `현재 조건이 미입력` / `담당자 조치결과가 미입력` / `피해현황이 미확인으로 남아` / `대상지역 외 표본` | 초안 검증 경고 | report S6 |
| `브라우저에 저장` / `Markdown 다운로드` | 액션 버튼 | report S7 |
| `보고서 초안을 이 브라우저에 저장했습니다.` | live region | report S7 |
| `본문 바로가기` | `.skip-link` | 마크업 |

#### D-4-4. 구조 검증 (`scripts/validate_multi_page_a11y.py`)

| 파일 | 반드시 존재해야 하는 토큰 |
|---|---|
| `hooks/useRoute.ts` | `path: '/'`, `path: '/evidence'`, `path: '/report'` |
| `components/AppHeader.tsx` | `skip-link`, `aria-label="주요 메뉴"`, `aria-current` |
| `components/PageHeading.tsx` | `document.title`, `tabIndex={-1}`, `.focus()` |
| `components/SatelliteComparison.tsx` | `width="256"`, `alt={\``, `<table>`, `<caption>`, `scope="col"`, `scope="row"`, `role="status"` |
| `components/ReportEditor.tsx` | `<label`, `aria-live="polite"`, `Markdown 다운로드`, `ndms`(대소문자 무시) |

### D-5. 반응형 브레이크포인트 (`styles.css` 실제 미디어쿼리 전수)

#### 축소 방향

| 조건 | 동작 |
|---|---|
| `≤1280px` | `.panel-resizer` 숨김 · `.dashboard-grid` → `290px minmax(430px,1fr)` 2열, `.right-panel` 전체폭(`min-height:420px`) · `.report-layout` → `200px 1fr`, `.report-preview` 전체폭·`static` |
| `≤1100px` | `.flood-phase-grid` 1열 + `.phase-tile-pair` 2열 · `.readiness-dimensions` 2열 · `.cq-coverage ol` 1열 |
| `≤1000px` | (legacy) `.satellite-compare.split`·`.comparison-grid.detailed` 1열 |
| `≤900px` | `.site-header` `static` · `.header-row` 세로 스택(`.brand-block`·`.context-bar` 전체폭) · `.global-nav` 전체폭(링크 `flex:1 1 180px`) · `.context-select` 전체폭 · `.dashboard-grid` 1열(각 패널 `min-height:520px`) · `.comparison-controls`·`.damage-columns`·`.summary-definition-list`·`.report-layout` 1열 · `.report-outline`·`.report-preview`·`.page-subnav` `static` · `.site-footer` 세로 · `.evidence-map-grid` 1열 · `.mock-search-controls`·`.mock-result-grid` 1열 · `.evidence-set-summary` 1열, `.evidence-set-select` 세로 · `.panel-scroll.agent-chat` `min-height:520px` · `.agent-turn` 94% |
| `≤700px` | `.readiness-dimensions` 1열 · `.consultation-items ul` 1단 · `.t3q-readiness-toggle`·`.readiness-summary` 좌측정렬 |
| `≤620px` | `.phase-tile-pair` 1열 + 이미지 `aspect-ratio:1/1` · `.compare-side-pair` 1열 |
| `≤560px` | `.page-main` `padding:12px` · `.context-item` 전체폭 · `.field-grid` 1열 · `.report-preview-doc` `max-height:none` · `.plan-summary` 1열 · `.compare-mode-fieldset`·`.quick-position`·`.integration-status li`·`.t3q-readiness-toggle`·`.mock-search-header` wrap · `.damage-event-card > header` 세로 · 각종 `min-width:0` 해제 |
| `≤400px` | `.agent-turn` 100% · `.global-nav a` `flex:1 1 100%`(1줄 1항목) · `.compare-swipe-quick`·`.badge-row` wrap · `.map-popup-facts`·`.plan-fact-list`·`.damage-fact-list`·`.condition-fact-list` 1열 · `.map-popup-*`·`.plan-district-*`·`.plan-river-card` 좌우 패딩 축소 |
| `높이 ≤860px` | `.agent-composer` 패딩 축소 · `.agent-input` `min-height:92px` · `.agent-suggestions` `max-height:32%` |
| `높이 ≤850px` | (legacy `.app-shell` 행 높이) · `.map-canvas` `min-height:350px` |

#### 확대 방향

| 조건 | 동작 |
|---|---|
| `≥1281px` | `.dashboard-grid { height: var(--panel-min-h) }` 고정 → 각 패널이 자체 스크롤을 갖는다(대화 스레드가 패널을 밀어내지 않도록) |
| `≥1600px` | 루트 `font-size:106.25%` · `--sticky-offset:160px` · `--panel-min-h: clamp(660px,72vh,1080px)` · `.map-canvas` 500px · `.timeline-list` 200px · `.agent-turn` 84% · `.agent-input` 132px |
| `≥2000px` | 루트 `112.5%` · `--sticky-offset:172px` · `--panel-min-h: clamp(700px,74vh,1160px)` · `.map-canvas` 600px · `.readiness-dimensions` 3열 · `.cq-coverage ol` 3열 · `.timeline-list` 230px · `.agent-input` 150px · 보고서 목록 들여쓰기 확대 |
| `≥2400px` | 루트 `118.75%` · `--sticky-offset:184px` · `.map-canvas` 680px · `.readiness-dimensions` 6열 |
| `prefers-reduced-motion: reduce` | `scroll-behavior:auto` · 모든 애니메이션·트랜지션 `.01ms` |

**설계 폭 범위: 320px ~ 2560px(상황실 대형 모니터).** 주 사용 환경은 1366×768 노트북과 1920×1080 상황실 모니터다.

---

## E. 참고 화면

### E-1. POC1 목표 UX (`ref/`) — **이 방향이 목표다**

| 파일 | 참고할 점 |
|---|---|
| `ref/POC1 화면캡쳐_01.png` | 3분할(상황입력 / 지도+대화 / 유사사례)에서 **지도 팝업이 유사도 배지·피해이력·저감대책·CTA까지 한 카드에 담긴 밀도**와 우측 유사사례 카드의 관내/타지역·재해유형·유사도 3배지 체계 |
| `ref/POC1 화면캡쳐_02.png` | 상세조회 탭의 **요약 KPI 2칸(위험지구 수·총사업비) + 유형 필터 칩 + 지구 카드 목록 + 하천 프로필 + 지점표** 수직 흐름. 현재 `.plan-*`가 목표로 하는 정보 구조 |
| `ref/POC1 화면캡쳐_03._에이전트와 상호작용png.png` | **대화 입력 위에 선택 대상 칩 + 추천질문 칩이 함께 놓인 컴포저** 구성. 현재 `.agent-context-bar` + `.agent-suggestions`가 대응하지만 배치·비중이 다르다 |

### E-2. 현재 화면 캡처 (`docs/design-handoff/screens/`)

FORCE_SEED(`VITE_USE_SEED_DIRECTLY=true`, VWorld 키 미설정) dev 서버 + Playwright(Chromium)로 촬영. **지도 배경타일이 없는 seed-only 상태**이므로 실제 운영에서는 VWorld 2D 타일이 깔린다.

| 파일 | 뷰포트/대상 | 보여주는 상태 | 용량 |
|---|---|---|---|
| `01-dashboard-1920.jpg` | 1920×1080 뷰포트 | 대시보드 기본. 4열 그리드(좌측 입력탭 / 리사이저 / 지도 / 우측 현재 판단), 우선 확인지역 2건, 레이어 칩 10개 | 135 KB |
| `02-dashboard-1366.jpg` | 1366×768 뷰포트 | 노트북 기준. **지도 하단 레이어 칩과 좌측 패널 하단(적용 버튼)이 첫 화면에서 잘림** | 86 KB |
| `03-dashboard-320.jpg` | 320×900 뷰포트 | 320px reflow. 내비 세로 스택, `.context-bar` 세로, `.dashboard-grid` 1열. 가로 스크롤 없음 | 36 KB |
| `04-agent-chat.jpg` | `.left-panel` 요소 (1600×1500 창) | AI Agent 탭. **질문 2턴 + 답변 2턴**, 탭 배지 `2`, `함께 전달한 선택 대상` 2건, 컴포저 상단 컨텍스트 칩 2개(district/similar_event), 추천질문 자동 접힘 | 59 KB |
| `05-map-popup-district.jpg` | `.map-panel` 요소 (1920×1080 창) | 위험지구 팝업 열림(`.map-feature-popup.district.place-above`). 팩트리스트·위험요인·임계값표·CTA·면책문구. **팝업이 좌상단 연결상태 배지와 좌하단 레이어 칩을 덮는다** | 60 KB |
| `06-insight-plan-tab.jpg` | `.right-panel` 요소 (1600×1500 창) | 계획·근거 탭. 유형 필터로 1개소로 좁힌 뒤 **지구 카드 펼침 상태의 하단부**(시행·사업 팩트리스트·피해이력·근거·질의에 참조) + 하천기본계획 카드 + **지점별 계획홍수량 표** | 74 KB |
| `07-evidence-1920.jpg` | 1920×5994 전체 페이지 | 근거 페이지 전체. 증거세트 선택 → PRE/EVENT/POST 3카드(각 256×256 위성+마스크) → 좌우·스와이프 비교 → 침수흔적 지도 → 피해·대응·복구 카드 5건. **주의: 이 캡처는 2026-08-02 개정 이전 화면이라 비교 도구 아래에 지금은 삭제된 "마스크 픽셀표"가 남아 있다. 재촬영 필요** | 377 KB |
| `08-report-1920.jpg` | 1920×1582 전체 페이지 | 보고서 페이지 3열. 목차/편집 폼(선택근거 요약·초안 검증 경고 2건)/문서형 미리보기 | 163 KB |
| `09-map-satellite.jpg` | `.map-panel` 요소 | 영상지도 모드의 **벡터 배색 변화**(청록 하천·노랑 POI·흑백 외곽선). 어두운 위성타일 전제 배색 | 49 KB |

합계 **1,040 KB / 9개 파일** (파일당 400KB 이하, 총 4MB 이하 충족). 07은 전체 페이지 높이가 5,994px이라 용량 제한을 맞추기 위해 JPEG 품질을 낮췄다(레이아웃 참조용).

---

## F. 미해결 · 디자인 판단이 필요한 지점

> 문서 작성 중 **코드와 캡처에서 실제로 확인한 것만** 적었다.

| # | 사안 | 확인 근거 | 요청 |
|---|---|---|---|
| F-1 | **`.notice-card.info` 스타일 부재.** `InsightPanel.tsx` 유사사례 탭이 `<div className="notice-card info">`를 쓰는데 `styles.css`에는 `.notice-card.warning`만 있다 → 배경·테두리 없이 padding만 적용 | `styles.css` 142–144행 / `InsightPanel.tsx` 153행 | info 계열(정보) 알림 스타일 정의 |
| F-2 | **`.status-badge.derived` / `.status-badge.error` 스타일 부재.** `T3qReadinessPanel.tsx`의 `badgeClass()`가 `derived`/`error`를 반환하고 `IntegrationStatusPanel.tsx`도 `derived`를 쓰지만 CSS는 `.actual`/`.provisional`만 정의 | `styles.css` 368행 / `T3qReadinessPanel.tsx` 278행 | 상태 배지 5종(actual/derived/provisional/pending/error) 색 체계 정의 |
| F-3 | **1366×768에서 첫 화면 정보 손실.** 헤더(브랜드행+컨텍스트바) + `.page-heading`이 약 260px를 쓰고 `--panel-min-h`가 `70vh≈538px`로 잡혀, 지도 하단 레이어 칩과 좌측 패널 하단 버튼이 접힌다 | `02-dashboard-1366.jpg` | **해결됨**: 헤더를 한 줄(`.header-row`)로 합치고 `.page-heading` 블록을 제거해 1920px 기준 콘텐츠 시작 y좌표 267px→81px |
| F-4 | **좌측 대화 영역 협소.** `.agent-suggestions max-height:40%`(≤860px 높이는 32%) + `.agent-input min-height:120px`(92px) + `.agent-context-bar`가 컴포저에 붙어, 1100px 창에서 `.agent-thread`에 남는 높이가 답변 1건도 못 담는다 | `styles.css` 589–639행, 754–759행 / 초기 04 캡처 | 스레드 우선 세로 배분안(컴포저 접기/자동 높이 등) |
| F-5 | **지도 팝업이 지도 오버레이 요소를 가린다.** 팝업 `z-index:5`(인라인) > `.map-connection`·`.map-layer-chips` `z-index:3`, `.map-basemap-switch` `z-index:4`. 좌상단 연결상태·좌하단 레이어 칩이 실제로 덮인다 | `styles.css` 959–961행 / `05-map-popup-district.jpg` | 팝업 회피 규칙 또는 오버레이 재배치안 |
| F-6 | **영상지도 벡터 배색의 대비.** 영상지도 전환 시 하천 청록·POI 노랑·경계 흑백으로 바뀌는데, 이는 어두운 위성타일 전제다. VWorld 키 미설정(seed-only)이나 밝은 타일 위에서는 대비가 낮다 | `VWorldMapAdapter.ts` `StyleContext.satellite` / `09-map-satellite.jpg` | 두 베이스맵 모두에서 AA를 만족하는 벡터 배색 |
| F-7 | **256px 고정 타일 주변 여백.** `.phase-tile-pair img`·`.compare-side-pair img`가 256px 고정이라 1920px에서 카드 오른쪽에 넓은 빈 공간이 남는다. **타일 크기는 규칙상 변경 불가(D-3)**이므로 카드·그리드 폭 쪽에서 풀어야 한다 | `07-evidence-1920.jpg` | 타일 카드의 폭·정렬·부가정보 배치안 |
| F-8 | **보고서 미리보기 잘림.** `.report-preview-doc { max-height: calc(100vh - 245px) }`로 문서가 중간에서 끊기고 우측 컬럼 아래에 빈 공간이 생긴다 | `styles.css` 648–649행 / `08-report-1920.jpg` | sticky 유지 여부 포함한 미리보기 높이 전략 |
| F-9 | **좁은 패널에서 표·칩 가독성.** `.comparison-table`·`.plan-station-table`이 `--fs-xs`(11–15px)에 `.table-scroll` 가로 스크롤 의존. `.agent-context-chip-text`는 `nowrap+ellipsis`라 "요천지구 · 3시간 강우 시나리오가 호…"처럼 잘린다 | `styles.css` 439, 1175, 1291행 / `04`, `06` 캡처 | 좁은 컬럼 전용 표·칩 표현(2줄 허용, 카드형 전환 등) |
| F-10 | **미사용 legacy CSS.** `.topbar`/`.top-field`, `.app-shell` 행 정의, `.bottom-workspace`/`.bottom-tabs`, `.satellite-grid`, `.timeline`, `.swipe-wrap`/`.swipe-image`/`.swipe-divider`, `.change-workspace`/`.change-toolbar`/`.segmented`, `.comparison-grid`/`.trace-grid`, `.map-key-notice`, `.global-notice`, `.empty-state`, `.quick-position`, `.chip.pending`이 현재 3페이지 마크업에 없다(`TopBar.tsx`는 `App.tsx`에서 import되지 않음) | `apps/web/src` 전수 grep | 새 시스템에서 제외할지 확인 (정리는 별도 태스크) |
| F-11 | **`body { min-width }` 중복 정의.** 94행 `1180px` → 199행 `320px`로 재정의. 후자가 유효하지만 상충 규칙이 남아 있다 | `styles.css` 94, 199행 | 320px 단일 기준으로 정리 |
| F-12 | **h1 포커스 링이 초기 화면에 보인다.** 캡처의 h1 주위 주황 외곽선은 dev의 React StrictMode 이중 effect로 `PageHeading`의 `isInitialLoadRef` 가드가 무력화된 것이다. 운영 빌드에서는 재현되지 않을 가능성이 높다 | `main.tsx` StrictMode / `PageHeading.tsx` 70–79행 / `01`,`02`,`03`,`08` 캡처 | 캡처 판독 시 참고 (디자인 결함 아님) |
| F-13 | **토큰화되지 않은 색이 많다.** `.priority-title span`(#c84b42), `.rank`, `.procedure-card`(#3b87bd), `.seed-badge`(#fff3d5/#664b06/#e6ca78), `.status-badge`, `.map-connection` 상태점 4색, `.agent-turn-notes.warnings`(#fff4d9/#e2c274) 등 | `styles.css` 전반 | B-2 표에 이 값들을 흡수하는 팔레트 제안 |

---

## 부록. 변경 후 실행할 검증

```bash
npm run typecheck:functions
python scripts/validate_vercel_repo.py
python scripts/validate_multi_page_a11y.py
python scripts/smoke_dashboard_console.py     # console error 0 / /api 요청 0
python scripts/smoke_evidence_console.py
python scripts/smoke_report_console.py
npm run test:e2e                              # tests/e2e/*.spec.ts
```

(Windows에서는 `python3` → `python`, `.sh`는 Git Bash로 실행한다.)
