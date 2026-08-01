# evaluation_criteria.md — Phase별 합격 기준

evaluator는 각 항목을 실제 실행/확인으로 검증한다. 전 항목 충족 시에만 PASS.
공통 불변 조건(모든 Phase): `git diff`에 contracts/openapi, contracts/schemas, data/seed의 ID·구조 변경, server/contracts.ts·apps/web/src/types/contracts.ts 계약 변경이 없어야 한다.
(Windows: `python3` 미존재 시 `python`, `.sh`는 Git Bash로 실행해 판정한다.)

## Phase 1 — 기준선 재현·빌드 정상화
- [ ] `npm install` 성공, `package-lock.json` 생성·커밋 대상에 존재
- [ ] `npm run validate` PASS (validate_vercel_repo.py)
- [ ] `npm run test:contracts` PASS (OpenAPI 31 Operation + JSON Schema 검증)
- [ ] `npm run typecheck:functions` 에러 0
- [ ] `npm run test:runtime-gate` PASS
- [ ] `npm run test:provider-conformance` PASS
- [ ] `npm run typecheck:web` 에러 0
- [ ] `npm run build` (React Production Build) 성공, `apps/web/dist` 산출물 존재
- [ ] 수행 결과·변경 파일·잔여 오류가 보고서로 정리됨 (첫 지시문 6항)

## Phase 2 — /dashboard Mock/Seed 사용자 흐름 완성
- [ ] `/` 대시보드가 Mock/Seed 데이터로 진입~조회 흐름 완결 (콘솔 에러 0)
- [ ] 우선 확인지역 점수를 공식 위험등급·피해확률로 표현하지 않음
- [ ] document.title·h1 초점 갱신 등 v0.5 UI 규칙 준수
- [ ] `npm run typecheck` + `npm run test:contracts` 재통과

## Phase 3 — /evidence PRE/EVENT/POST 및 근거 선택 흐름 완성
- [ ] PRE(-12d)/EVENT(+2d)/POST(+12d) phase 선택 규칙 동작 (offset_days_from_target, selection_reason 표시)
- [ ] 위성영상·수계마스크 256×256 독립 타일 표출, VWorld 지도 오버레이 없음
- [ ] 근거 선택 상태가 보존되어 /report로 전달 가능
- [ ] mock/seed 표시(official_data=false 등) 유지
- [ ] `npm run typecheck` + 관련 smoke 재통과

## Phase 4 — /report 선택 근거·유사도·대응비교 연계
- [ ] /evidence에서 선택한 근거가 보고서에 반영됨
- [ ] 유사사례(SimilarEvent)·대응비교 연계 표시, Passage는 evidence로 부착
- [ ] Seed Fallback을 T3Q 실데이터로 표시하지 않음
- [ ] `npm run typecheck` + `npm run test:contracts` 재통과

## Phase 5 — Playwright E2E
- [ ] `@playwright/test` 설치 및 브라우저 준비 완료
- [ ] `tests/e2e/accessibility-navigation.spec.ts` PASS
- [ ] 3페이지 직접 URL·새로고침·뒤로가기 시나리오 E2E 통과

## Phase 6 — Vercel Preview 배포 + VWorld 허용 도메인
- [ ] Vercel Preview 배포 성공 (URL 확보)
- [ ] `/`, `/evidence`, `/report` 직접 URL·새로고침 동작 확인
- [ ] VWorld 허용 도메인 등록 확인, 키는 환경변수로만 주입 (verified 표기는 브라우저 타일 성공 확인 후에만)

## Phase 7 — 외부 Provider별 Fixture 연계
- [ ] 도메인별 Fixture가 `server/providers` 격리 구조로 연계됨 (실제 API 호출 없음)
- [ ] Provider 상태가 FIXTURE_VALIDATED로 기록됨 (한 번에 DEFAULT 전환 금지)
- [ ] `npm run test:provider-conformance` 재통과

## Phase 8 — 실제 Provider Shadow Test 및 승격
- [ ] SHADOW_TESTED → SELECTABLE 단계별 승격 절차 준수 (승격마다 사용자 승인)
- [ ] 실제 연계값에 official_data=true, value_status=actual, 관측시각·Provider 보유
- [ ] 연계 실패가 서비스 전체 오류가 아닌 연계별 Fallback으로 처리됨
- [ ] 화면·보고서·Fallback 회귀시험 재통과
