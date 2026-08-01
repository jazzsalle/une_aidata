# 22. T3Q 메타·온톨로지 정합 매핑 및 구현계약

## 1. 적용 원칙
- T3Q 테스트 모듈 분석내용은 확정 API 규격이 아니라 `provisional/pending` 설계근거다.
- 현행 화면·검색·보고 구조는 유지하고 Event ID, taxonomy, Passage, lineage, 관계유형을 Adapter 계층에서 정합시킨다.
- POC1 비교는 설계근거로 사용하지 않는다.
- CCTV·피해예측·NDMS 자동제출은 구현하지 않는다.

## 2. 화면·검색 핵심 매핑
| T3Q 요소 | 유엔이 계약 | 화면/검색 적용 |
|---|---|---|
| DisasterEventMasterPassage | `T3qEventMaster`, `DisasterEvent` | 유사사례 카드, 사건 상세, 보고서 사건 참조 |
| RefDisasterEventID | `ref_disaster_event_id` | Event 상세에서 관련 Passage 역조회 |
| taxonomyCodes | `hazards`, `taxonomy_codes` | T코드 prefix 필터와 유형 배지 |
| Passage | `T3qPassage`, `EvidenceItem` | RAG 근거, 원문·페이지·행 계보 |
| FloodVulnerableZonePassage | 위험지구/하천 상세 | 계획홍수량·수위·제방고·참조관측소 |
| MonitoringPoint/WaterLevel | Observation/관측소 | CQ-04, 단계별 제공수위 |
| AI_SIM | SimilarEvent | Event 유사도와 문서 관련도를 분리 |

## 3. 공간 레이어 연계대기
`홍수위험지역`, `위험저수지`, `풍수해개선지구`는 LayerCatalog와 화면에 연계대기 상태로 등록한다. Geometry·속성·좌표계·공개등급이 확정되기 전에는 임의 도형을 생성하지 않는다.

## 4. Provider 교체
| 현재 | 목표 | 상태 |
|---|---|---|
| Static/Local 위험지구 | T3qHazardZoneProvider | pending |
| StaticSimilarEventProvider | T3qEventPassageProvider | pending |
| StaticDamageRecoverySeedProvider | T3qNdmsDamageRecoveryProvider | pending |
| StaticProcedureProvider | T3qPolicySopProvider | pending |
| LocalGeoJsonProvider(신규 3종) | T3qSpatialProvider | pending |
| UneRagProvider | T3qRagPassageProvider 또는 협의 API | pending |

## 5. 완료 게이트
1. Event ID/RefDisasterEventID 대표응답 검증
2. taxonomyCodes prefix 검색 검증
3. Passage lineage 파일·시트·행 또는 문서·페이지 검증
4. CQ 5문에 필요한 도메인 Passage 커버리지 검증
5. 신규 공간레이어 Geometry·속성·공개등급 검증
6. Tool 목록·inputSchema·output·오류응답 검증
