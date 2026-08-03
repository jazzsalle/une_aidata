# Handoff: 재난안전 AI 시범서비스 — 시범 화면 UI 개선

## Overview
`apps/web`(React 19 + TS + Vite, OpenLayers/VWorld 2D) 3페이지 SPA의 시범 서비스 화면 디자인이다.
인계문서 30번의 미해결지점 **F-14(sticky offset) · F-15(피해 카드 열 배분) · F-16(초와이드 지도 밀도)**
해결안과 **타입 스케일 축소**(디자인 시스템 정렬), 그리고 **블루 계통 크롬** 적용을 포함한다.

## About the Design Files
번들의 `design_reference.dc.html`은 **디자인 레퍼런스(HTML 프로토타입)** 이다. 제품 코드로 그대로 복사하지 않는다.
목표는 이 화면의 **토큰 값과 컴포넌트 스펙을 `apps/web/src/styles.css`에 반영**하는 것이며,
인계문서 A-1의 원칙을 그대로 따른다.

- 반영하는 것: `:root` 토큰 값, 클래스 규칙의 색·여백·반경·그림자, 그리드 정의값, 미디어쿼리 동작
- 반영하지 않는 것: 새 클래스 체계, 유틸리티 클래스, 마크업 구조 변경, 완성 CSS 파일 덮어쓰기

**절대 깨지 않을 것** (인계문서 D-1 / D-2 / D-3 / D-4):
클래스명·ID·고정 문구, 단일 `h1`, 44px 터치타깃, `:focus-visible` 3px 링, 256×256 타일,
"미확보" 표기 규칙, 320px 가로 스크롤 0.

## Fidelity
**High-fidelity.** 색·타이포·간격·상태가 모두 확정값이다. 단 지도(OpenLayers 캔버스)와 위성 타일은
플레이스홀더이므로 실제 타일·벡터 스타일은 기존 어댑터를 유지한다.

## 1. 타입 스케일 (필수 · 우선 반영)
유동 clamp를 걷어내고 UNE 디자인 시스템 타입 토큰에 고정한다. rem 기반 유지 → WCAG 1.4.4 충족.

| 토큰 | 값 | 렌더 (1366·1920px) | ≥2400px | 용도 |
|---|---|---|---|---|
| `--fs-xs` | `.6875rem` / 17px | 11 / 17 | 11.7 | 배지·캡션·표 본문·단위 |
| `--fs-sm` | `.75rem` / 18px | 12 / 18 | 12.8 | 카드 본문·칩·탭·보조설명 |
| `--fs-md` | `.875rem` / 20px | 14 / 20 | 14.9 | 대화 본문·입력·기본 본문 |
| `--fs-lg` | `1rem` / 24px | 16 / 24 | 17 | 패널 h2·팝업 제목·금액 값 |
| `--fs-title` **(신규)** | `1.25rem` / 32px | 20 / 32 | 21.3 | 페이지 섹션 h2 |
| `--fs-xl` | `1.5rem` / 36px | 24 / 36 | 25.5 | 보고서 문서 제목 |

루트 배율: `≥1600px` / `≥2000px` 배율(106.25% · 112.5%)을 **삭제**하고 100%로 되돌린다.
`≥2400px`만 `106.25%`(=17px) 한 단계 유지.

```css
:root{ font-size:100% }
@media (min-width:2400px){ :root{ font-size:106.25% } }
```

자간 `-0.03em` 전 텍스트 적용, 굵기는 400 / 500 / 700만 사용(`750`/`800` 선언은 700으로 교체).
`.app-page-title`(h1)은 `--fs-md` + 700.

## 2. F-14 — sticky offset을 헤더 높이에서 파생
**원인**: 헤더 높이를 상수로 세 번 적어 실측 50–69px과 160/172/184px가 어긋났다.

