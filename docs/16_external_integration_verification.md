# 외부연계 검증 상세

## 1. 목적

VWorld, 기상청, 홍수통제소, UNE RAG를 실제 운영 Provider로 전환하기 전에 설정·통신·계약·데이터 의미를 단계적으로 검증한다.

## 2. VWorld

- 브라우저 키는 `VITE_VWORLD_MAP_KEY`에서만 읽는다.
- 일반지도와 영상지도를 독립 TileLayer로 구성한다.
- 타일 성공 전에는 `verified`로 표시하지 않는다.
- 오류 시 키 자체가 아니라 허용 도메인, API 권한, URL 경로를 점검하도록 안내한다.

### 2.1 배포 환경 설정 절차

Phase 6 산출물이 "Preview 배포 + VWorld 허용 도메인 확인"인데 **설정 방법이 어디에도 없어서**
2026-08-19 에 같은 조사를 다시 했다. 그때 걸린 지점을 그대로 적는다.

**환경변수는 Vercel 대시보드에만 넣는다.** 프로젝트 → Settings → Environment Variables.

| Key | 대상 환경 | 비고 |
|---|---|---|
| `VITE_VWORLD_MAP_KEY` | **Production** | VWorld 브라우저 키 |
| `VITE_VWORLD_SERVICE_DOMAIN` | 설정하지 않는다 | 아래 참고 |

키 값은 코드·문서·커밋 어디에도 적지 않는다(구현규칙 5 · v0.7 규칙 1). 설정은 사용자가 직접
수행하며 에이전트·스크립트가 대신하지 않는다(`29_provider_shadow_and_promotion_procedure.md` §1).

**`VITE_VWORLD_SERVICE_DOMAIN` 은 배포 환경에서 비워 둔다.** `serviceDomain()`
(`apps/web/src/features/map/riverLayers.ts`)이 빈 값일 때 `window.location.origin` 을 쓰는데,
배포 환경에서는 그 origin 이 곧 VWorld 등록 도메인이라 그대로 맞는다. 이 변수는 origin 이 등록
도메인이 아닌 **로컬 개발용**이다(`localhost` 는 VWorld 가 거절한다).

**설정 후 반드시 재배포한다.** `VITE_*` 는 Vite 가 **빌드 시점에 번들에 박는** 값이고 런타임
조회가 아니다. 환경변수만 넣고 재배포하지 않으면 이미 배포된 빌드는 그대로다 — 키가 없는 빌드는
`VWorldMapAdapter.ts` 의 `if (key)` 가 거짓이 되어 **타일 요청을 아예 만들지 않는다.** 화면은
흰 바탕에 `VWorld 키 미설정: 공간 Seed만 표시` 로 뜬다. main 머지처럼 새 빌드가 도는 일이
예정돼 있으면 **환경변수를 그 전에** 넣어 빌드를 한 번으로 끝낸다.

**등록 도메인은 배포 origin 과 같아야 한다.** VWorld 는 키가 유효해도 등록되지 않은 출처의
요청을 거절한다. Preview 주소는 배포마다 무작위라 등록 도메인과 맞출 수 없으므로 Preview 환경에는
키를 넣지 않는다. Preview 도 살려야 하면 무작위 URL 이 아니라 브랜치 고정 별칭
(`<project>-git-<branch>-<team>.vercel.app`)을 등록한다.

### 2.2 `configured` → `verified` 승격 검증

v0.7 규칙 2 는 브라우저 타일 성공과 등록도메인 확인 전까지 `verified` 로 표시하지 말라고 한다.
그 확인은 이렇게 한다.

1. 배포된 주소를 브라우저로 연다.
2. 네트워크에 `api.vworld.kr/req/wmts/1.0.0/{key}/Base/{z}/{y}/{x}.png` 요청이 **200** 으로
   뜨는지 본다. **요청 건수 0 은 키 미주입**이지 도메인 문제가 아니다 — 둘을 섞지 않는다.
3. 지도 좌상단 상태칩이 `VWorld 일반지도 연결 정상` 인지 본다(`tileloadend` 에서 갱신된다).
4. 타일이 거절되면 키가 아니라 **등록 도메인부터** 본다. 이때 상태칩은
   `VWorld ... 로딩 실패: 키·등록도메인을 확인하세요` 다.

## 3. 기상청

- 초단기실황의 `base_date`, `base_time`, `nx`, `ny`를 사용한다.
- 공공데이터포털 키는 Vercel Functions에서만 사용한다.
- 공식 실황이 수신되면 동일 관측유형의 Scenario 값을 교체한다.
- 결측된 수위·유량은 유지하여 현재상황 전체를 폐기하지 않는다.

## 4. 홍수통제소

- `HRFCO_STATION_MAP_JSON`에는 검증된 공식 관측소 코드만 입력한다.
- `data/seed/hydrology_station_candidates_seed.json`의 내부 코드와 공식 코드를 분리한다.
- 응답 필드명 차이는 Adapter의 다중 후보키로 정규화한다.
- 정확한 Endpoint 계약이 확인되기 전에는 Provider를 호출하지 않는다.

## 5. UNE RAG

- `/api/v1/integrations/une-rag-probe`는 OpenAPI 접근여부와 후보 경로만 반환하고 인증정보를 노출하지 않는다.
- 요청 필드명과 응답 배열경로는 환경변수로 조정한다.
- 검색 성공 후에도 문서명·페이지·Passage ID·내용이 모두 없는 결과는 근거로 사용하지 않는다.

## 6. 완료기준

- 각 Provider의 실제 응답 샘플을 보안정보 제거 후 Fixture로 저장한다.
- 실제 응답과 Fixture에 동일 Contract Test를 적용한다.
- 연계 실패 시 UI에 데이터 상태와 Fallback 근거가 표시된다.
