재난안전 AI데이터 활용 시범서비스 설계 Gate 통합패키지 v1.5.1

기준선
- 통합설계서: v1.8.1
- 소스: v1.5.1
- 설계 종료 판정: PASS
- OpenAPI: 실제 Route 31개 = Operation 31개
- JSON Schema: 18종 / Seed·Fixture·Runtime 260개 객체 PASS
- Runtime Regression: 15 Event·5 Situation·CQ 5문 PASS
- Provider 계약 적합성: 8개 케이스 예상판정 일치
- 실행모드: Mock / Provider-neutral
- 실제 T3Q·공공 Open API 호출: 수행하지 않음
- 글로드코드 개발 인계문서: 포함

주요 폴더
- design: 최종 통합설계서
- source: Vercel Source 전체
- evidence/runtime_regression: 런타임 회귀시험 증빙
- evidence/provider_conformance: Provider 계약시험 증빙
- evidence/contract_traceability: 최초 FAIL과 보완 후 PASS 추적성 결과
- handoff: 글로드코드 개발 인계문서 및 기준선 Manifest

개발환경 잔여 Gate
- npm 의존성 설치와 package-lock.json 생성
- React Type Check / Production Build
- Playwright E2E
- Vercel Preview 배포
- 실제 T3Q·공공 API 대표응답 Fixture 및 Shadow 시험
