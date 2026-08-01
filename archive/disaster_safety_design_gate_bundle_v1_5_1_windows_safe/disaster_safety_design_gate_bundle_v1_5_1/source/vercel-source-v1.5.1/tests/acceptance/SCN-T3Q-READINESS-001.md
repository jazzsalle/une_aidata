# SCN-T3Q-READINESS-001 T3Q 준비상태·CQ 커버리지

## 사전조건
- T3Q API/MCP 환경변수 미설정
- Seed 직접사용 여부와 무관하게 Functions API 호출 가능

## 절차
1. `/api/v1/t3q/readiness`를 조회한다.
2. 6개 준비상태 차원과 완료 게이트가 반환되는지 확인한다.
3. `/api/v1/t3q/cq-coverage?admin_code=45190`를 조회한다.
4. CQ-01~05가 각각 화면출력·현재 Provider·차단항목·Fallback을 갖는지 확인한다.
5. `/api/v1/t3q/search-preview`에 남원·T10206 검색을 요청한다.

## 수용기준
- API/MCP 미설정 상태가 `verified`로 표시되지 않는다.
- CQ 5문이 모두 존재하며 runtime 상태가 partial 또는 pending으로 표시된다.
- 검색 미리보기는 `mock_contract`이며 외부호출 없는 UNE Mock 데이터라는 경고가 포함된다.
- Event ID는 T3Q 형식을 따르고 Passage에는 lineage 객체가 존재한다.
- 홍수위험지역·위험저수지·풍수해개선지구는 pending 상태를 유지한다.
