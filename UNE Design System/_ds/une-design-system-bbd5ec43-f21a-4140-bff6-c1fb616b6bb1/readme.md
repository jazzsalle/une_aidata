# UNE Design System

A design system extracted from **`Design System_New v1.0.0.fig`** — a Korean-language,
enterprise **industrial-safety and integrated control-room (통합관제) platform** design kit,
versioned V 1.0.0 and QA'd through 2026-07-22.

Everything in this project is transcribed from that file. Nothing is invented: token values,
component geometry, state ramps, elevation steps and the 248-glyph icon set all come from the
source, and where the source is silent this readme says so.

---

## Sources

| Source | Detail |
| --- | --- |
| Figma file | `Design System_New v1.0.0.fig` — attached to this project as a read-only virtual filesystem. **No shareable Figma URL was provided**, so the file itself is the only reference; keep a copy alongside this project. |
| Codebase / repo | None provided. |
| Decks / docs | None provided. |

The file is organised as one Figma page per component family (Foundation, Color, Typography,
Elevation, Icon, Logo, Image, Scrollbar, then Action / Data-Input / Data-Display / Navigation /
Feedback / Overlay / Layout groups). Most pages carry a
**`📋 <Component> — QA Report & Dev Spec (2026-07-22)`** frame written by the file's authors — those
frames are the authoritative numeric specs and are the primary source for this system's CSS.

### What the product is

The file's own sample content describes a facility monitoring and safety product:

- **관제 / Control** — live monitoring, CCTV and 360° cameras, thermal imaging, sirens, dashboards.
- **알람 유형 / Alarm types** — 화재 (fire), 가스 (gas), 누출 (leak), 홍수 (flood), 악취 (odour),
  대기오염 (air pollution), 수질 (water quality), 비상벨 (emergency bell), 미승인 출입.
- **도면 · 3D 저작 / Drawing & 3D authoring** — floor plans, wall/floor drawing, columns, stairs,
  escalators, elevators, ramps, layers.
- **산업 안전 / Industrial safety** — worker tracking, access control, inspections, injury reports,
  education records.

There is no marketing site, mobile app or docs site in the file. **One product surface is
represented**: a desktop web application, ~1440px wide, dense, light-first with a full dark theme.

### No logo in the source

The file's `Logo` page contains **file-format glyphs** (jpeg / png / …), not a brand mark, and the
Header dev spec notes only that "로고는 다색 브랜드 그래픽" — a multi-colour brand graphic that stays raw
and untokenised. **No logo asset exists in the file, so none was created.** Wherever a mark would go,
the system renders the product name in type (see `Header`: a 32px glyph from the icon set + the
16px bold system name). Do not substitute an invented mark.

### Font substitutions

| Family | Uses in file | Status |
| --- | --- | --- |
| **Spoqa Han Sans Neo** | 6,088 (Regular / Medium / Bold) | Loaded from the official jsDelivr build. Correct family, correct weights. |
| **Pretendard GOV** | 10 — Foundation documentation frames only | **SUBSTITUTED.** The government build is not publicly distributed; aliased to `local('Pretendard GOV')` → `local('Pretendard')` → the Pretendard CDN variable font. |
| **Noto Sans KR** | 68 — a few legacy frames | Declared as a fallback family only; served by CDN if present. |
| **Inter** | 10 — stray placeholder text | Not carried over. |

**→ If you have the licensed `Spoqa Han Sans Neo` and `Pretendard GOV` binaries, drop them into
`assets/fonts/` and point `tokens/fonts.css` at them.** That is the one substitution to close.

---

## Content fundamentals

The file is written in **Korean**, with English reserved for token names, size labels and component
names. Copy is functional and unadorned — this is a product operators read while something is on fire.

**Voice.** Third-person and impersonal. The UI states facts and names objects; it does not address
the user as "you" and does not speak as "we". The only first/second-person construction in the whole
file is the header greeting **"홍길동 님 환영합니다"**.

