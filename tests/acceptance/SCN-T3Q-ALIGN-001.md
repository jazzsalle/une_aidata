# SCN-T3Q-ALIGN-001 — T3Q 정합 E2E 수용시험

1. `HEAVY_RAIN`, 일자, 5자리 행정코드, 순번을 T3Q Event ID로 변환한다.
2. T코드 상위 prefix 선택 시 하위 코드가 검색 후보에 포함되는지 확인한다.
3. Event 상세에서 `RefDisasterEventID`로 관련 Passage 근거를 조회할 수 있는 계약을 확인한다.
4. 근거에는 Passage ID와 파일·시트·행 또는 문서·페이지 lineage가 포함되어야 한다.
5. CQ 5문 각각에 대응하는 화면·검색 대상이 매핑되어야 한다.
6. 홍수위험지역·위험저수지·풍수해개선지구는 `연계대기`로 표시되고 임의 도형을 표출하지 않는다.
7. T3Q API/MCP 미설정 시 Seed/Mock Fallback과 `pending` 상태가 화면에 표시되어야 한다.
8. 유사사례 결과는 AI_SIM/Event 유사도이며 문서 관련도 점수와 분리되어야 한다.
9. 보고서는 Draft이고 NDMS 자동제출·피해예측이 없어야 한다.
