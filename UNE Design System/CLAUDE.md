# CLAUDE.md — 프로젝트 핸드오프

Claude Code CLI가 이 프로젝트의 디자인 파일을 **직접 수정**할 때 반드시 먼저 읽는 문서다.
여기 적힌 규칙을 벗어난 코드는 미리보기에서 깨지거나, 디자인 시스템 검사에 걸린다.

---

## 1. 프로젝트 구조

```
CLAUDE.md                  ← 이 문서
*.dc.html                  ← 디자인 파일 (Design Component). 실제 작업 대상
support.js                 ← DC 런타임. 자동 생성 파일 — 절대 수정/삭제 금지
_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/
  _ds_bundle.js            ← 컴포넌트 번들 (window.UNEDesignSystem_bbd5ec)
  _ds_manifest.json        ← 컴포넌트 목록 + props 스펙
  styles.css               ← 전체 스타일 진입점
  tokens/*.css             ← 토큰 (colors / typography / spacing / elevation / motion / base / fig-tokens)
  components/**/*.jsx      ← 컴포넌트 소스 + .d.ts + .prompt.md
  readme.md                ← 디자인 시스템 전체 가이드 (판단이 애매하면 여기부터 읽을 것)
```

디자인 파일이 아직 없다면 `.dc.html`을 새로 만들어 작업한다.

---

## 2. 디자인 파일 형식 — Design Component (`.dc.html`)

`Name.dc.html` 한 파일이 곧 하나의 디자인이다. 브라우저에서 바로 열린다.
파일은 세 부분으로 구성된다.

```html
<!DOCTYPE html>
<html>
<head>… <script src="support.js"></script> …</head>
<body>
  <x-dc>
    <!-- ① 템플릿: 마크업 -->
  </x-dc>
  <script data-dc-script data-props='{ … ③ props 메타데이터 … }'>
    class Component extends DCLogic {   /* ② 로직 */ }
  </script>
</body>
</html>
```

### ① 템플릿 규칙

- **`{{ path }}` 구멍은 점 표기 경로만** 허용된다. `{{ user.name }}`, `{{ $index }}` OK.
  `{{ a + b }}`, `{{ !x }}`, `{{ fn() }}` 는 **조용히 실패**한다 → 계산은 전부 `renderVals()`에서.
- 속성: `x="literal"` 문자열 / `x="{{ path }}"` 원시값 / `x="a {{p}} b"` 보간.
  이벤트는 JSX 카멜케이스 (`onClick="{{ handler }}"`). `class`/`for`는 자동 매핑.
- 반복·분기는 전용 태그를 쓰고 `hint-*`를 반드시 채운다 (스트리밍 중 플레이스홀더가 된다):
  ```html
  <sc-for list="{{ items }}" as="item" hint-placeholder-count="3">
    <div>{{ item.name }}</div>   <!-- $index 사용 가능 -->
  </sc-for>
  <sc-if value="{{ hasItems }}" hint-placeholder-val="{{ true }}">…</sc-if>
  ```
- **스타일은 인라인만.** CSS 클래스·스타일시트 금지. 의사상태는
  `style-hover` / `style-active` / `style-focus` / `style-before` / `style-after` 속성으로 쓴다.
  (디자인 시스템이 제공하는 `.une-*` 클래스는 예외 — 그건 써도 된다.)
- `<helmet>…</helmet>`은 템플릿 **맨 위**. `@font-face`, `@keyframes`, body reset, `<link>`, `<script src>`만 넣는다.
  템플릿 본문에 `<script>`를 넣으면 안 된다.
- 닫는 태그는 항상 명시. `<x-import …>` / `<dc-import …>`를 self-close 하지 말 것.

### ② 로직 규칙

```js
class Component extends DCLogic {
  state = { open: false };
  renderVals() {
    return {
      open: this.state.open,
      toggle: () => this.setState(s => ({ open: !s.open })),
    };
  }
}
```

- 순수 JS (TypeScript·import/export 없음). 클래스 이름은 반드시 `Component`.
- `React`와 `DCLogic`은 주입된다. `render()`는 없고 `renderVals()`가 템플릿 입력을 반환한다.
- **레이아웃을 `React.createElement`로 만들지 말 것.** 그렇게 만든 UI는 에디터에서 클릭·편집이 불가능하다.
  마크업은 템플릿에, 삼항·map·비교 같은 계산만 로직에.

### ③ props 메타데이터 (`data-props`)

```json
{
  "$preview": { "width": 1440, "height": 900 },
  "theme":   { "editor": "enum", "options": ["light","dark"], "default": "light", "tsType": "string" },
  "density": { "editor": "range", "min": 0, "max": 2, "step": 1, "default": 1, "tsType": "number" }
}
```

editor 값: `text | color | int | float | range | boolean | enum | null`.
`default`는 에디터 초기값일 뿐이므로 런타임 폴백은 `this.props.x ?? 기본값`으로 직접 처리한다.
텍스트·단색은 에디터에서 직접 수정 가능하므로 tweak으로 만들지 않는다 — 동작·변형·전역 플래그에만 쓴다.

