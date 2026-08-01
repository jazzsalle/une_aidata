# CLAUDE.md — 재난안전 POC Vercel v1.1

## 고정 기술
- React + TypeScript + Vite
- OpenLayers + VWorld 2D
- TypeScript Vercel Functions(`/api`)
- Static JSON/GeoJSON + localStorage
- Python은 전처리/Seed 생성만 사용
- POC 런타임에 .NET, Java, PostgreSQL/PostGIS를 추가하지 않는다.

## 고정 범위
- 현재상황: 사용자 입력 + 공개 공공 API + Scenario fallback
- CCTV 및 지자체 시스템 Context 수신 제외
- 피해예측 제외; 피해·복구 Seed는 과거 참고정보
- NDMS 자동제출 제외
- 부산 북구청 매뉴얼은 잠정 참고 템플릿

## 구현 규칙
1. API Route는 얇게 유지하고 업무규칙은 `server/domain`에 둔다.
2. 외부 연계는 `server/providers`로 격리한다.
3. OpenAPI/JSON Schema/Provider 계약을 깨지 않는다.
4. 실제·derived·scenario·mock·provisional 상태를 보존한다.
5. VWorld/UNE/공공 API 키를 프런트 소스에 기록하지 않는다. 단, 도메인 제한된 VWorld 브라우저 키는 Vercel 환경변수로만 주입한다.
6. 우선 확인지역 점수는 공식 위험등급이나 피해확률로 표현하지 않는다.
7. 지도 Action은 존재하는 GeoJSON ID만 실행한다.
8. 변경 후 `npm run typecheck:functions`, `python3 scripts/validate_vercel_repo.py`, `python3 scripts/smoke_priority_logic.py`를 실행한다.


## v0.5 구현 규칙

- UNE RAG 실제 Endpoint가 달라도 `server/providers/uneRag.ts` 내부만 변경한다.
- 유사사례는 문서검색 결과가 아니라 `SimilarEvent`를 먼저 반환하고 Passage는 `evidence`로 부착한다.
- 침수흔적·피해·복구 Seed는 실제 자료나 예측결과로 표현하지 않는다.
- VWorld 키를 코드에 작성하지 않고 `VITE_VWORLD_MAP_KEY` 환경변수만 사용한다.
- 위성영상 비교는 불규칙 촬영일을 그대로 표시하며 동일주기처럼 보간하지 않는다.


## v0.5 필수 UI 규칙
- 3개 상위 페이지(`/`, `/evidence`, `/report`)를 다시 한 화면 탭으로 합치지 않는다.
- 상위 이동은 링크와 고유 URL을 유지한다.
- 라우트 변경 시 document.title과 h1 초점을 갱신한다.
- 지도·영상만으로 정보를 전달하지 말고 목록·표·텍스트 대안을 유지한다.
- KWCAG 2.2/WCAG 2.2 AA와 `tests/accessibility/multi-page-a11y-checklist.md`를 Definition of Done에 포함한다.


## v0.5 다음 개발 우선순위

1. Vercel Preview에서 `/`, `/evidence`, `/report` 직접 URL·새로고침·뒤로가기 검증
2. 신규 VWorld 키를 적용한 3개 지역 지도·레이어 실검증
3. 공공 기상·수문 API 최소 실연계
4. UNE RAG Swagger 로그인·검색·Citation 실매핑
5. 근거 페이지 Event·영상·침수흔적·피해위치 지도 동기화
6. 보고서 초안 자동반영 및 오류검증
7. axe·키보드·화면낭독기·Reflow E2E


## v0.7 통합검증 규칙

1. VWorld 키·공공 API 키·UNE RAG 인증정보를 코드 또는 문서에 하드코딩하지 않는다.
2. VWorld 영상지도는 브라우저 타일 성공과 등록도메인 확인 전까지 `configured`로만 표시하고 `verified`로 표시하지 않는다.
3. 하천기본계획의 Y4, AY09 같은 내부 산정지점 코드를 홍수통제소 공식 관측소 코드로 간주하지 않는다.
4. `HRFCO_STATION_MAP_JSON`에 `official_station_code`가 없으면 수위·유량 API를 호출하지 않고 사용자 입력·Scenario 값을 유지한다.
5. UNE RAG Swagger가 접근되지 않으면 경로와 응답형식을 추정하여 고정하지 말고, `UNE_RAG_*_FIELD`와 `UNE_RAG_RESPONSE_ARRAY_PATH` 설정으로 보류한다.
6. 모든 실제 연계값은 `official_data=true`, `value_status=actual`, 관측시각과 Provider를 보유해야 한다.
7. 실제 연계 실패는 서비스 전체 오류가 아니라 연계별 Fallback으로 처리한다.


## v0.7 홍수영상 Seed 타일 반영
- PRE: 사건 시작일 -12일
- EVENT: 재난 시작~종료 +2일 이내
- POST: 재난 종료일 +12일
- 위성영상·수계마스크 각 3개, 총 6개 256×256 PNG를 `/evidence`에 독립 카드로 표시
- VWorld 베이스맵은 2D이며 위성 타일 오버레이 금지
- 대상지역 외·공식자료 아님·EVENT 생성 Seed·쓰리디랩스 교체 예정 상태 고정


