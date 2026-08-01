# 23. T3Q 연계 준비상태·CQ 커버리지·검색 미리보기

## 1. 목적
T3Q 테스트 모듈 분석 결과를 확정 API로 오인하지 않으면서도, 유엔이 POC2 설계가 주관기관의 Event 중심 메타·온톨로지·Passage 방향과 일치함을 화면·API·시험으로 입증한다.

## 2. 준비상태 6개 차원
1. 사건 식별: Event ID·상태·RefDisasterEventID
2. 재난유형: T3Q 간이코드·TTA T코드 prefix
3. Passage·lineage: SchemaType·원본 파일/시트/행·문서 페이지
4. CQ 5문: 데이터·검색·지도·근거·Fallback
5. 공간레이어: 홍수위험지역·위험저수지·풍수해개선지구
6. MCP Tool: 목록·inputSchema·output·오류·인증

상태는 `seed_ready`, `configured`, `verified`, `pending`, `error`를 사용한다. 주소나 키가 설정된 것만으로 `verified` 처리하지 않는다.

## 3. CQ 커버리지
각 CQ는 `required_schema_types`, `search_filters`, `screen_outputs`, `current_providers`, `blocking_items`, `fallback`을 갖는다. 현재 5문은 설계상 covered이나 실제 T3Q Passage·공간데이터·관측소 매핑이 없으므로 runtime은 partial이다.

## 4. 검색 미리보기
`POST /api/v1/t3q/search-preview`는 실제 계약 수신 전 Mapper와 화면을 검증하기 위한 Endpoint다.
- T3Q URL과 검색경로가 설정되면 실제 호출을 시도한다.
- 응답 필드는 설정형·휴리스틱 Mapper로 Event/Passage 계약에 정규화한다.
- 미설정 또는 호출 실패 시 과거사례 Seed를 T3Q 계약 형태로 변환한다.
- Seed 응답에는 실제 T3Q 데이터가 아니라는 경고를 반드시 포함한다.

## 5. 협의 완료 게이트
- Event/Passage 대표응답 각 5건
- taxonomyCodes prefix 검색
- 정형·비정형 lineage 역추적
- CQ 5문 근거·지도 동작
- 신규 공간 3종 좌표계·Geometry·속성·공개등급
- MCP Tool 3종 정상·오류·타임아웃
