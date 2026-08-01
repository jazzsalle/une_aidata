# UNE 재난안전 POC — Source v1.5.1


통합설계서 v1.8의 Runtime Regression 기준선, Provider 계약 적합성·혼합운영·설계 완료 Gate와 기존 다중 페이지 UX·위성 증거세트를 반영한 Vercel 실행 Starter입니다.

## Mock-first / Provider-neutral 기준

현재 T3Q는 개발 중이며 기술협력·API·MCP·대표응답을 전제로 하지 않습니다. Event Master, Passage, RefDisasterEventID, T코드, lineage 구조만 유지하고 런타임은 `MOCK_ONLY`로 동작합니다. 홍수위험지역·위험저수지·풍수해개선지구도 명확히 표기된 Mock GeoJSON으로 화면·검색 계약을 검증합니다.


## 핵심 변경
- ASP.NET Core, C#, PostgreSQL/PostGIS 초기 구성을 제거했습니다.
- React·TypeScript·Vite와 TypeScript Vercel Functions를 단일 프로젝트로 구성했습니다.
- `/api` Functions가 UNE RAG·공공 API의 BFF/Proxy 역할을 담당합니다.
- 초기 저장은 Static JSON/GeoJSON 및 브라우저 localStorage를 사용합니다.
- 현재상황 입력·검증, 현재조건 기반 우선 확인지역 Rule, GeoJSON ID 지도강조, 상황뷰 저장을 구현했습니다.

## 실행
```bash
cp .env.example .env.local
npm install
npm run dev
```
`npm run dev`는 `vercel dev`를 사용하여 Vite 화면과 `/api` Functions를 함께 실행합니다. 순수 화면만 확인할 때는 `npm run dev:web`을 사용하고 Seed fallback을 사용합니다.

## 환경변수
- `VITE_VWORLD_MAP_KEY`: 신규 VWorld 도메인 제한 키
- `UNE_RAG_*`: UNE RAG 서버측 인증
- `DATA_GO_KR_SERVICE_KEY`, `SAFETY_DATA_API_KEY`: 공공 기상·수문 API

키 값은 문서·소스·로그에 넣지 않습니다.

## 구현 완료
- P0 기술전환: Vercel Functions
- P1 지도 Seed 및 객체 ID 강조
- P1 현재상황 입력·재산정
- P1 우선 확인지역 동적 산정
- P1 상황뷰 localStorage 저장

## 다음 개발
1. VWorld 키를 Vercel 환경변수에 등록하고 실제 배경지도 확인
2. UNE RAG Swagger와 로그인 규격을 `server/providers/uneRag.ts`에 적용
3. 기상청·홍수통제소 키 발급 후 `publicObservation.ts` 구현
4. 유사사례/근거/보고서의 UNE RAG 결과 결합
5. 침수흔적 GeoJSON과 위성 시점비교 UI 구현

## v0.3 구현 추가사항

- VWorld 타일 연결상태 런타임 진단
- UNE RAG 로그인·검색 Adapter(환경변수 기반 경로 설정)
- Event 단위 유사사례 점수·근거 결합
- 침수흔적 POC GeoJSON 지도 레이어
- 위성영상 좌우·스와이프 비교 UI와 실제 Seed 이미지
- 유사사례 현재조건 비교 및 대응·복구 참고화면



## v0.5 다중 페이지 UX

- `/` 지도 기반 재난 상황판
- `/evidence` 위성영상·침수흔적·피해복구 근거
- `/report` 상황보고서 초안 작성

상위 업무는 URL과 전역 링크로 구분하고, ARIA Tab은 동일 페이지의 소규모 패널 전환에만 사용합니다. 각 페이지는 고유 제목·H1·main landmark·본문 바로가기·라우트 초점이동을 제공합니다.


## v0.5 신규 기능
- 기상청 초단기실황 실연계 Provider
- 연계상태 진단 패널
- 위성영상·침수흔적도·피해복구 참고사례의 보고서 선택 반영
- Playwright 키보드·라우팅 E2E

```bash
npm run test:observation-provider
npm run test:report-context
npm run test:e2e
```


## v0.7 외부연계 검증 단계

- VWorld 일반지도/영상지도 전환과 브라우저 타일상태 진단
- 기상청 초단기실황 공식 계약 보강
- 홍수통제소 표준수문DB용 설정형 Adapter와 공식 관측소 코드 안전장치
- UNE RAG OpenAPI probe 및 요청/응답 필드 매핑 환경변수
- 외부 연계가 확인되지 않으면 사용자 입력·Scenario·Seed를 유지

```bash
npm run test:integration-adapters
npm run typecheck:functions
```

홍수통제소의 `internal_plan_station_code`는 하천기본계획 내부 산정지점 코드이며, 공식 관측소 코드로 사용하면 안 됩니다. `HRFCO_STATION_MAP_JSON`에는 검증된 공식 코드만 등록합니다.


