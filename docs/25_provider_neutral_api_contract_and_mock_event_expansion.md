# Provider-neutral API 계약 및 Mock Event 확장 (Source v1.3)

## 목적
Mock/Seed 항목을 향후 T3Q 또는 Open API에 요구할 요청·응답 항목의 기준으로 고정한다.

## Provider 경계
`EVENT_PROVIDER`, `RISK_PROVIDER`, `OBSERVATION_PROVIDER`, `SPATIAL_PROVIDER` 환경변수로 공급자를 선택한다. 화면과 보고서는 공통 Domain Model만 사용한다.

## Event 확장
- 전체 15건
- ACTUAL_BACKED 9건: `districts.json` 피해이력과 Passage 근거를 사용하며 미확보 피해수치는 null/NOT_AVAILABLE
- SYNTHETIC_DEMO 6건: 유사도 요인·대응비교·산사태/태풍 시나리오 검증용

## API 요구 콘텐츠
Event API는 사건ID, T코드, 지역·기간, 조건, 피해·대응·복구, 요인별 유사도, 근거 Passage, 공간객체를 제공할 수 있어야 한다. Observation API는 관측소 코드·좌표·값·단위·시각·품질·출처를 제공해야 한다. Spatial API는 객체ID·레이어·Geometry·CRS·속성·기준일·근거를 제공해야 한다.

## 점수 정책
유사도는 Versioned Profile로 산정하고 결측 요인은 제외 후 가중치를 재정규화한다. `event_similarity_score`와 `retrieval_relevance_score`를 분리하며 Graph는 미구축 시 `NOT_AVAILABLE`이다.