```css
:root{
  --header-h: 3.125rem;                                  /* 50px, 헤더 실제 높이 */
  --sticky-gap: .5rem;
  --sticky-offset: calc(var(--header-h) + var(--sticky-gap));   /* 58px */
  --subnav-offset: calc(var(--header-h) + .25rem);              /* 54px */
  --report-preview-h: calc(100vh - var(--header-h) - 5.5rem);   /* F-8 상수 245px 대체 */
}
@media (max-width:900px){ :root{ --header-h:0px } }      /* 헤더 static */
```
- `≥1600 / 2000 / 2400px`의 `--sticky-offset` 오버라이드 **3줄 전부 삭제**.
- `.page-subnav`는 `top: var(--subnav-offset)` (기존 `calc(--sticky-offset - 16px)` 대체).
- `.report-outline` · `.report-preview`는 `top: var(--sticky-offset)`.
- `.report-preview-doc { max-height: var(--report-preview-h) }`.
- 런타임 실측이 필요하면 `AppHeader.tsx`가 ResizeObserver로 `--header-h`만 갱신한다(셀렉터·문구 변경 없음).

## 3. F-15 — 피해 카드 열은 데이터가 결정
`.damage-columns`의 고정 3열(`1.7fr 1fr 1fr`)을 제거하고 이력 유무로 열 수를 바꾼다.
클래스명은 유지하고 `data-history` 속성만 추가한다(`DamageRecoveryEvidence.tsx`에서 계산).

```css
.damage-columns[data-history="both"]     { grid-template-columns:minmax(0,1.7fr) minmax(0,1fr) minmax(0,1fr) }
.damage-columns[data-history="response"],
.damage-columns[data-history="recovery"] { grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) }
.damage-columns[data-history="none"]     { grid-template-columns:minmax(0,1fr) }
```
- `none`일 때 금액 카드 그리드(`auto-fit minmax(200px,1fr)`)가 남는 폭을 흡수한다.
- **"미확보" 문구는 삭제하지 않는다**(D-2). 빈 열 대신 카드 하단 **데이터 상태 줄**로 옮긴다:
  점선 1px `light-blue-100` 상자 + `대응 이력 미확보` / `복구 이력 미확보` 아웃라인 배지(11px).
- `recovery`만 없을 때는 footer 좌측에 `복구 이력 미확보 — 열을 만들지 않고 데이터 상태 줄로 표기한다` 문구.

## 4. F-16 — 2560px 초과 지도 밀도 tier B
```css
@media (min-width:2561px){
  :root{
    --map-max: 2400px;
    --left-panel-w:  clamp(340px,15vw,460px);
    --right-panel-w: clamp(400px,17vw,560px);
    --overlay-inset: 20px;        /* 12 → 20 */
    --map-poi-size: 28px;         /* 24 → 28 */
    --map-label-size: .8125rem;   /* 13 / 21 */
  }
  .dashboard-grid{ grid-template-columns:
    var(--left-panel-w) 26px minmax(420px,min(1fr,var(--map-max))) var(--right-panel-w) }
}
```
- 지도가 상한(2400px)에 닿은 뒤 남는 폭은 **우측 패널 → 좌측 패널** 순으로 흡수.
- 우측 패널 520px 초과 시 우선 확인지역 카드 목록 2열(`auto-fit minmax(320px,1fr)`).
- 라벨 최소 간격 40px, 충돌 시 우선순위 위험지구 > 하천 > 관측소. 클러스터 해제 zoom +1.
- 레이어 칩은 한 줄 유지(줄바꿈 금지), 10개 초과분은 `더보기` 메뉴로 접는다.
- 팝업은 오버레이가 없는 **우측**에 배치해 연결상태·레이어 칩을 덮지 않는다(F-5 동반 완화).
- 패널 본문 타이포는 14px 기준 유지 — tier B는 지도 안 요소에만 적용한다.

## 5. 블루 계통 크롬 (색 토큰)
UNE 디자인 시스템에 파랑 틴트 면·선 시맨틱 토큰이 없어 브랜드 프리미티브를 참조한다.
아래 4개를 신규 시맨틱으로 승격해 인계문서 B-2 표에 흡수하고, 하드코딩 색(F-13)도 함께 정리한다.