**Register.** 해요체 is absent. Labels are bare nouns (`설비명`, `최근 점검`, `신고방식`); instructions
use the plain polite imperative (`입력하세요`, `파일을 끌어다 놓으세요`, `다른 키워드로 다시 검색해 보세요`);
descriptions use the declarative 한다 form (`…정의한다`, `…부여하는 중요한 개념이다`).

**Labels are short — usually 2–5 characters.** `저장`, `취소`, `삭제`, `등록`, `초기화`, `더보기`,
`전체 보기`, `현장 확인`. Button labels never form a sentence. When a label could grow, it truncates
with an ellipsis rather than wrapping — the Button and Chip QA reports both make this an explicit rule
(`truncation ENDING + layoutSizing FILL`).

**Status wording is a fixed vocabulary.** 정상 / 주의 / 심각 / 점검 필요 for device state;
정보 / 성공 / 경고 / 오류 for feedback intent; 자동 / 수동 for how an event was reported.
Reuse these words rather than inventing synonyms.

**Numbers carry units in a lighter colour.** `126 / 132`, `41명`, `3건`, `200mm` — the unit is
`text/tertiary` at 12px next to a 24px `text/primary` value.

**Casing.** Korean has no case, and the file does not upper-case its Latin fragments either: token
names are lower-case kebab (`color/text/primary`), size labels are lower-case (`md(40)`, `3xl`), and
product acronyms stay as-is (`CCTV`, `IoT`, `LNB`, `AI`, `3D`).

**No emoji anywhere in the product UI.** The only emoji in the file is the 📋 clipboard on the
authors' internal QA frame titles. Never put emoji in a UI built with this system.

**Vibe.** Calm, exact, slightly clinical. The file's own documentation prose is the tell — it explains
*why* a decision was made, in full sentences, with dates and attributions
("결정: 그림자는 변수화하지 않고 이펙트 스타일 유지"). Write UI copy that respects an operator's attention:
name the thing, state its state, offer the action.

---

## Visual foundations

### Colour

Nine primitive ramps, each with **14 stops** — `20 · 25 · 50 · 75 · 100 · 150 · 200 · 300 · 400 · 500 ·
600 · 700 · 800 · 900` (grayscale adds an `850`). `20` and `25` are near-white tints; `500` is the
nominal base.

| Ramp | Role | Base |
| --- | --- | --- |
| `light-blue` | brand / interactive (light theme) | `500` = `rgb(60,105,252)` |
| `dark-blue` | brand / interactive (dark theme) | `300` = `rgb(71,125,255)` |
| `grayscale` | neutral, text, borders | `700` = `rgb(68,74,87)` — the single most-used colour in the file |
| `red` | error | `500` = `rgb(217,45,32)` |
| `orange` | warning | `500` = `rgb(252,107,25)` |
| `green` | success | `500` = `rgb(29,121,43)` |
| `yellow` | "light-warning" | `400` = `rgb(232,154,0)` |
| `teal` | accent — unmapped to semantics | `500` = `rgb(8,187,174)` |
| `purple` | accent — unmapped to semantics | `500` = `rgb(152,94,255)` |

**Nothing in a design should reference a primitive directly.** Every component reads a semantic
token: `--color-text-*`, `--color-surface-*`, `--color-bg-*`, `--color-border-*`, `--color-icon-*`,
`--field-*`, and above all the **interaction ramps**:

```
interaction/{primary|secondary}/{bg|border|text|icon}/{default|hover|active|disabled}
  · bg also has  -strong-disabled, -medium-*, -muted-*, -subtle-*
```

The four fill weights matter: `bg/default` (solid Button, Switch on, selected day),
`bg/medium`, `bg/muted` (selected chips), `bg/subtle` (selected table rows, LNB items, Tree nodes).
A hover colour is never hand-picked — it is the `-hover` step of the ramp you are already on.

