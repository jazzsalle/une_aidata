# Source v1.5.1 계약·추적성 패치

## 기준선
- Design: v1.8.1
- Source: v1.5.1
- Package: v1.5.1

## 보완 내용
1. 실제 `api/**/*.ts` 31개 Route를 OpenAPI 정본에 1:1 반영하였다.
2. 미구현 경로(`/events/{eventId}`, `/situation-views`)를 공식 계약에서 제거하였다.
3. Observation·DamageRecoveryRecord·ProcedureStep·SatelliteAsset·ReportDraft·Evidence·T3Q Event/Scenario Schema를 현재 Seed·TypeScript 계약과 동기화하였다.
4. `validate_openapi_contracts.py`와 `validate_json_schema_contracts.py`를 설계 종료 Gate에 추가하였다.
5. OpenAPI/JSON Schema의 문법 파싱과 실제 계약검증을 별도 Gate로 관리한다.

## 비차단 이관
React Production Build, Playwright, Vercel Preview는 패키지 의존성 설치가 가능한 개발환경에서 수행한다.