## v0.7 홍수 위성영상·수계마스크 규칙
- PRE: `event_start_at - 12 days` 기준.
- EVENT: `event_start_at <= acquired_at <= event_end_at + 2 days`.
- POST: EVENT와 중복되지 않도록 `event_end_at + 12 days` 기준.
- 위성영상과 수계마스크는 `/evidence`에서 256×256 독립 타일로 표시하고 VWorld 2D 지도에는 오버레이하지 않는다.
- 현재 표본은 부산·인제·영천 대상자료가 아니며 `official_data=false`, `data_status=mock`, `shared_demo=true`를 유지한다.
- EVENT 자료는 PRE/POST 첨부자료에서 생성한 Seed이므로 실제 관측자료로 설명하지 않는다.


## v0.8 Phase Selection·수계마스크 상대변화 규칙
- PRE 후보는 사건 시작 이전 자료 중 `event_start_at - 12 days` 목표시각과 가장 가까운 자료를 선택한다.
- EVENT 후보는 `event_start_at <= acquired_at <= event_end_at + 2 days` 구간 안에서 품질과 이벤트 중간시각 근접성을 기준으로 선택한다.
- POST 후보는 EVENT 구간 이후 자료 중 `event_end_at + 12 days` 목표시각과 가장 가까운 자료를 선택한다.
- `offset_days_from_target`과 `selection_reason`을 화면과 API에 제공한다.
- 수계마스크 변화는 256×256 픽셀의 상대비율이며 지리면적·침수심·피해예측 값으로 설명하지 않는다.

## v0.9 추가 규칙
- 위성자료는 개별 asset만 다루지 말고 `SatelliteEvidenceSet`을 통해 선택·보고서 반영한다.
- Seed·생성·정식자료의 provenance_version과 target_region_match를 보존한다.
- ThreeDLabs 교체 시 기존 Contract와 256×256 독립표출·지도 오버레이 금지를 유지한다.


## v1.0 T3Q 연계 규칙
- T3Q 테스트 모듈의 Event Master·RefDisasterEventID·taxonomyCodes·Passage lineage를 Adapter 계약으로 수용한다.
- 외부 API/MCP는 미확정이므로 `pending`과 Fallback을 유지한다.
- 홍수위험지역·위험저수지·풍수해개선지구는 실제 Geometry/속성 계약 전 임의 표출하지 않는다.
- POC1 비교내용은 현행 설계 판단에 사용하지 않는다.


## v1.1 T3Q 준비상태·CQ 커버리지 규칙
- URL·인증키가 설정된 상태와 대표응답·오류·Timeout이 검증된 상태를 구분한다.
- `T3qReadinessPanel`은 사건식별·택사노미·Passage·CQ·공간·MCP 6개 차원과 완료 게이트를 표시한다.
- CQ-01~05는 데이터·검색필터·화면출력·현재 Provider·차단항목·Fallback을 유지한다.
- `/api/v1/t3q/search-preview` Seed Fallback은 T3Q 실데이터로 표시하지 않는다.
- 홍수위험지역·위험저수지·풍수해개선지구는 좌표계·Geometry·속성·공개등급 검증 전 활성화하지 않는다.
- 변경 후 `python3 scripts/smoke_t3q_readiness.py`, `python3 scripts/smoke_t3q_search_preview.py`, `tsc -p tsconfig.functions.json --noEmit`을 실행한다.


## Phase

개발은 아래 Phase 순서로 진행한다(`/phase-run N`). 정본 설계 문서는 `재난안전_AI데이터_시범서비스_글로드코드_개발인계문서_v1.0.md`, 합격 기준은 `evaluation_criteria.md`.
Windows 환경 참고: npm 스크립트의 `python3`는 `python`으로, `.sh`는 Git Bash로 실행한다.

| Phase | 목표 | 산출물 |
|---|---|---|
| 1 | 기준선 재현·빌드 정상화 (npm install→validate→contracts→typecheck→runtime/provider gate→build) | package-lock.json, 빌드 산출물, 결과 보고 |
| 2 | /dashboard Mock/Seed 사용자 흐름 완성 | 대시보드 완결 흐름 |
| 3 | /evidence PRE/EVENT/POST 및 근거 선택 흐름 완성 | 근거 페이지 완결 흐름 |
| 4 | /report 선택 근거·유사도·대응비교 연계 | 보고서 페이지 연계 |
| 5 | Playwright E2E | e2e 스펙 통과 |
| 6 | Vercel Preview 배포 + VWorld 허용 도메인 확인 | Preview URL, 도메인 검증 |
| 7 | 외부 Provider별 Fixture 연계 (FIXTURE_VALIDATED) | Fixture 연계, conformance 재통과 |
| 8 | 실제 Provider Shadow Test 및 단계별 승격 | SHADOW_TESTED→SELECTABLE, 회귀시험 |

- 모든 Phase에서 OpenAPI·JSON Schema·Seed ID·Provider 계약 변경 금지 (변경 필요 시 영향범위 보고 후 승인 대기).
- 실제 T3Q·공공 API 호출 금지, DEFAULT 전환 금지 (Phase 8도 승인 기반 단계 승격만).
