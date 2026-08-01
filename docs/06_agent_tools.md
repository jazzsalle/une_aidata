# Agent Tool 정의

| Tool | 입력 | 출력 | 지도/화면 영향 |
|---|---|---|---|
| parse_disaster_situation | 사용자 문장 | CurrentSituation patch | 입력폼 채움 |
| match_disaster_criteria | situation_id | criteria matches | 현재판단 |
| find_priority_areas | situation_id | PriorityAreaResult | fit/highlight |
| search_similar_disaster_events | situation_id, filters | Event Top-K | 사례 레이어 |
| get_event_detail | event_id | Event+DamageRecovery+Evidence | 사건 패널 |
| get_risk_knowledge | spatial/hazard | RiskKnowledge | 계획·근거 |
| get_response_procedure | admin/hazard/level | ProcedureSet | 절차 탭 |
| get_satellite_assets | area/date | Asset list | 변화탐색 |
| get_flood_traces | event/area | FloodTrace list | 레이어 중첩 |
| open_evidence | evidence_id | Evidence | 원문 패널 |
| focus_map_feature | target_id | MapAction | 지도 이동 |
| generate_report_draft | situation/context | ReportDraft | 보고서 탭 |

모든 Tool은 JSON Schema 검증, 권한검사, timeout, correlation logging을 적용한다.