## v0.7 홍수영상 Seed 타일 반영
- PRE: 사건 시작일 -12일
- EVENT: 재난 시작~종료 +2일 이내
- POST: 재난 종료일 +12일
- 위성영상·수계마스크 각 3개, 총 6개 256×256 PNG를 `/evidence`에 독립 카드로 표시
- VWorld 베이스맵은 2D이며 위성 타일 오버레이 금지
- 대상지역 외·공식자료 아님·EVENT 생성 Seed·쓰리디랩스 교체 예정 상태 고정


## v0.9 추가 구현
- DisasterEvent의 `event_start_at`·`event_end_at`을 기준으로 PRE/EVENT/POST 후보 영상을 자동 선정하는 Phase Selection Engine
- PRE/POST 목표일과 실제 촬영일 차이를 `offset_days_from_target`으로 계산
- 256×256 수계마스크의 흰색 픽셀 비율과 PRE 대비 상대변화를 계산·표시
- 상대변화는 픽셀 기반 비교이며 면적·침수심·피해예측으로 사용하지 않음
- 선택한 6개 타일과 상대변화 메타를 보고서 초안의 참고근거로 자동 반영

## v0.9 위성 증거세트
`SatelliteEvidenceSet`으로 PRE/EVENT/POST 6개 타일, Event 기간, 출처, 대상지역 여부, SHA-256, 교체 Provider를 관리합니다. `/api/v1/satellite-evidence-sets`와 `/evidence` Manifest 다운로드를 제공합니다.


## v1.0 T3Q 정합 보완
- T3Q 테스트 모듈의 Event Master·RefDisasterEventID·taxonomyCodes·Passage lineage를 Adapter 계약으로 수용한다.
- 외부 API/MCP는 미확정이므로 `pending`과 Fallback을 유지한다.
- 홍수위험지역·위험저수지·풍수해개선지구는 실제 Geometry/속성 계약 전 임의 표출하지 않는다.
- POC1 비교내용은 현행 설계 판단에 사용하지 않는다.


## v1.1 T3Q 연계 상세협의·CQ 커버리지
- 사건 식별·택사노미·Passage·CQ·공간·MCP 6개 정합 차원의 준비상태를 `/api/v1/t3q/readiness`로 제공
- 재난담당자 CQ 5문별 필수 SchemaType·검색필터·화면출력·현재 Provider·차단항목을 `/api/v1/t3q/cq-coverage`로 제공
- 실제 T3Q Endpoint가 설정되면 Event/Passage 검색을 시도하고, 미설정·실패 시 T3Q 계약 형태의 Seed 응답으로 대체하는 `/api/v1/t3q/search-preview` 추가
- 메인 상황판에 `T3Q 설계 정합·CQ 커버리지` 패널을 추가하여 컨소시엄·발주처 협의 시 설계 진행상태와 잔여 확인사항을 투명하게 표시
- 홍수위험지역·위험저수지·풍수해개선지구는 Geometry·속성·좌표계·공개등급 검증 전까지 pending 상태 유지

```bash
npm run test:t3q-readiness
npm run test:t3q-search-preview
npm run typecheck:functions
```


## v1.3 Provider-neutral / Mock Event Expansion
- 공급자 교체형 Provider/Adapter/Common Domain 구조
- Event 15건(문서근거 9, 합성 6)
- 요인별 유사도·결측 재정규화·대응비교
- T3Q/Open API 요구 콘텐츠 계약

## v1.4 Runtime Regression Gate

- 5개 현재상황에 대해 15개 Mock Event 전체 순위를 실제 Domain 함수로 반복 검증
- 요인별 점수·유효가중치 재정규화·Graph 미확보·대응비교 검증
- CQ 5문의 Event·Passage·RefDisasterEventID·lineage 검증
- 선택 유사사례의 요인점수와 대응비교를 보고서 초안에 연계
- 유사사례 화면에 요인별 점수표와 현재 확인사항·과거 대응조치 비교표 추가
- 독립 브라우저 회귀 대시보드와 결과 JSON·Markdown 생성

```bash
npm run test:runtime-gate
```

현재 작업환경에서는 npm registry 제한으로 React·Vite Production Build가 차단되어 있으며, 패키지 설치가 가능한 개발환경에서 `npm install`, `npm run build`, `npm run test:e2e`를 재실행해야 합니다.

## Provider 적합성 Gate

```bash
npm run test:provider-conformance
```

Mock/Seed 계약을 향후 T3Q/Open API Provider로 교체하기 전에 대표응답 Fixture, 공통 메타데이터, Evidence/lineage, 단위·시각, Geometry/CRS 및 혼합운영 상태를 검증한다.
