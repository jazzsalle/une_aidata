# Development Handoff v1.1 — T3Q 연계 준비상태·CQ 커버리지

## 추가사항
- `/api/v1/t3q/readiness`: 6개 정합 차원과 완료 게이트
- `/api/v1/t3q/cq-coverage`: CQ 5문 데이터·검색·화면·차단항목
- `/api/v1/t3q/search-preview`: 설정형 Event/Passage 검색 + Seed Fallback
- `T3qReadinessPanel`: 컨소시엄·발주처 협의용 화면
- Schema 3종, Seed 3종, ADR-014, 수용시험

## 실제 연계 전 입력
- T3Q Event 검색 경로
- T3Q Passage 검색 경로
- 인증 헤더·Scheme·키
- 응답 배열 경로와 필드 샘플
- MCP Tool 목록·스키마
- 공간레이어 3종 계약

## 금지
- URL·키만 설정된 상태를 검증 완료로 표시하지 않는다.
- Seed Fallback을 T3Q 실데이터로 표시하지 않는다.
- 공간계약 전 임의 Geometry를 생성하지 않는다.
## 검증 기준선
- Functions TypeScript와 Python Smoke는 통과했다.
- Web workspace 검증은 React 계열 의존성 설치 후 재수행한다.
- `contracts/openapi/poc-backend.yaml`의 버전은 1.1.0이며 T3Q alignment/readiness/cq-coverage/search-preview 경로를 포함한다.