**Themes.** Light is `:root`. Dark is `:root[data-theme="dark"]` or `.dark` and swaps the brand ramp
from `light-blue` to `dark-blue` and inverts the neutrals. A third mode,
`:root[data-mode="high-contrast"]`, raises text and divider contrast only — it is an overlay, not a
full theme. There is also `:root[data-mode="mobile"]`, which changes exactly one token
(`--font-size-heading-medium` 24 → 22).

**Palette discipline:** one page background (`bg/subtle`) plus one panel surface (`surface/primary`).
That is the whole chrome. Colour beyond that means *state*.

### Type

**Spoqa Han Sans Neo**, three weights (400 / 500 / 700), with **letter-spacing −3% (`-0.03em`) at
every size** — this is the single most characteristic type decision in the file and it is applied
without exception.

| Token | Size / line |
| --- | --- |
| `typo-title-lg` | 32 / 48 |
| `typo-title-md` | 24 / 36 |
| `typo-title-sm` | 20 / 32 |
| `typo-body-lg` | 16 / 24 |
| `typo-body-md` | 14 / 20 |
| `typo-body-sm` | 12 / 18 |

Titles are always Bold. Body is Regular; Medium is for control labels (buttons, tabs, chips, LNB).
Beyond the token scale the file uses three real one-offs in dense UI, carried here as
`--une-label-size` **11/17**, `--une-note-size` **13/21**, and 15px for documentation table heads.

**14px is the workhorse** (1,347 instances) and 12px is close behind (1,062) — this is a
small-type, high-density system. Do not scale it up "for readability"; the density is the design.

`Pretendard GOV` appears only on Foundation documentation frames. Never use it in product UI.

### Spacing, radii, sizing

Spacing: `2 4 6 8 12 16 20 24 28 32 36 40 44 48 60 64 76 80 96`. Semantic gap/padding ramp
`2xs 4 · xs 8 · sm 12 · md 16 · lg 20 · xl 24 · 2xl 32` — the same ramp serves `gap`,
`padding-h` and `padding-v`, which is why the layouts feel square.

Radii: `none 0 · xs 2 · sm 4 · md 8 · lg 12 · xl 16 · max 1000`. The pattern is consistent and
worth internalising: **controls under 36px tall get radius 4; 36px and up get radius 8; containers
(Card, Modal, Alert, Nonmodal, Menu, Datepicker) get 12; pills (Chip, Switch, Badge cylinder) get
1000.** Radius 16 exists but is barely used.

Controls share **one 10-step height ramp**: `4xs 20 · 3xs 24 · 2xs 28 · xs 32 · sm 36 · md 40 ·
lg 44 · xl 48 · 2xl 52 · 3xl 56`. Icons share their own: `12 16 20 24 28 32 36 40`.

### Elevation

Eight steps, each a **two-layer shadow** — a key shadow plus an ambient shadow — with opacity ramping
0.11 → 0.40 as blur and y-offset grow:

```
e1  0 4px 11px  .11  +  0 0 3px .04      e5  0 10px 24px .24  +  0 0 5px .08
e2  0 6px 13px  .13  +  0 0 3px .04      e6  0 10px 32px .32  +  0 0 7px .08
e3  0 8px 15px  .15  +  0 0 5px .06      e7  0 12px 36px .36  +  0 0 7px .10
e4  0 10px 17px .18  +  0 0 5px .06      e8  0 12px 40px .40  +  0 0 7px .10
```

**Shadows are identical in light and dark.** Dark elevation is expressed with *surface colour*
(`surface/primary` vs `surface/raised`) plus the same shadow, plus a `border/subtle` where needed —
not with a heavier shadow. The authors documented this explicitly, along with their decision to keep
shadows as Figma *effect styles* rather than variables (a shadow is a composite value Figma variables
cannot hold).

**The usage map is fixed — arbitrary shadows are forbidden:**
`e1` Switch · Segment · Tree · `e3` Menu · Modal · Tooltip · Toast · Nonmodal · elevated Card ·
`e4` Droplist · Datepicker · `e6` Alert. Steps 2, 5, 7, 8 exist for the ramp but are barely used.

