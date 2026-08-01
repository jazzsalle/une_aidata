# ADR-016 Provider-neutral 계약과 Mock Event 확장

- 결정: Mock/Seed를 향후 T3Q/Open API 응답계약의 선행 구현으로 사용한다.
- 구조: Source Provider -> Adapter/Mapper -> Common Domain Model -> UI/Search/Report.
- 화면은 공급자 원천 스키마에 직접 의존하지 않는다.
- Event Seed는 3건에서 15건으로 확장한다: 문서근거 기반 9건, 합성 시연 6건.
- 합성자료는 `data_status=synthetic_demo`, 문서근거 구조화 자료는 `actual_backed`로 구분한다.
- T3Q/Open API가 제공되면 Provider와 Mapper만 교체하고 기존 화면 계약을 유지한다.
