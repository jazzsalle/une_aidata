# 재난안전 POC v0.4 Seed Data

이 디렉터리의 자료는 설계·개발·시연용 Seed/Mock 데이터이다. 실제 관측자료, 공식 위험도, 피해예측 결과, NDMS 자료 또는 대상 지자체의 공식 행동절차가 아니다.

## v0.4 확정 원칙

- 현재 상황은 사용자 입력과 공개 공공 API를 결합하여 구성한다.
- 공공 API 미연계·장애 시 Scenario Provider로 동일 스키마의 데이터를 제공한다.
- 지자체 시스템 Context 수신과 CCTV는 POC 범위에서 제외한다.
- 피해·복구 정보는 향후 T3Q가 제공할 NDMS 기반 데이터의 연계를 검증하기 위한 임의 Seed이다.
- 피해·복구 Seed는 과거 유사사례 참고와 보고서 초안 구조에만 사용하며 현재 피해예측으로 표시하지 않는다.
- VWorld 키는 발급 완료되었으며 실제 키는 환경변수 또는 비밀관리에서만 설정한다.

## 파일

- `public_api_catalog_seed.json`: 최소 실시간 연계 대상 공공 API와 Provider·인증상태
- `current_situations_seed.json`: 사용자 입력+공공 API 응답을 모사한 의왕·구미·남원 현재상황
- `priority_areas_seed.json`: 현재 조건을 반영한 우선 확인지역 POC 상대순위
- `damage_recovery_events_seed.json`: 향후 T3Q/NDMS 데이터 교체를 위한 피해·대응·복구 임의 Seed
- `report_draft_seed.json`: 담당자 검토용 상황보고서 초안 예시
- `satellite_assets_seed.json`: 취약지역별 불규칙 시점 위성영상 메타데이터 예시
- `response_procedures_seed.json`: 부산 북구청 풍수해 행동매뉴얼을 참고한 잠정 공통 대응절차
- `layer_catalog_seed.json`: 지도 레이어·Provider·공개등급
- `scenario_timelines_seed.json`: 대표 시연 시나리오

## 교체 우선순위

1. 공공 API 활용신청 후 기상특보·강우·수위·유량 Provider 연결
2. 쓰리디랩스 위성·변화탐지 자료 연결
3. 의왕·구미·남원 정식 풍수해 행동매뉴얼 연결
4. T3Q Event 및 NDMS 기반 피해·대응·복구 데이터 연결

모든 화면과 보고서에는 `actual`, `derived`, `scenario`, `mock_seed`, `provisional_reference` 상태를 표시한다.

- `satellite_assets_seed.json`: PRE(-12일)/EVENT(시작~종료+2일)/POST(종료+12일) 256×256 위성영상·수계마스크 외부지역 시연 표본 포함.


## v1.2 Mock-first additions
- `t3q_mock_event_master_seed.json`
- `t3q_mock_passages_seed.json`
- `t3q_mock_ontology_relations_seed.json`
- `t3q_mock_search_scenarios_seed.json`
- `mock_flood_risk_areas.geojson`
- `mock_dangerous_reservoirs.geojson`
- `mock_storm_flood_improvement_districts.geojson`

All items are demonstration-only Mock data and must not be interpreted as official T3Q or disaster-risk data.

- v1.3: provider_contracts_seed.json, similarity_weight_profiles_seed.json, 15-event expanded dataset