### States, hover and press

Every interactive component has the same five-state contract: **default → hover → active →
focus-visible → disabled**. Each state is a token, not an effect:

- **Hover** = the `-hover` step of the current ramp. On neutral surfaces that means a faint tinted
  fill appears (`secondary/bg/subtle-hover`); on filled controls the fill goes one step deeper.
  Never opacity, never a filter.
- **Press (active)** = the `-active` step — a *deeper* colour, not a transform. **Nothing scales,
  shrinks or lifts on press.** There is no bounce anywhere in this system.
- **Focus-visible** = `box-shadow: 0 0 0 2px var(--color-focus-visible-ring)`. Explicitly a
  box-shadow, not an `outline` and not a border change, so geometry never shifts. Some components
  (Table header cell, Tree node) also switch their background to `focus-visible/surface`.
- **Disabled** = the `-disabled` tokens plus `cursor: not-allowed`. Never reduced opacity.

Four components extend the ramp: fields add `focus`, `complete` and `error` (7 states); Tree adds
`dragging` and `editing`; Table header cells add a sort dimension; Chips support
`disabled + selected` (locked but still visibly chosen).

### Animation

**The source file defines no motion tokens and no prototype easing** — interaction is expressed
purely as discrete state tokens. That silence is itself the direction: this is a system where things
change colour, not position.

`tokens/motion.css` therefore holds conservative house values (`120ms` for state changes,
`160ms` for the Switch thumb and chevron rotation, `cubic-bezier(0.2,0,0.2,1)`), used only for
colour/shadow transitions, the Switch thumb slide, the Radio dot scale, and the 180° chevron rotation
on Select and Accordion. The Spinner turns at 800ms linear. **Nothing else moves.** No fades on mount,
no slide-ins, no height animation on Accordion panels.

### Borders, dividers, transparency