| 신규 토큰 | 값 | 매핑되는 기존 토큰 |
|---|---|---|
| `--surface-page-blue` | `#f5f8ff` (light-blue-20) | `--c-bg`, `--c-canvas` |
| `--surface-panel-blue` | `#eef3ff` (light-blue-25) | `--c-surface-alt` |
| `--border-panel-blue` | `#d2deff` (light-blue-75) | `--c-line` |
| `--border-inner-blue` | `#e3ebff` (light-blue-50) | `--c-line-soft` |
| 강조선 | `#8fabff` (light-blue-200) | `.plan-damage-list`, `.safety-note` 좌측선 |
| 지도 캔버스 | light-blue-50 | `.map-canvas` 기본 배경 |

패널 표면은 흰색(`--c-surface`) 유지 — 페이지 배경 1개 + 패널 표면 1개 원칙.
브랜드/액션은 `--c-brand` 계열 유지. **상태색(경고·오류·성공)은 파랑으로 바꾸지 않는다.**

### 대비(AA) 준수 — 반영 시 반드시 확인
| 조합 | 비율 |
|---|---|
| 노랑 안내문 글자 `#8a5600`(yellow-700) on `#fff7e0`(yellow-25) | 6.5:1 |
| 지도 자리표시 문구 `text-tertiary` on light-blue-50 | 4.72:1 |
| light-warning subtle 배지 → **warning solid로 교체** | 이전 2.86:1 → AA 통과 |