### 파일 분할

기본은 **한 파일**. 반복 요소는 `<sc-for>`로 처리한다.
같은 요소가 화면 전반에 4번 이상 반복되고 실제 props/state가 있을 때만 자식 DC로 분리하고,
`<dc-import name="Card" item="{{ it }}" hint-size="100%,120px"></dc-import>`로 마운트한다.

---

## 3. 디자인 시스템 — UNE Design System

**모든 DC의 `<helmet>` 맨 위에 아래 블록을 넣는다.** (URL 기준 중복 제거되므로 자식 DC에도 그대로 넣는다.)

```html
<helmet>
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/tokens/fonts.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/tokens/fig-tokens.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/tokens/colors.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/tokens/typography.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/tokens/spacing.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/tokens/elevation.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/tokens/motion.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/tokens/base.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/components/actions/actions.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/components/forms/forms.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/components/data-display/data-display.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/components/navigation/navigation.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/components/feedback/feedback.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/components/overlay/overlay.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/components/layout/layout.css">
  <link rel="stylesheet" href="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/styles.css">
  <script src="_ds/une-design-system-bbd5ec43-f21a-4140-bff6-c1fb616b6bb1/_ds_bundle.js"></script>
</helmet>
```

컴포넌트 마운트 (로직 클래스 필요 없음):

```html
<x-import component-from-global-scope="UNEDesignSystem_bbd5ec.Button"
          size="md" variant="primary" hint-size="auto,40px">저장</x-import>
```

props는 템플릿 속성 (kebab → camelCase), 자식은 `props.children`으로 전달된다.
정확한 props는 `_ds_manifest.json` 또는 `components/**/<Name>.d.ts` / `<Name>.prompt.md`를 확인한다.

### 사용 가능한 컴포넌트 (72개)

- **Actions** — Button, IconButton, TextButton
- **Forms** — Input, Textarea, Select, Checkbox, Radio, Switch, SegmentedControl, Segment, Datepicker, DatepickerDay, Upload, UploadList, Filter
- **Data display** — Table, TableHeaderCell, TableBodyCell, TableRow, TableBody, TableFooter, ListItem, Card, CardHeader, CardBody, CardFooter, Accordion, AccordionHeader, Badge, DotBadge, InputChip, FilterChip, ChoiceChip, ActionChip
- **Navigation** — Tabs, Tab, TabLine, Breadcrumb, BreadcrumbItem, BreadcrumbSeparator, Pagination, PaginationButton, Tree, TreeNode, LNB, LnbItem, LnbGroup
- **Feedback** — Tooltip, Toast, ToastRegion, Alert, AlertBanner, Spinner, LoadingOverlay, EmptyState
- **Overlay** — Modal, ModalHeader, ModalFooter, Confirm, Nonmodal, Menu, MenuItem, MenuSection, MenuDivider, Droplist, DroplistItem
- **Layout** — Header, Shell, PageHead, Panel, Timepicker
- **Foundation** — Icon (248 글리프)

이 목록에 **없는 것은 시스템에 없다** — Avatar, Progress, Slider, Skeleton, Popover, Drawer, Stepper는 존재하지 않는다.
필요하면 새로 만들지 말고 기존 컴포넌트 조합으로 해결하거나 사용자에게 물어본다.

`Table` / `Tabs` / `Menu` / `Droplist` / `Pagination` / `Tree` / `LNB` / `SegmentedControl`은
일반적인 경우 **배열을 props로 넘긴다**. 행 안에 커스텀 마크업이 필요할 때만 부품 컴포넌트(`TableRow`, `Tab`, `MenuItem` …)를 쓴다.

---

## 4. 디자인 규칙 (어기면 안 되는 것)

1. **원시 색상 직접 참조 금지.** `var(--color-text-primary)` O / `var(--color-grayscale-900)` X / 하드코딩 hex X.
2. **상태 색은 interaction ramp에서 나온다.** hover 색을 직접 고르는 순간 틀린 것이다.
   `interaction/{primary|secondary}/{bg|border|text|icon}/{default|hover|active|disabled}`.
   - hover = 현재 ramp의 `-hover` 단계. opacity·filter 금지.
   - press(active) = `-active` 단계. **transform·scale·bounce 절대 없음.**
   - focus-visible = `box-shadow: var(--une-focus-ring)`. outline·border 변경 아님 (레이아웃이 밀리면 안 되므로).
   - disabled = `-disabled` 토큰 + `cursor: not-allowed`. opacity 낮추기 금지.
3. **밀도를 유지한다.** 본문 14px, 테이블 12px, 컨트롤 40px, 기본 gap 8px. "가독성을 위해" 키우지 말 것.
4. **letter-spacing은 모든 텍스트에 −3% (`-0.03em`).** 예외 없음.
5. **elevation은 지정된 컴포넌트에만.** e1 Switch·Segment·Tree / e3 Menu·Modal·Tooltip·Toast·Nonmodal·elevated Card / e4 Droplist·Datepicker / e6 Alert. 그 외에는 그림자 없음.
6. **배경은 단색.** 그라데이션·사진·일러스트·텍스처·패턴·backdrop-blur 전부 금지.
   이미지가 필요하면 실제 제품 콘텐츠(카메라 화면, 도면, 업로드된 사진)여야 한다.
