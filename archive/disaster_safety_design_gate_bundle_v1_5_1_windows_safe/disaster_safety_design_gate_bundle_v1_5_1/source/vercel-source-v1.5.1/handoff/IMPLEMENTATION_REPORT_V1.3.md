# Source v1.3 구현보고

- 기준일: 2026-08-01
- Provider-neutral 계약/Adapter 경계 추가
- Event Provider Stub과 Mock Event Provider 선택 구조 추가
- Mock Event 3건 -> 15건 확장 (ACTUAL_BACKED 9, SYNTHETIC_DEMO 6)
- Passage 73건 및 ref_event 관계 73건 생성
- 재난유형별 Versioned Weight Profile 4종
- 요인별 점수·기여도·비교커버리지·신뢰상태·대응조치 비교 구현
- T3Q/Open API 요구 콘텐츠 목록과 JSON Schema/OpenAPI Endpoint 추가
- 외부 T3Q/API 호출은 수행하지 않으며 현재 기본 Provider는 mock
