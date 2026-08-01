# ADR-015. T3Q 구조 유지·Mock-first 런타임

## 결정
현재 T3Q로부터 API, MCP, 대표응답, 필드명세 등 기술협력을 받을 수 없으므로 외부호출을 개발 선행조건으로 두지 않는다. T3Q 분석에서 확인한 Event Master, Passage, RefDisasterEventID, taxonomyCodes, lineage 구조는 내부 Domain Contract로 유지하고, 모든 화면·검색·GIS 3종은 UNE Mock/Seed로 동작한다.

## 구현
- `T3Q_RUNTIME_MODE=mock_only`
- Mock Event 3건, Passage 12건, 관계·CQ 5문
- 홍수위험지역·위험저수지·풍수해개선지구 Mock GeoJSON
- `/api/v1/t3q/search-preview`는 외부호출 없이 Mock 계약 검색
- 향후 T3Q 규격이 확정되면 Provider/Adapter만 교체

## 안전장치
Mock 결과는 `data_status=mock`, `official_data=false`, `is_prediction=false`와 화면 배지를 필수로 한다.
