# 24. T3Q 구조 기반 Mock 데이터 계약·화면·검색 시나리오

## 목적
T3Q 기술협력 없이도 현행 설계의 데이터 항목, 검색 기준, 지도 표현과 근거 구조를 개발·시연한다.

## 계약 객체
- Mock Event Master 3건: 지역별 Event ID, 재난유형, T코드, 상태, 위험요인
- Mock Passage 12건: 위험지식, 관측, 피해·복구, SOP; `RefDisasterEventID`로 Event 역참조
- Mock Ontology Relation: `ref_event`, `spatial`
- GIS 3종: 홍수위험지역 Polygon, 위험저수지 Point, 풍수해개선지구 Polygon

## 검색 흐름
사용자 질의 → 행정코드/T코드/SchemaType 필터 → Mock Passage 검색 → RefDisasterEventID Event 결합 → Event·Passage·lineage 표시.

## CQ 5문
CQ-01·02·04·05는 Mock 결과를 제공한다. CQ-03은 현 Mock에 산사태 Passage가 없음을 명시하여 데이터 미확보 처리 흐름을 검증한다.

## Provider 교체
화면은 공통 Domain Model만 사용한다. 향후 실제 T3Q 규격이 공개되면 `MockProvider`를 `T3qProvider + Mapper`로 교체하고 화면 코드는 유지한다.
