# API 계약

정본은 `contracts/openapi/poc-backend.yaml`과 `contracts/contracts/schemas/`이다.

## 공통 규칙

- `/api/v1`
- ISO 8601 + UTC offset
- 공통 Envelope: data/meta/warnings/errors
- data_status 필수
- provider/fallback_used 필수
- 공간은 GeoJSON
- 외부 Provider 원 응답은 화면에 직접 노출하지 않음


## Source v1.5.1 계약 기준선

- Backend OpenAPI 정본: `contracts/openapi/poc-backend.yaml`
- JSON Schema 정본: `contracts/schemas/*.schema.json`
- 실제 Vercel Function: `api/**/*.ts`의 31개 Route
- Endpoint 정합시험: `python3 scripts/validate_openapi_contracts.py`
- Seed·Schema 계약시험: `python3 scripts/validate_json_schema_contracts.py`
- 문법 파싱 통과와 데이터 계약 적합성 통과를 구분하며, 설계 종료 Gate에서는 두 시험이 모두 PASS해야 한다.
