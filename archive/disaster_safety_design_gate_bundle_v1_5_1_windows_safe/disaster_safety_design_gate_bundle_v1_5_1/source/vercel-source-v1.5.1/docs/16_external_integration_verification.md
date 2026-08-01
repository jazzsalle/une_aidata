# 외부연계 검증 상세

## 1. 목적

VWorld, 기상청, 홍수통제소, UNE RAG를 실제 운영 Provider로 전환하기 전에 설정·통신·계약·데이터 의미를 단계적으로 검증한다.

## 2. VWorld

- 브라우저 키는 `VITE_VWORLD_MAP_KEY`에서만 읽는다.
- 일반지도와 영상지도를 독립 TileLayer로 구성한다.
- 타일 성공 전에는 `verified`로 표시하지 않는다.
- 오류 시 키 자체가 아니라 허용 도메인, API 권한, URL 경로를 점검하도록 안내한다.

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