`--color-text-light-warning`(#cc8400)을 옅은 노랑 면 위 **11–12px 텍스트에 쓰지 않는다**.

## 6. 화면별 스펙

### 6-1. 공통 셸
- `.site-header`: 높이 `var(--header-h)` 50px, sticky top 0, z-index 20, `surface/primary`,
  하단 1px `--border-panel-blue`, 좌우 패딩 16px, 자식 간 gap 12px, `white-space:nowrap`.
- **헤더는 4개 항목만 남긴다**: 브랜드(+h1) · 지역 Select · `.global-nav` · `상황뷰 저장`.
  수축 경로는 **브랜드 블록의 h1 말줄임 하나뿐**이고(`flex:0 1 auto; min-width:0`),
  나머지는 `flex:0 0 auto`, 빈 `flex:1 1 auto` 스페이서가 내비를 오른쪽으로 밀어붙인다.
  → 헤더 intrinsic 폭 1107px → ~640px, 900px대에서 가로 스크롤 없음.
- **기준시각 · 모드 · 재난유형은 헤더에서 뺀다** — `<main>` 최상단 **컨텍스트 줄**로 옮긴다
  (`display:flex; flex-wrap:wrap; gap:8px 20px`). 헤더에 둘 때는 `overflow:hidden`이 값을 문자열 중간에서
  잘라 "2026-08-02 14" 같은 **틀린 시각**을 보여줬다. 값은 절대 부분 클리핑하지 않는다 —
  공간이 부족하면 항목 단위로 줄바꿈하거나 내린다.
- 브랜드: `재난안전 AI 시범서비스` 16px/700 + 1px×16px 구분선 + h1 14px/700 `--c-brand`.
- 컨텍스트 줄(`<main>` 최상단): 기준시각(11px 라벨 + 12px `tabular-nums`) · 모드 배지 · 재난유형 배지.
  라벨 11px `text-tertiary`.
- `.page-status`: `<main>` 최상단, 성공 테두리 + `green-20` 면, 12px/500, max-width 760px.
- 푸터: 11px `text-tertiary` 2문구, 상단 1px `--border-panel-blue`.

### 6-2. 대시보드 `/`
- `.dashboard-grid`: `clamp(240px,21vw,340px) 26px minmax(240px,1fr) clamp(292px,25vw,400px)`,
  gap 12px, 높이 660px. 페이지 최소 폭은 `1280px → 900px`.
  **지도 트랙을 넓혀 오버레이 충돌을 해결하지 않는다** — 그 방법은 우측 판단 패널 잘림을 다시 부른다.
- **지도 오버레이는 띄로 나눈다(F-5 확정안)** — 세 오버레이가 서로 다른 가로띄를 점유해
  지도 폭이 줄어도 겹치지 않는다.

  | 띄 | 요소 | 기하 |
  |---|---|---|
  | 상단 좌측 | 연결상태 필 | `left:12px; top:12px` · 고정 폭, 말줄임 금지 |
  | 상단 우측 | 베이스맵 전환 버튼 1개(`영상지도로`) | `right:12px; top:12px` |
  | 상단 우측(클릭 시) | 상세 팝업 | `right:12px; top:56px; width:clamp(220px,62%,300px)` |
  | 중단 | POI 핀 | 팝업 띄 아래 |
  | 좀하단 | 호버 요약 카드 | `left:12px; bottom:52px` |
  | 하단 | 레이어 칩 행 | `left:12px; right:12px; bottom:12px` · 아래 마지막 항목 참조 |

  팝업과 칩을 둘 다 하단에 걸면 좁은 지도에서 칩이 팝업 밑으로 깔린다.
- **좌측 패널 탭에 `badge`를 넣지 않는다** — DS `Tabs`는 `badge`를 라벨 문자열에 그대로 이어 붙여
  "AI Agent2"처럼 오퀈0로 읽힌다. 개수 표시가 필요하면 탭 밖에 `DotBadge`/`Badge`를 따로 둔다.
- **팝업 내부 그리드는 px 트랙을 쓰지 않는다**: 정의목록 `minmax(56px,auto) minmax(0,1fr)`,
  임계값 표 `minmax(0,1fr) minmax(44px,auto) minmax(44px,auto)`.
  고정 `100px` / `64px` 트랙은 % 폭 팝업 안에서 값 열을 32px로 무너뜨렸다.
- **좌측 패널(F-4 배분)**: 탭바(line, sm 32px) → `.agent-thread` `flex:1 1 auto; min-height:0`(스레드 우선)
  → 추천질문 `<details>`(summary 36px, 접힘 기본) → 컴포저 `flex:0 0 auto`.
  말풍선: user 우측 `interaction-primary-bg-default` + 흰 글자, assistant 좌측 `brand-subtle` + 브랜드 테두리,
  반경 12px(꼬리쪽 4px), 본문 14/20, 머리말·요약 11/17.
  `.agent-turn-confirm` 알약: `yellow-25` 면 + `light-warning` 테두리 + `yellow-700` 글자 11px, 반경 1000.
  입력 textarea `min-height:76px`, 전송 버튼 sm(36px).
- **추천질문 칩**(`.agent-suggestions` 내부): 사각 버튼 → **알약 칩**으로 변경.
  높이 28px, padding `5px 12px`, 반경 1000, 11px, `surface/primary` + 1px `--border-panel-blue`,
  `white-space:nowrap` + 컨테이너 `flex-wrap` 래핑(그리드 아님).
  hover: `interaction/primary/bg/subtle-hover` 면 + `border/brand` + `text/brand`.
- **참조 칩**(컴포저 상단, 선택 대상 표시): DS `InputChip`보다 한 단계 작은 **컴팩트 아웃라인 알약**.
  높이 22px, padding `0 6px 0 9px`, 반경 1000, 글자 **10 / 16**, 삭제 `✕` 버튼 14×14(반경 1000,
  hover 시 `light-blue-25` 면 + `text/brand`). 이 10px는 시스템 최소 크기(11px)보다 작은
  **의도적 예외**이며, 지워질 수 있는 임시 참조 토큰에만 허용한다. 다른 곳에 쓰지 않는다.
  삭제 버튼은 44px 터치타깃 예외 대상(밀집 데스크톱 컨트롤) — 모바일 폭에서는 28px 칩 / 24px ✕로 키운다.
- **지도 상호작용은 호버/클릭으로 나눈다** — 지도가 좁을 때 오버레이가 서로를 덮는 것을 막는 핵심 규칙.

  | 상호작용 | 결과 |
  |---|---|
  | POI 호버 / 포커스 | 요약 카드(지역명 + 주소 + 지표 1개) — 좌하단 고정 지점 |
  | POI 클릭 / 우측 카드 `상세보기` | 상세 팝업 열림(`detailOpen = true`) |
  | 팝업 `✕` | 닫기 |

  **상세 팝업의 기본값은 닫힘**이다. 항상 열어 두면 267px 폭 지도에서 팝업(220px)이
  POI·레이어 칩·요약 카드와 공존할 수 없다.
- **상세 팝업 박스 모델**: `height:auto; max-height:calc(100% - 80px)`, z-index 7, 반경 12px + e3, 닫기 44×44.
  고정 높이를 주지 않는다 — 200px를 주자 헤더 80 + 푸터 114가 먼저 먹고 스크롤 본문이 20px로 무너졌다.
  푸터에는 **36px CTA만** 둔다; 3줄짜리 면책문구는 스크롤 본문 끝으로 내린다.
- 팝업 내부 그리드는 px 트랙을 쓰지 않는다: 정의목록 `minmax(56px,auto) minmax(0,1fr)`,
  임계값 표 `minmax(0,1fr) minmax(44px,auto) minmax(44px,auto)`.
- 상단 오버레이에는 **연결상태 필**(좌)과 **베이스맵 전환 버튼 1개**(우)만 둔다.
  일반지도/영상지도 2개 버튼(135px)을 쓰면 필(152px)과 한 띄에 들어가지 않아
  부족분이 전부 필 문구에서 빠져 면책문구 반짝이 사라진다(D-2 위반). 현재 상태가 아니라
  **전환할 대상**을 라벨로 쓴다 — `영상지도로` ↔ `일반지도로`(2xs 28px outline).
- **레이어 칩 행은 하나의 flex 행**이다 — 오버레이 둘을 각각 띄우고 `max-width`에서
  고정 px를 뺀 것이 칩이 1개만 남게 된 원인이다(고정 px 빼기는 컨테이너 폭을 따라가지 않는다).
  구조: 칩 영역 `flex:1 1 auto; min-width:0; overflow:hidden`, 개수 버튼 `flex:0 0 auto`.
  개수 버튼(`레이어 5`)는 **클리핑 영역 밖에** 두어 절대 가려지지 않게 한다 —
  숨겨진 칩을 대변하는 컴트롤이 자기도 숨으면 사용자는 단서가 없다.
- **POI 마커**: Figma `location_icon`(38×48.857 프레임, 핀 `rgb(45,86,247)`, 흰 원 `cx19 cy18.857 r11`).
  기본 20×25.7, 선택 상태 28×36, `tabindex="0"`, `cursor:pointer`.
  **상시 라벨을 붙이지 않는다** — 지역명은 호버 카드가 맡는다(상시 라벨은 좁은 지도에서 서로와 팝업을 침범한다).
  원본이 BOOLEAN_OPERATION이라 지오메트리가 추출되지 않는다 — 치수·색은 원본 값이고 경로만
  재구성한 것이므로 운영 반영 시 디자이너가 export한 SVG로 교체한다.
- **POI 호버 요약 카드**(신규 · Figma `관리자_팝업창` 스타일): 폭 220px, 반경 4,
  본문면 `rgb(18,15,74)` + `inset 0 0 0 1px rgb(8,6,40)`, 하단 바 40px `rgb(22,20,63)` 동일 inset,
  지역명 14/20 Bold `#fff`, 주소 13/19 `rgb(150,147,193)`,
  하단 바 = 라벨 13 `rgb(150,147,193)` + 값 13 Bold `#fff`.
  **핀을 따라다니지 않고 지도 좌하단 고정 지점**(`left:12px; bottom:52px`, 레이어 칩 바로 위)에 뜬다 —
  핀에 붙이면 좁은 지도에서 카드가 지도 밖으로 잘린다. z-index 6, `pointer-events:none`.
  이 다크 네이비 색은 UNE 토큰이 아니라 **지도 오버레이 전용 예외**이다 — 패널 UI로 확산시키지 않는다.
- **우측 패널**: 탭바 4개(line sm) → 경고 AlertBanner → 우선 확인지역 카드
  (`32px 1fr` 그리드, 순위 원형 28px, 지역명 14/700 밑줄, 점수 14/700 `text-error`,
  태그 배지 20px, 위치 11px, 카드 하단 `상세보기` / `질의에 참조` 28px 버튼).
  카드 좌상단 32px 영역에는 새 컨트롤을 넣지 않는다(스모크 S7/S8가 그 좌표를 클릭한다).

### 6-3. 근거 `/evidence`
- `.page-subnav` sticky `var(--subnav-offset)`.
- 섹션 제목 `--fs-title` 20/32. 카드 반경 12px, 헤더 `brand-subtle` + 1px `--border-inner-blue`.
- 금액 카드: 좌측 4px 브랜드선, 라벨 11px, 값 16/700 `tabular-nums`, 원값(천원) 11px 병기.
- 3장의 카드가 F-15의 `both` / `response` / `none` 세 상태를 그대로 보여준다.
- 하단 `.safety-note`: 좌측 4px `light-blue-200`, 11/17.

### 6-4. 보고서 `/report`
- `.report-layout`: `clamp(196px,13.5vw,300px) minmax(260px,1.15fr) minmax(260px,.95fr)`, gap 12px.
- 목차·미리보기 sticky `var(--sticky-offset)`, 미리보기 본문 `max-height: var(--report-preview-h)`.
- 문서 제목 `--fs-xl` 24/36 + 하단 2px 선, 대제목 16/24, 문단 14px `line-height:1.7`.

## Interactions & Behavior
- 화면 전환: 헤더 내비(Tabs line) → 라우트 이동, h1 텍스트·`document.title` 교체(`PageHeading.tsx` 유지).
- 좌/우 패널 탭: `aria-selected` + 패널 id(`#situation-panel-*`, `#insight-panel-0..3`) 유지.
- hover는 해당 램프의 `-hover` 단계, press는 `-active` 단계 — transform·opacity 사용 금지.
- 포커스: `:focus-visible` 3px `--c-focus` + offset 3px 유지(컨테이너 내부는 `-3px`).
- 모션: 색·그림자 전환 120ms `cubic-bezier(.2,0,.2,1)`, `prefers-reduced-motion`에서 `.01ms`.

## State Management
기존 상태 그대로. 이번 변경으로 추가되는 파생값은 하나뿐이다 —
피해 카드별 `data-history`(`both | response | recovery | none`) = 대응·복구 이력 배열 길이로 계산.

## 7. 헤더 축소 규칙 (회귀 주의)
1280px에서 헤더가 넘치는 회귀가 두 번 있었다. 원인과 확정 규칙:

- 컨텍스트 묶음(지역·기준시각·모드·재난유형)을 `flex:1 1 auto`로 두면 그 묶음이 부족분을 흡수해
  배지가 잘리고, 반대로 브랜드 블록을 `0 0 auto`로 고정하면 내비를 침범한다.
- **확정**: 브랜드 블록만 `flex:1 1 auto; min-width:120px`이고 그 안의 `h1`만 말줄임한다.
  컨텍스트 묶음 · `.global-nav` · `상황뷰 저장`은 전부 `flex:0 0 auto`.
- 축소 예산 확보: 헤더 좌우 패딩 24 → **16px**, 자식 gap 16 → **12px**, 지역 Select 148 → **132px**.
- 검증: 1280px · 최장 h1(`설계 결정 · 미해결지점 해결안`)에서 헤더 높이 50px 유지,
  컨텍스트 묶음 폭 온전, 우측 끝이 뷰포트 안.

## Files
- `design_reference.dc.html` — 4개 화면(상황판 / 근거 / 보고서 / 설계 결정) 디자인 레퍼런스.
  마지막 "설계 결정" 화면에 타입 스케일 비교표, 블루 크롬 토큰 승격안, F-14/15/16 스펙이
  화면으로 정리돼 있다.
  브라우저로 바로 열 수 있고, 상단 내비로 화면을 전환한다.
- `30_design_system_handoff.md` — 원본 인계문서(제약·검증 셀렉터·고정 문구의 근거).

## 반영 후 검증
```bash
npm run typecheck:functions
python scripts/validate_multi_page_a11y.py
python scripts/smoke_dashboard_console.py
python scripts/smoke_evidence_console.py
python scripts/smoke_report_console.py
npm run test:e2e
```
공통 PASS 조건: console error 0 · pageerror 0 · `/api` 요청 0(FORCE_SEED).
