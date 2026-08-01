# Implementation Report v1.2

## 결정
현재 T3Q 기술협력·API·MCP·대표응답을 개발 선행조건에서 제외하고 T3Q 구조 기반 Mock-first로 전환하였다.

## 구현
- 기존 v1.1 전체 자산 유지
- Mock Event Master 3건, Passage 12건, 관계 Seed
- CQ 5문 Mock 검색 시나리오·UI·API
- 홍수위험지역·위험저수지·풍수해개선지구 Mock GeoJSON 각 3건
- T3Q search-preview 외부호출 제거, `mock_contract` 응답
- Mock catalog/spatial/scenarios API
- ADR-015·docs/24·handoff v1.2

## 검증
- Functions TypeScript: 통과
- Python Smoke 전 항목: 통과
- 다중 페이지 접근성 구조: 통과
- 저장소 구조 검증: 통과
- Web build: 내부 npm 저장소의 @playwright/test 미제공으로 미실행

## 안전
모든 신규 Mock 객체는 `data_status=mock`, `official_data=false`, `is_prediction=false`이며 실제 T3Q·공식 위험정보·피해예측이 아니다.