Borders are always **1px**, from `--color-border-*`: `subtle` (hairlines inside a panel), `default`
(the panel's own edge), `muted`, `strong` (dashed drop zones), `gray`, plus the semantic
`brand / error / warning / success`. Focus is the only 2px stroke and it is a shadow.

Transparency is used sparingly and only where it is load-bearing: `black/25` and `black/75` for the
modal scrim (`bg/dim`), `white/3 · 5 · 10 · 20` for dark-theme overlays, and one deliberate oddity —
`--color-white-back: rgba(255,255,255,0.001)`, a near-invisible fill used so a focus ring has a
surface to sit on. **There is no backdrop blur anywhere in the file.** Overlays read as opaque
surfaces lifted by shadow, not frosted glass.

### Cards, panels and backgrounds

Cards are radius 12 in one of three styles: **elevated** (`surface/primary` + the e3→e5→e4 shadow
ramp), **fill** (`secondary/bg/subtle` tint ramp), **outline** (1px `secondary/border` ramp).
`selected` layers the brand border ramp on top of whichever style. The everyday container is simpler
still — `Panel`: `surface/primary`, 1px `border/default`, radius 8, 16px body padding.

**Backgrounds are flat colour. Full stop.** No gradients, no photography, no illustration, no
texture, no pattern in the entire file. The one image asset (`054dfe02e425078f.png`, used 54×) is a
UI bitmap, not decoration. Empty states use a plain muted glyph, never an illustration. If a design
built on this system needs imagery, it must come from real product content (a camera frame, a floor
plan, a photo the user uploaded) — never from decoration.

### Layout

Fixed chrome, scrolling content. `Header` is 50px and pinned to the top. `LNB` is 240px, or 56px as
an icon rail, pinned to the left. Only the content column scrolls, and it carries the custom
scrollbar: **12px track, pill thumb with a 3px inset, `scroll/thumb/default → hover → active`**
(add `.une-scroll`). Content padding is 20px vertical / 24px horizontal. Page titles are 24/36 bold.

---

## Iconography

**248 glyphs**, all extracted verbatim from the file's `가변 아이콘` (variable icon) set into
`assets/icons/` — one `.svg` per glyph plus `icon-data.js` (the inline path map the `Icon` component
reads). **No icon in this system comes from a third-party library, and none was drawn by hand.**

- **Format.** Monochrome SVG paths on a **24×24 frame**, authored so any size on the ramp
  (12 / 16 / 20 / 24 / 28 / 32 / 36 / 40) lands on whole pixels. Every path paints with
  `currentColor`, so recolouring is a CSS `color` change using an `--color-icon-*` token.
- **Style.** Geometric, moderately rounded, filled-shape construction (the paths are filled outlines,
  not stroked lines — there is no stroke-width to match). Optical weight sits between Material
  Symbols and Remix Icon; the closest public relatives are Material Symbols Rounded.
- **Line / fill pairs.** ~45 glyphs ship as both, e.g. `notification-line` / `notification-fill`,
  `home-line` / `home-fill`, `cctv-line` / `cctv-fill`, `folder-line` / `folder-fill`. **The house
  convention: `-line` for the resting state, `-fill` for the active or selected state** — LNB items
  swap glyph on select, and Toast/Alert/Confirm always use the `-fill` semantic glyph.
- **Domain sets.** Alongside the usual UI glyphs the set carries three product-specific families you
  will not find in a public icon library: alarm types (`fire`, `gas`, `leak`, `flood`, `odor-fill`,
  `air-pollution-fill`, `emergency-bell`, `siren`), control-room devices (`cctv`, `camera-360`,
  `thermal-camera`, `sensor`, `iot`, `power-tray`, `comm-tray`, `worker`), and drawing/3D authoring
  (`draw-wall`, `draw-floor`, `pierce-floor`, `round-column`, `square-column`, `stairs`, `escalator`,
  `elevator`, `ramp`, `draw-curve`, `floorplan`, `layer`, `flip-horizontal`, `rotate-90`).
- **Emoji and unicode are never used as icons.** No emoji appears in the product UI; the only
  non-icon glyph the system uses as an icon-like mark is the `…` ellipsis in Pagination, and `·`
  as a separator in metadata lines.
- **File names are romanised English** (the source names are Korean, e.g. `Icon/알림_Line` →
  `notification-line`). The mapping is one-way and lossy in spirit only — the artwork is byte-identical.

Glyphs whose source symbol stored its artwork inline rather than as an SVG child (30 of the 248 —
chevrons, play/pause, folder, gas-fill, the drawing tools) were reconstructed from the exact path
data and 24×24 frame offsets in the source JSX, not redrawn.

---

## Files

```
styles.css                      the single entry point consumers link
tokens/
  fonts.css                     @font-face (Spoqa Han Sans Neo, Pretendard GOV alias)
  fig-tokens.css                all 445 Figma Variables, all modes — generated, do not hand-edit
  colors.css                    ramp documentation + --une-focus-ring
  typography.css                type scale, families, .une-title-* / .une-body-* classes
  spacing.css                   px aliases for spacing, radii, control and icon ramps
  elevation.css                 the 8 two-layer shadows + the usage map
  motion.css                    house transition values (not from the source — see above)
  base.css                      resets, link colours, .une-scroll
components/
  actions/                      Button · IconButton · TextButton
  forms/                        Input · Textarea · Select · Checkbox · Radio · Switch ·
                                SegmentedControl · Datepicker · Upload · UploadList · Filter
  data-display/                 Table · ListItem · Card (+CardHeader/CardBody/CardFooter) ·
                                Accordion · Badge · DotBadge · InputChip · FilterChip ·
                                ChoiceChip · ActionChip
  navigation/                   Tabs · Breadcrumb · Pagination · Tree · LNB
  feedback/                     Tooltip · Toast · ToastRegion · Alert · Spinner ·
                                LoadingOverlay · EmptyState
  overlay/                      Modal · Confirm · Nonmodal · Menu · Droplist
  layout/                       Header · Shell · PageHead · Panel · Timepicker
assets/
  icons/                        248 .svg files + icon-data.js + Icon component
guidelines/                     21 foundation specimen cards (Colors · Type · Spacing · Brand)
ui_kits/control-room/           the product recreation — README.md, index.html, App.jsx
thumbnail.html                  project tile
SKILL.md                        Agent-Skills wrapper
```

## Components

Every component is `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`, with one `@dsCard` HTML per
directory. Read the `.prompt.md` next to a component before using it — it carries the exact size
ramp and the rule for when to reach for it.

**Actions** — `Button`, `IconButton`, `TextButton`
**Forms** — `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `SegmentedControl`,
`Segment`, `Datepicker`, `DatepickerDay`, `Upload`, `UploadList`, `Filter`
**Data display** — `Table`, `TableHeaderCell`, `TableBodyCell`, `TableRow`, `TableBody`,
`TableFooter`, `ListItem`, `Card`, `CardHeader`, `CardBody`, `CardFooter`, `Accordion`,
`AccordionHeader`, `Badge`, `DotBadge`, `InputChip`, `FilterChip`, `ChoiceChip`, `ActionChip`
**Navigation** — `Tabs`, `Tab`, `TabLine`, `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbSeparator`,
`Pagination`, `PaginationButton`, `Tree`, `TreeNode`, `LNB`, `LnbItem`, `LnbGroup`
**Feedback** — `Tooltip`, `Toast`, `ToastRegion`, `Alert`, `AlertBanner`, `Spinner`,
`LoadingOverlay`, `EmptyState`
**Overlay** — `Modal`, `ModalHeader`, `ModalFooter`, `Confirm`, `Nonmodal`, `Menu`, `MenuItem`,
`MenuSection`, `MenuDivider`, `Droplist`, `DroplistItem`
**Layout** — `Header`, `Shell`, `PageHead`, `Panel`, `Timepicker`
**Foundation** — `Icon`

**Whole-component vs part.** Each family ships the convenience component *and* the parts the Figma
file publishes separately, because Figma has no props and must model a slot as its own component.
Pass an array to `Table`, `Tabs`, `Menu`, `Droplist`, `Pagination`, `Tree`, `LNB` or
`SegmentedControl` for the normal case; reach for `TableRow` / `Tab` / `MenuItem` / `TreeNode` /
`LnbItem` / `Segment` / `DatepickerDay` / `ModalHeader` when you need custom markup inside a row.
Two pairs are genuinely different components, not a whole-and-part: `Alert` is the blocking
emergency overlay on `elevation/6`, while `AlertBanner` is the in-flow notice strip (the kit's
inline 알럿); `Menu` is a command list on `elevation/3`, while `Droplist` is a Select's option list
on `elevation/4`.

### How the source's 94 component sets map onto these

The file lists **94 component sets** (plus 1,355 standalone variant symbols). Many of those sets are
duplicates of the same family published on two or three pages (light/dark, or a page-local copy), or
are *slot* sub-components that only exist to be nested. The mapping:

| Source sets | Built as |
| --- | --- |
| `Button` ×3, `Icon Button`, `IconButton`, `v0.3_텍스트 버튼(Text Button)` | `Button`, `IconButton`, `TextButton` |
| `Input` ×4, `Textarea`, `Select` | `Input`, `Textarea`, `Select` |
| `Checkbox` ×2, `Radio` ×2, `Switch` | `Checkbox`, `Radio`, `Switch` |
| `Segment` ×2, `Segmented Control` ×2 | `SegmentedControl` |
| `Datepicker` ×2, `Pagination_Buttons` ×4 | `Datepicker`, `Pagination` |
| `Header cell` ×3, `Body cell` ×2, `Row-bg` ×2, `Body` ×2, `Header` ×2 (table), `Footer` | `Table` |
| `ListItem`, `Card (카드)` ×2, `Card Header/Body/Footer Slot` ×6, `Slot` ×4, `Body Slot` ×3, `Header Slot` ×3 | `ListItem`, `Card` + `CardHeader`/`CardBody`/`CardFooter` |
| `Accordion`, `Header` (accordion, 모드/열림/사이즈/상태) | `Accordion` |
| `Input chip`, `Filter chip`, `Choice chip`, `Action chip` | `InputChip`, `FilterChip`, `ChoiceChip`, `ActionChip` |
| `Badge` ×2, `DotBadge` | `Badge`, `DotBadge` |
| `breadcrumb`, `Tab`, `Tab_Line`, `Tree` ×2, `lnb-item` | `Breadcrumb`, `Tabs` (incl. `variant="line"`), `Tree`, `LNB` |
| `Tooltip`, `Toast (토스트)`, `Alert`, `Spinner`, `Empty (빈 화면)` | `Tooltip`, `Toast`, `Alert`, `Spinner`, `EmptyState` |
| `알럿` (inline notice, 모드 × 상태) | `AlertBanner` |
| `Confirm` (intent 4) | `Confirm` |
| `Header` (modal, size/desc-position/divider), `Footer` (modal), `Nonmodal`, 드롭리스트 `(Droplist)` standalones | `Modal`, `Confirm`, `Nonmodal`, `Droplist`, `Menu` |
| `Header (헤더)`, `Scrollbar` | `Header`, `.une-scroll` in `base.css` |
| `Upload`, `Upload List` | `Upload`, `UploadList` |
| `가변 아이콘` ×3, `아이콘 메인프레임(가변 아이콘)` | `Icon` (248 glyphs) |
| `Frame 14492`, `Component 1` | **Skipped** — unnamed working frames with no semantic role. |

**The families the check names specifically**, and where each one lives:

| Cited family | Built as |
| --- | --- |
| `가변 아이콘` (listed 3× — published on three pages) | `Icon` — all 248 glyphs, `assets/icons/` |
| `아이콘 메인프레임(가변 아이콘)` (41 variants: 사이즈 21 × 원래 아이콘 색 사용하기 2) | `Icon` — the `size` prop is the 사이즈 axis; the colour axis is `currentColor` inheritance |
| `알럿` (6 variants: 모드 2 × 상태 3) | `AlertBanner` — the in-flow notice strip |
| `Alert` (2 variants: alarm / error) | `Alert` — the blocking `elevation/6` overlay |
| `Body` (listed 2× — the table body, divider 2) | `TableBody` |
| `Body cell` (listed 2×, align 3 × state 2) | `TableBodyCell` |

Every name in that list has a component. The check reports them as missing because it matches on the
Figma layer name, and this system names its components in English after their role rather than
transliterating Korean layer names.

### Coverage — and why the family count looks low

An automated check reports **853 "component families"** against 50 built components. That number counts
every *variant symbol and slot sub-component* in the file as its own family. The file's own inventory
(`/METADATA.md` → "Component families") states the real figure: **94 component sets, plus 1,355
standalone variant symbols**. Those 1,355 are individual variants of the 94 sets —
`Accordion/line/md(56)/False/Hover`, `배지 (Badge)/Light/Round Square/Outline/Grayscale/L(32)`,
`셀렉트 (Select)/Dark/Inline/MD(40)/Focus` and so on — not distinct components. A single `Badge` set
alone is 600 variants; `Button` is 300, published three times.

**92 of the 94 sets are implemented.** Because a React component takes its variants as props, one
`Badge` component covers all 600 Badge symbols, one `Button` covers all 900 Button symbols across the
three duplicate publications, and one `Icon` covers the whole `가변 아이콘` set. The table above maps
every set to the component that implements it.

**Deliberately skipped — 2 sets:**

| Set | Why |
| --- | --- |
| `Frame 14492` (4 variants, axis "Icon") | An unnamed working frame. It is an icon-swap scratch frame with no label, no semantic role and no usage in any product surface. |
| `Component 1` (8 variants, axes "Property 1" / "Property 2") | Figma's default auto-generated name on an unfinished component with unnamed axes. Nothing in the file instances it. |

**Also not built as components, by design:**

- **Slot sub-components are built, but as parts of their family.** `Row-bg` → `TableRow`,
  `Header cell` → `TableHeaderCell`, `Body cell` → `TableBodyCell`, `Body` → `TableBody`,
  `Footer` → `TableFooter`, `Card Header/Body/Footer Slot` → `CardHeader`/`CardBody`/`CardFooter`,
  the modal `Header`/`Footer` sets → `ModalHeader`/`ModalFooter`, the accordion `Header` set →
  `AccordionHeader`. The generic `Slot`, `Body Slot` and `Header Slot` sets have no meaning of their
  own — they are Figma's mechanism for making a parent's contents swappable, which in React is just
  `children`, so they are not separate exports.
- **Duplicate publications.** `Button` ×3, `Input` ×4, `Card (카드)` ×2, `Datepicker` ×2, `Tree` ×2,
  `Badge` ×2, `Checkbox` ×2, `Radio` ×2, `Segment` ×2, `Segmented Control` ×2, `Pagination_Buttons` ×4,
  `가변 아이콘` ×3 and several `Header`/`Footer` sets are the same family republished per page or per
  light/dark mode. Light and dark are theme scopes here (`:root[data-theme="dark"]`), not separate
  components.
- **`Scrollbar`** is CSS, not a React component — it ships as `.une-scroll` in `tokens/base.css`.
- **Pure documentation frames** (`ComponentTitle`, `GuideTitle`, the `📋 QA Report & Dev Spec` frames,
  the Foundation specimen frames) are the file's internal documentation. Their *content* was read and
  became `tokens/`, `guidelines/` and this readme; they are not product components.

### Intentional additions

Three things here have no direct counterpart in the source, and each earns its place:

- **`Shell` / `PageHead` / `Panel`** — the file draws every screen inside a Header + LNB + scrolling
  content frame but never publishes it as a component. These wrap that layout so screens are
  consistent instead of re-derived.
- **`Icon`** — a React wrapper over the extracted glyph set. The source has the glyphs; it has no code.
- **`tokens/motion.css`** — the source defines no motion. Documented above and deliberately minimal.

Nothing else was added. In particular, there is **no Avatar, no Progress bar, no Slider, no Skeleton,
no Popover, no Drawer and no Stepper** in this system, because there is none in the file.

---

## UI kits

`ui_kits/control-room/` — the product the file describes, recreated as a clickable four-screen app:
integrated-control dashboard, equipment register (filter → sortable table → pagination), floor-plan /
3D authoring editor, and settings. Open `ui_kits/control-room/index.html`. It uses the authored
components only; nothing is re-implemented inside the kit.

There is one UI kit because the file represents one product surface. No marketing site, mobile app or
slide template exists in the source, so none was invented.

---

## Using this system

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
<script type="text/babel">
  const { Shell, Header, LNB, Panel, Button, Table, Badge } = window.UNEDesignSystem_bbd5ec;
</script>
```

Rules of thumb, in priority order:

1. **Reach for a semantic token, never a primitive.** `var(--color-text-primary)`, not
   `var(--color-grayscale-900)`.
2. **State comes from the interaction ramps.** If you are typing a hex for a hover colour, stop.
3. **Keep the density.** 14px body, 12px in tables, 40px controls, 8px gaps. Do not inflate.
4. **Letter-spacing is −3%.** Every text run.
5. **Use the elevation map.** e1/e3/e4/e6 for their listed components; nothing else gets a shadow.
6. **Flat colour backgrounds.** No gradients, no decoration, no illustration.
7. **Korean copy, short labels, fixed status vocabulary, no emoji.**
