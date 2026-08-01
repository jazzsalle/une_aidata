# 개발 인계서 v0.6

## 1. 이번 버전 목표

외부연계를 실제 운영 Provider로 전환하기 전 검증 게이트를 코드에 반영했다. VWorld, 기상청, 홍수통제소, UNE RAG는 각각 설정 여부와 실제 검증 여부를 분리한다.

## 2. 구현 완료

- VWorld 일반지도/영상지도 접근성 전환 버튼
- 기상청 초단기실황 Provider 유지 및 공식 계약 기준 보강
- 홍수통제소 표준수문DB 설정형 Adapter
- 하천기본계획 내부 지점코드와 공식 관측소 코드 분리
- UNE RAG OpenAPI probe와 요청·응답 필드 환경변수화
- 연계상태 `fallback/pending/configured/verified/error` 개념 반영
- 외부연계 안전검사 스크립트

## 3. 반드시 입력해야 하는 값

```env
VITE_VWORLD_MAP_KEY=
DATA_GO_KR_SERVICE_KEY=

UNE_RAG_BASE_URL=
UNE_RAG_OPENAPI_PATH=/openapi.json
UNE_RAG_SEARCH_PATH=
UNE_RAG_USERNAME=
UNE_RAG_PASSWORD=

HRFCO_API_BASE_URL=
HRFCO_WATERLEVEL_PATH=
HRFCO_SERVICE_KEY=
HRFCO_STATION_MAP_JSON=
```

`HRFCO_STATION_MAP_JSON`에는 검증된 공식 관측소 코드만 입력한다. `Y4`, `AY09`는 하천기본계획 내부 산정지점 코드이므로 사용 금지다.

## 4. 실행 순서

```bash
npm install
npm run validate
npm run test:integration-adapters
npm run typecheck
npm run build
npx vercel dev
```

## 5. 실제 검증 순서

1. Vercel Preview URL 생성
2. Preview URL을 VWorld 허용 도메인에 등록
3. 일반지도·영상지도 타일 성공 확인
4. 기상청 RN1 등 실응답 확인
5. UNE RAG `/api/v1/integrations/une-rag-probe` 확인
6. 공식 수위관측소 코드 확정 후 홍수통제소 실호출
7. 실응답을 비밀정보 제거 후 Fixture로 저장
8. 실제 응답과 Fixture에 동일 Contract Test 적용

## 6. 미완료

- Vercel Preview 실제 배포
- VWorld 발급키 실검증
- 공공데이터포털 키 실호출
- UNE RAG 서버 접근 및 Swagger 매핑
- 의왕·구미·남원 공식 수위관측소 코드 확정


## v0.7 홍수영상 Seed 타일 반영
- PRE: 사건 시작일 -12일
- EVENT: 재난 시작~종료 +2일 이내
- POST: 재난 종료일 +12일
- 위성영상·수계마스크 각 3개, 총 6개 256×256 PNG를 `/evidence`에 독립 카드로 표시
- VWorld 베이스맵은 2D이며 위성 타일 오버레이 금지
- 대상지역 외·공식자료 아님·EVENT 생성 Seed·쓰리디랩스 교체 예정 상태 고정