7. **한국어 카피, 짧은 라벨(2~5자), 고정된 상태 어휘, 이모지 절대 금지.**
   기기 상태: 정상 / 주의 / 심각 / 점검 필요 · 피드백: 정보 / 성공 / 경고 / 오류 · 신고: 자동 / 수동.
   문장형 버튼 라벨 금지. 라벨이 길어지면 줄바꿈이 아니라 말줄임(…).
   문체: 3인칭·비인칭. 라벨은 명사(`설비명`), 지시는 `입력하세요`, 설명은 `…이다`. 해요체 없음.

### 토큰 빠른 참조

| 항목 | 값 |
| --- | --- |
| Typography | title-lg 32/48 · title-md 24/36 · title-sm 20/32 · body-lg 16/24 · body-md 14/20 · body-sm 12/18 (+ `--une-label-size` 11/17, `--une-note-size` 13/21) |
| Font | Spoqa Han Sans Neo 400/500/700. 타이틀 Bold, 본문 Regular, 컨트롤 라벨 Medium |
| Spacing | `--une-space-{2,4,6,8,12,16,20,24,28,32,36,40,44,48,60,64,76,80,96}` · gap/pad `2xs 4 · xs 8 · sm 12 · md 16 · lg 20 · xl 24 · 2xl 32` |
| Radius | `--une-radius-` none 0 · xs 2 · sm 4 · md 8 · lg 12 · xl 16 · max 1000. **36px 미만 컨트롤 4, 36px 이상 8, 컨테이너 12, pill 1000** |
| Control height | `--une-control-` 4xs 20 · 3xs 24 · 2xs 28 · xs 32 · sm 36 · md 40 · lg 44 · xl 48 · 2xl 52 · 3xl 56 |
| Icon size | `--une-icon-` sm 12 · md 16 · lg 20 · xl 24 · 2xl 28 · 3xl 32 · 4xl 36 · 5xl 40 |
| Border | 항상 1px, `--color-border-{subtle,default,muted,strong,gray,brand,error,warning,success}` |
| Motion | 상태 변화 120ms, Switch thumb·chevron 160ms, `cubic-bezier(0.2,0,0.2,1)`, Spinner 800ms linear. **그 외에는 아무것도 움직이지 않는다** |
| Theme | light = `:root` / dark = `:root[data-theme="dark"]` 또는 `.dark` / `:root[data-mode="high-contrast"]` |

### 레이아웃 기본값

Header 50px 고정 상단 · LNB 240px(아이콘 레일 56px) 고정 좌측 · 콘텐츠 영역만 스크롤(`.une-scroll` 클래스) ·
콘텐츠 패딩 세로 20px / 가로 24px · 페이지 타이틀 24/36 Bold · 데스크톱 웹 ~1440px 기준.

### 아이콘

`assets/icons/`의 248개 글리프. 24×24 프레임, `currentColor`로 칠해지므로 `--color-icon-*`로 색을 바꾼다.
`-line`은 기본 상태, `-fill`은 활성/선택 상태 (LNB 선택 시 글리프 교체, Toast/Alert/Confirm은 항상 `-fill`).
이모지·유니코드 문자를 아이콘으로 쓰지 않는다.

```html
<x-import component-from-global-scope="UNEDesignSystem_bbd5ec.Icon"
          name="cctv-line" size="24" hint-size="24px,24px"></x-import>
```

---

## 5. 작업 절차

1. 수정 대상 `.dc.html`을 읽고 기존 시각 어휘(색·간격·카피 톤·상태 처리)를 먼저 파악한다.
2. **작은 수정 요청은 그 부분만 고친다.** 요청하지 않은 레이아웃·폰트·색·간격을 "개선"하지 않는다.
3. 큰 개편은 원본을 복사해 새 파일(`Name v2.dc.html`)에서 작업해 이전 버전을 보존한다.
4. 판단이 애매하면 `_ds/.../readme.md`와 해당 컴포넌트의 `.prompt.md`를 읽는다. 추측하지 않는다.
5. 브라우저에서 `.dc.html`을 직접 열어 콘솔 에러 없이 렌더되는지 확인한다.

## 6. 자주 하는 실수

- `b_dc_html` 안에 `<!DOCTYPE>`·`<html>`·`<x-dc>`·`<script>`를 다시 넣는 것 → 문서 중첩
- 템플릿 구멍에 JS 표현식 → 조용히 빈 값
- 정적 스타일/텍스트를 `{{ }}`로 빼는 것 → 스트리밍 중 화면이 늦게 그려진다. 리터럴로 쓸 것
- `<Card />` 같은 대문자 태그 → 지원 안 함. `<dc-import name="Card">`
- `hint-size` 누락 → 로딩 중 레이아웃 붕괴
- `support.js` 수정 → 자동 생성 파일이라 덮어써진다
