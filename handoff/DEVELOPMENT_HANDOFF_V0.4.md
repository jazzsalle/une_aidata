# 개발 인계서 v0.4 — 다중 페이지 UX·웹 접근성

## 1. 이번 결정

상위 업무를 하나의 대형 화면·하단 탭에 모두 넣지 않는다. 다음 3개 페이지를 고유 URL과 실제 전역 링크로 제공한다.

- `/` 재난 상황판
- `/evidence` 피해·변화 근거
- `/report` 상황보고서 초안

메인 상황판은 기존 좌측 상황입력/AI Agent, 중앙 VWorld 지도, 우측 현재판단·유사사례·대응절차·계획근거 구조를 유지하고 하단에는 현재 상황 타임라인만 둔다. ARIA Tab은 동일 페이지의 관련 패널 전환에만 사용한다.

## 2. 구현 완료

### 전역 App Shell
- `AppHeader`: 브랜드, 주요 메뉴, 지역·상황, 기준시각, 모드, 재난유형, 상황뷰 저장
- `useRoute`: pushState/popstate 기반 `/`, `/evidence`, `/report`
- 현재 메뉴 `aria-current="page"`
- 본문 바로가기 링크
- 페이지별 `document.title`, H1과 설명
- 현재 Situation을 App 상위 상태에 유지하여 페이지 이동 시 Context 보존

### 재난 상황판 `/`
- `DashboardPage`
- `SituationAgentPanel`: 상황입력/AI Agent ARIA Tab
- `MapPanel`: VWorld·GeoJSON 레이어, 연결상태, 텍스트 대체정보
- `InsightPanel`: 현재판단/유사사례/대응절차/계획근거 ARIA Tab
- `SituationTimeline`: 특보·강우·수위·유량·재산정 시점

### 피해·변화 근거 `/evidence`
- `EvidencePage`
- `SatelliteComparison`: 두 시점 선택, 좌우 비교, 스와이프, native range, 빠른 위치 버튼, 메타데이터 표
- `DamageRecoveryEvidence`: 침수흔적·과거 피해·대응·복구 Seed
- Seed·비공식·비예측 상태 반복 표시
- 향후 쓰리디랩스와 T3Q NDMS Provider 교체 구조 유지

### 상황보고서 초안 `/report`
- `ReportPage`
- `ReportEditor`: 목차, 보이는 label 기반 편집폼, Markdown 미리보기
- 브라우저 저장과 Markdown 다운로드
- NDMS 자동제출·공식 승인 없음

### 웹 접근성
- KWCAG 2.2·WCAG 2.2 AA 개발 기준
- header/nav/main/footer landmark와 페이지당 H1
- Tab 위젯의 roving tabindex, Left/Right/Home/End
- 지도 핵심정보의 동등한 텍스트 목록
- 위성 스와이프의 드래그 대체조작
- 명확한 focus-visible, 내부 조작대상 44px 목표
- `prefers-reduced-motion`
- 1280/900/560px 반응형 재배치와 고정 최소폭 제거

## 3. 핵심 소스

```text
apps/web/src/
├─ App.tsx
├─ components/
│  ├─ AppHeader.tsx
│  ├─ PageHeading.tsx
│  ├─ SituationAgentPanel.tsx
│  ├─ InsightPanel.tsx
│  ├─ SituationTimeline.tsx
│  ├─ SatelliteComparison.tsx
│  ├─ DamageRecoveryEvidence.tsx
│  └─ ReportEditor.tsx
├─ pages/
│  ├─ DashboardPage.tsx
│  ├─ EvidencePage.tsx
│  └─ ReportPage.tsx
├─ hooks/
│  ├─ useRoute.ts
│  └─ useRovingTabs.ts
└─ styles.css
```

## 4. 검증 완료

```bash
python3 scripts/validate_vercel_repo.py
python3 scripts/smoke_seed_contracts.py
python3 scripts/smoke_priority_logic.py
python3 scripts/smoke_similar_events.py
python3 scripts/smoke_spatial_assets.py
python3 scripts/validate_multi_page_a11y.py
tsc -p tsconfig.functions.json --noEmit
```

- 저장소 구조: PASS
- Seed 안전·범위: PASS
- 3개 지역 우선순위: PASS
- Event 유사사례: PASS
- 위성·침수 공간자산: PASS
- 다중 페이지 접근성 구조: PASS
- Vercel Functions TypeScript: PASS
- 정적 화면 프리뷰: 3페이지 시각검토 완료

현재 실행환경의 npm 내부 Registry에 `@types/react`가 없어 React/Vite 전체 생산빌드는 수행하지 못했다. 회사 Claude Code 환경에서 `npm install`, `npm run typecheck:web`, `npm run build:web`을 수행한다.

## 5. 실제 환경에서 다음으로 필요한 설정

```env
VITE_VWORLD_MAP_KEY=
UNE_RAG_BASE_URL=
UNE_RAG_AUTH_MODE=login
UNE_RAG_LOGIN_PATH=
UNE_RAG_SEARCH_PATH=
UNE_RAG_USERNAME=
UNE_RAG_PASSWORD=
DATA_GO_KR_SERVICE_KEY=
SAFETY_DATA_API_KEY=
```

비밀키를 문서·Git·프런트 로그에 넣지 않는다. 브라우저 노출이 제한되어야 하는 인증정보는 Vercel Functions 환경변수로만 관리한다.

## 6. 다음 개발순서

1. Vercel Preview에서 3개 직접 URL, 새로고침, 뒤로가기, `aria-current`, H1 초점을 검증한다.
2. 신규 VWorld 키로 3개 지역 배경지도와 하천·위험지구·침수흔적을 실제 확인한다.
3. 공공 기상 API 최소 1종과 수위·유량 API 최소 1종을 연결한다.
4. UNE RAG Swagger 기준 로그인·검색·Citation 응답을 실제 매핑한다.
5. 피해·변화 근거 페이지의 Event·위성시점·침수흔적·피해위치를 지도 Context와 동기화한다.
6. 보고서에 선택 우선지역·유사사례·대응절차·근거를 자동 반영한다.
7. axe, 키보드 전 과업, NVDA 또는 동등 화면낭독기, 200% 확대·320 CSS px Reflow 시험을 수행한다.
8. 남원·의왕·구미 대표 시나리오를 3개 페이지 End-to-End로 검증한다.
