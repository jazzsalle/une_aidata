# PROGRESS.md — 회사↔집 인계 기록

> **이 파일은 "지금 무엇을 해야 하는지"만 담는다.** 완료 기록은 `docs/PROGRESS_ARCHIVE.md` 에 원문 그대로 있다.
> SessionStart 훅(`.claude/scripts/load_progress.sh`)이 이 파일에서 재개용 절만 뽑아 주입하므로,
> 완료 이력을 여기에 계속 쌓으면 정작 필요한 절이 잘려 나간다(2026-08-09 실제로 그랬다).

## Last updated
2026-08-09 집 PC — `/doctor` 정리(안 쓰는 MCP 연결 해제, CLAUDE.md 중복·낡은 문단 정리, SessionStart 훅 섹션 선별 수정) 후 이 파일을 완료 기록과 분리.
직전: 중복 추출 스크립트 삭제(PR #8), 인계문서 잔여 버그 4건 + 검증 게이트 3건(PR #7), 국가기본도 하천 3종 반입·기존 seed 제거(PR #6), GM-A-01→GM-A-04 seed 교체(PR #5).

## Current goal
Phase 8 — 실제 Provider Shadow Test 및 단계별 승격 (합격 기준: evaluation_criteria.md Phase 8, 승격마다 사용자 승인 필요)

## 완료 요약 (상세 원문은 `docs/PROGRESS_ARCHIVE.md`)
- **Phase 1~7 완료** (2026-08-02, 전 Phase evaluator PASS) — 기준선·대시보드·근거·보고서·E2E·Vercel 배포·Provider Fixture
- **2026-08-03** 시범화면 UI 디자인 반영 1~3차(핸드오프 → 패널 스펙 → UNE DS 토큰), POC 접근성 범위 확정(화면낭독기·WCAG AA 는 본 개발에서 재검토), 보고서 수치 → 지표 표 렌더
- **2026-08-07** GM-A-01 → GM-A-04 seed 교체(PR #5), 하천 레이어 정합 조사(결론: 우리 변환은 정상, 데이터셋 교체 필요)
- **2026-08-08** 국가기본도 하천 3종(실폭·경계·중심선) 반입 + 하천명 POI 레이어, 기존 seed(`geo.json` L2) 제거(PR #6) / 인계문서 잔여 버그 4건 + 검증 게이트 3건(PR #7)
- **2026-08-09** 중복 추출 스크립트 삭제(PR #8), `/doctor` 정리(PR #9), HRFCO 공식 관측소 코드 후보 조사(PR #10), **전국 관측소 레이어**(수위 1,352 · 강수 820)
- **배포**: https://une-aidata-web.vercel.app (GitHub main 자동 배포)

## 서비스 범위 (2026-08-09 사용자 확인)
- **시범서비스 대상은 전국이다. 검증만 부산·인제·영천이다.** 지금 의왕·구미·남원을 쓰는 건 그 3개 지역 계획자료가 아직 없어서다.
- 따라서 새로 들이는 자료는 가능하면 **전국 단위**로 넣는다. 관측소 레이어가 첫 사례이고, 이미 부산(수위 31)·인제(19)·영천(24)을 포함한다.
- 지역별로 잘라야 하는 자료(하천 3종 등)는 대상 지역이 확정되면 같은 스크립트로 다시 뽑는다.
- **[백로그 · 2026-08-10 사용자 방향] 지역 선택을 별도 검색창으로 바꾼다.** 관측소는 전국이 깔렸는데 지도는 여전히 3개 지역만 오간다. 지금은 착수하지 않는다.
  - 고정 지점: `VWorldMapAdapter.CENTERS`(3개 좌표) · `geo.json` L3(3개 경계) · `current_situations_seed.json`(3개 상황) · 헤더의 `.context-select`
  - 지도 이동 자체는 좌표만 있으면 되므로 검색은 VWorld 지오코딩이나 행정경계 자료로 붙일 수 있다. **다만 상황(situation)은 seed 계약이라 지역을 늘리는 것과 검색으로 이동만 하는 것은 다른 범위다** — 착수 전에 어디까지인지 먼저 정한다.
  - 검색으로 3개 지역 밖으로 이동하면 위험지구·하천·상황이 비게 된다. "이 지역은 계획자료 미확보" 안내가 함께 필요하다. 관측소는 전국이라 그대로 보인다.

## In progress
- **Phase 8** — 코드측 승격 준비는 100% 끝났다. Shadow 하네스(`npm run test:provider-shadow -- --provider <id>`), 승격 절차(`docs/29`), 승격 원장(`tests/provider/provider_promotion_status.json`)과 그 검사 게이트(`npm run test:promotion-status`)가 모두 있다.
  - `une_rag` = **SHADOW_TESTED** (승인 1 완료). SELECTABLE 은 **보류** — 내부망(사내 IP)이라 외부 시연에서 접근 불가, 당분간 Seed 검색 유지. Vercel env 에 `UNE_RAG_*` 설정 금지 상태.
  - 나머지 5종 = **FIXTURE_VALIDATED**. t3q 3종은 실 Endpoint 미확정으로 `promotion_hold`.
  - **실제 연결된 Provider 는 없으며 배포본은 전부 Seed/Mock 동작.**
- 승인 없이 진행 가능한 코드 작업은 현재 없다. 아래 Next steps 는 전부 사용자 조치가 선행 조건이다.

## Pending — 데이터 수령 대기
- **타이포 스케일 확정**: 현재 크기는 상황실 원거리 시인성 전제의 잠정값(1920px 본문 17.7px). 접근성 요구가 아니라 설계 판단이며, 디자인 실험실 산출물(type scale) 수령 후 `styles.css` `:root`의 `--fs-*` clamp 5개 + 확대 브레이크포인트 루트 배율 3개만 교체하면 됨. 상세: `docs/30_design_system_handoff.md` B-7
- **부산·인제·영천 계획자료 구조화**: 사용자가 자연재해저감 종합계획·하천기본계획 **PDF를 추후 제공** 예정. 수령 후 `data/reference/districts.json`·`rivers.json`·`geo.json`과 동일 스키마로 전사하면 지도 POI 팝업·계획·근거 패널이 그대로 동작한다(코드 변경 불필요). 현재는 의왕 41430(17지구)·구미 47190(6지구)·남원 45190(6지구) + 하천 3개(안양천·구미천·요천)만 커버.
- 참고: 원시 xlsx(`메타데이터 참고자료(T3Q)/`)에는 전국 재해대장 115,563행·위험지구 약 6,300지구가 있으나 **위험요인 서술·임계값·근거 문서페이지·좌표가 없어** 팝업 수준의 정보를 만들 수 없다(그 정보는 저감계획 PDF 판독에서 나옴). 재해대장은 피해금액·복구비 보강용으로 조인 가능.

## Pending approval
- 없음. **GM-A-01 seed 불일치는 2026-08-07 승인으로 해소**(PR #5 머지 · `GM-A-04 구미천지구`로 참조 교체, 스모크 S8/S9 재구성으로 미존재 ID 가드 보존).

## Next steps (Phase 8 잔여 — provider별 독립 진행, 전부 사용자 조치 선행)
1. **kma_nowcast (가장 간단, 권장 1순위)** — 이 키 하나면 그날 Shadow Test → 승인1까지 간다.
   - 공공데이터포털에서 **기상청_단기예보((구)_동네예보) 조회서비스** 활용신청 → 마이페이지 → 오픈API → 개발계정에서 **일반 인증키(Decoding)** 확인
   - 리포 루트 `.env` 에 `DATA_GO_KR_SERVICE_KEY=<키>` 한 줄. **키를 채팅·코드·문서에 남기지 않는다.**
   - 실행: `node tests/provider/provider_shadow_gate.cjs --provider kma_nowcast` (PowerShell 에서 npm 스크립트로 돌리면 bash 가 WSL 로 잡힐 수 있다 — Blockers 참고)
   - **함정 2가지**: 신규 키는 활용신청 승인 반영 전 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR(30)` → 시간 두고 재시도. 기상청 발표 시각 전이면 `NO_DATA(03)` → `KMA_REQUEST_LAG_MINUTES` 를 60~70 으로 올려 재시도(코드 변경 불필요).
   - 결과 검토 → 승인1(SHADOW_TESTED) → Vercel Preview env 설정(승인2)·회귀 재통과 → SELECTABLE
2. **hrfco_hydrology** — **후보 조사 완료(2026-08-09), 상세: `docs/31_hrfco_station_candidates.md`**
   - WAMIS 오픈API(인증키 불필요)로 전국 수위관측소 1,360개를 받아 좌표·유역면적으로 대조했다.
   - **45190 남원 → `4005670` 남원시(동림교)** (요천, 유역 317.09 km²). 계획 지점 `Y4 남원수위표`(315.70)와 **0.44% 차이** — 사실상 같은 지점.
   - **47190 구미 → `2011631` 구미시(도량교)** (구미천, 40.46 km²). 소권역 전수 확인 결과 **구미천 위 유일한 공식 관측소**. 다른 구미시 관측소는 전부 낙동강 본류·한천이라 이름만 보고 고르면 틀린다.
   - **41430 의왕 → 공식 관측소 없음.** 안양천 소권역 전수 4개가 모두 의왕 하류이고, 최상류(`1018690` 111.52 km²)조차 계획 최하류 `AY00`(88.16)보다 하류다. **규칙 4 대로 비워 두고 호출하지 않는다.**
   - 남은 확정 절차: ① 키로 HRFCO 자체 관측소 목록과 `obscd` 대조 ② `4005670` ↔ `Y4 남원수위표` 동일 지점 확인(관측소명이 '동림교'로 다름). 그 뒤 `HRFCO_STATION_MAP_JSON` 투입 → Shadow Test.
3. **une_rag**: 외부 접근 가능한 Endpoint 확보 시 승인2(SELECTABLE) 재검토. 경로 추정 금지 — Swagger probe(`/api/v1/integrations/une-rag-probe`) 먼저(v0.7 규칙 5).
4. **t3q 3종**: 실 Endpoint·인증 계약 확정 전까지 `promotion_hold` — Phase 8 승인 대상 아님.
5. **공통 주의**: 키는 **로컬 셸 env 로만**. Vercel env 설정은 그 자체가 SELECTABLE 승격 행위라 승인2 이후 사용자가 직접 한다. DEFAULT 전환 금지. 상세 절차: `docs/29_provider_shadow_and_promotion_procedure.md`

## Blockers
- **PowerShell 에서 `.sh` 게이트 실행 주의 — Phase 8 주 실행 경로에 직접 걸린다.** `npm run test:provider-shadow` = `bash scripts/run_provider_shadow_test.sh` 이고 그 `:10` 이 `rm -rf .runtime-cjs` 를 한다. bash 가 WSL 로 잡히면 `.runtime-cjs` 가 삭제된 채 재컴파일에 실패할 수 있다. 우회: Git Bash 에서 `tsc -p tsconfig.runtime.json` + `.runtime-cjs/package.json`(`{"type":"commonjs"}`) 확인 후 `node tests/provider/provider_shadow_gate.cjs --provider <id>` 직접 실행.
- (해소됨) `jsonschema` 미설치로 `test:contracts` 절반 실행 불가 → 설치 완료. 실측 `PASS JSON Schema contracts: 265 objects / 18 schemas`.
- (해소됨) @playwright/test 404 재발 없음 — 1.62.1 설치 완료.

## How to run
- 의존성: `npm install` (Node >= 22.12.0) + `python -m pip install -r requirements.txt` + `python -m playwright install chromium`
- 검증: `npm run validate` → `npm run test:contracts` → `npm run typecheck` → `npm run test:runtime-gate` → `npm run test:provider-conformance` → `npm run test:promotion-status`
- 콘솔 스모크 3종: `python scripts/smoke_dashboard_console.py` · `npm run test:evidence-console` · `npm run test:report-console` / E2E: `npm run test:e2e`
- 빌드: `npm run build` / 개발: `npm run dev:web`
- Windows: `python3` 대신 `python`, `.sh` 는 Git Bash 로 실행
