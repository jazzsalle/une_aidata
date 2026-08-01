# ADR-013. T3Q Event·Passage·온톨로지 호환 계층

## 결정
현행 유엔이 Domain Model을 유지하고 T3Q의 `DisasterEventMasterPassage`, `RefDisasterEventID`, `taxonomyCodes`, Passage lineage를 Provider/Adapter 계층에서 변환한다.

## 이유
T3Q 테스트 모듈은 구축 중이며 대외 API/MCP 규격이 미확정이다. 화면과 POC 개발을 중단하지 않으면서도 컨소시엄 정합성을 확보하려면 내부 객체를 확정되지 않은 스키마에 직접 종속시키지 않아야 한다.

## 결과
- `t3q_alignment_seed.json`과 JSON Schema 3종을 계약 기준선으로 사용한다.
- Event ID 양방향 변환과 T코드 prefix 매칭을 단일 모듈에서 처리한다.
- 홍수위험지역·위험저수지·풍수해개선지구는 LayerCatalog에 `pending`으로 등록한다.
- 대외 API/MCP 확정 전에는 Seed/Mock Fallback을 유지한다.
