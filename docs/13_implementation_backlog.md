# 구현 Backlog — Source v1.5 기준

## 완료
- Provider-neutral Event/Risk/Observation/Spatial 계약과 Mock/Seed 기본운영
- Mock Event 15건, Passage 73건, RefDisasterEventID 관계 73건
- 요인별 유사도·결측 재정규화·대응조치 비교·보고서 연계
- CQ 5문 구조검색·lineage·지도·보고서 회귀시험
- Source v1.4 Runtime Regression Gate
- Source v1.5 Provider 계약 적합성·혼합운영 Gate

## 설계 종료 전 확인
1. 통합설계서 v1.8과 Source v1.5 Schema/OpenAPI/시험결과 버전 정합
2. 화면·API·Domain Model·Seed·수용시험 추적성 최종 확인
3. Mock/Seed, Scenario, Synthetic, Actual, T3Q, Open API, Derived 표출상태 확정
4. 글로드코드 개발 인계문서는 설계 종료 선언 이후 작성

## 실제 개발환경 Gate
1. npm 의존성 설치 및 lock 파일 생성
2. React Type Check·Production Build
3. Playwright E2E·접근성·반응형 시험
4. Vercel Preview 배포와 환경변수 검증

## 외부 Provider 도착 후
1. 대표응답 Fixture 수신
2. Adapter/Mapper 구현 및 Provider Conformance Gate 통과
3. Shadow 시험
4. SELECTABLE 승인 후 환경변수 전환
5. 실제 Provider 화면·보고서 회귀시험
