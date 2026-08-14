# PROGRESS.md — 회사↔집 인계 기록

> **이 파일은 "지금 무엇을 해야 하는지"만 담는다.** 완료 기록은 `docs/PROGRESS_ARCHIVE.md` 에 원문 그대로 있다.
> SessionStart 훅(`.claude/scripts/load_progress.sh`)이 이 파일에서 재개용 절만 뽑아 주입하므로,
> 완료 이력을 여기에 계속 쌓으면 정작 필요한 절이 잘려 나간다(2026-08-09 실제로 그랬다).

## Last updated
2026-08-14 — 소하천구역·전국하천표준데이터를 6개 지역(구미·의왕·남원·부산·인제·영천)으로 반입하고, 백로그였던 **지역 검색창**을 지도 전용 지역 선택기 + 하천명 검색으로 구현했다. 마우스 오버 텍스트 태그 추가.
앞서: 2026-08-12 하천 등급 3종 범위 확정·실폭/경계 등급 공간조인(PR #18), kma_nowcast SHADOW_TESTED(PR #13), 하천 경합 버그(#14), 행정코드 경계면 변환표(#15), 참조 GeoJSON 게이트(#16).
**실제 연결된 Provider 는 여전히 없다** — 배포본은 전부 Seed/Mock 이다. 아래 "진행에 필요한 것" 참고.

## Current goal
Phase 8 — 실제 Provider Shadow Test 및 단계별 승격 (합격 기준: evaluation_criteria.md Phase 8, 승격마다 사용자 승인 필요)

## 완료 요약 (상세 원문은 `docs/PROGRESS_ARCHIVE.md`)
- **Phase 1~7 완료** (2026-08-02, 전 Phase evaluator PASS) — 기준선·대시보드·근거·보고서·E2E·Vercel 배포·Provider Fixture
- **2026-08-03** 시범화면 UI 디자인 반영 1~3차(핸드오프 → 패널 스펙 → UNE DS 토큰), POC 접근성 범위 확정(화면낭독기·WCAG AA 는 본 개발에서 재검토), 보고서 수치 → 지표 표 렌더
- **2026-08-07** GM-A-01 → GM-A-04 seed 교체(PR #5), 하천 레이어 정합 조사(결론: 우리 변환은 정상, 데이터셋 교체 필요)
- **2026-08-08** 국가기본도 하천 3종(실폭·경계·중심선) 반입 + 하천명 POI 레이어, 기존 seed(`geo.json` L2) 제거(PR #6) / 인계문서 잔여 버그 4건 + 검증 게이트 3건(PR #7)
- **2026-08-09** 중복 추출 스크립트 삭제(PR #8), `/doctor` 정리(PR #9), HRFCO 관측소 코드 후보 조사(PR #10), **전국 관측소 레이어**(PR #11, 수위 1,352 · 강수 820)
- **2026-08-10~11** kma_nowcast **SHADOW_TESTED**(PR #13, 격자좌표 2건 수정 포함) · 하천 지연로딩 경합 버그(PR #14) · 행정코드 경계면 변환표(PR #15) · 참조 GeoJSON 게이트(PR #16)
- **2026-08-14** 소하천구역(LSMD_CONT_UJ301)·전국하천표준데이터를 대상 6개 지역으로 반입(소하천 1,531건 · 표준지점 마커 36개), 지도 전용 지역 선택기·마우스 오버 텍스트 태그·하천명 검색 신설 — 백로그였던 '지역 선택 검색창' 건 해소
- **배포**: https://une-aidata-web.vercel.app (GitHub main 자동 배포)

## 서비스 범위 (2026-08-09 · 08-12 사용자 확인)
- **하천은 국가하천·지방하천·소하천 3종만 다룬다.** 세류(RVC005)·기타하천(RVC004)은 범위 밖이다.
  - 중심선은 `RIVER_SE` 로 직접 거른다. **실폭·하천경계에는 등급 속성이 아예 없어**(국토지리정보원 테이블정의서 확인) 중심선에서 공간조인해 붙인다.
  - 중심선이 지나지 않는 폴리곤은 버리지 않고 `등급미확인` 으로 남긴다 — 버리면 물길이 끊겨 보인다. **등급을 추정해 만들어내지 않는다.**
  - 조인 실적: 실폭 79~99% · 경계 99% 에 등급이 붙는다. 팝업에 `하천등급` 과 `등급 판정근거` 를 표시한다.
- **시범서비스 대상은 전국이다. 검증만 부산·인제·영천이다.** 지금 의왕·구미·남원을 쓰는 건 그 3개 지역 계획자료가 아직 없어서다.
- 따라서 새로 들이는 자료는 가능하면 **전국 단위**로 넣는다. 관측소 레이어가 첫 사례이고, 이미 부산(수위 31)·인제(19)·영천(24)을 포함한다.
- 지역별로 잘라야 하는 자료(하천 3종 등)는 대상 지역이 확정되면 같은 스크립트로 다시 뽑는다.
- ~~**[백로그 · 2026-08-10] 지역 선택을 별도 검색창으로 바꾼다.**~~ → **2026-08-14 해소.** 아래 고민(상황 seed 계약 vs 지도 이동)은 **지도 전용 지역 선택기**로 갈랐다 — 앱 지역(`adminCode`)·`current_situations_seed` 계약은 그대로 두고 지도만 6곳을 오간다. 계획자료가 없는 부산·인제·영천에서는 '이 지역은 하천 공간자료만 있습니다' 안내가 뜬다. 검색은 지오코딩이 아니라 전처리 색인(`river_search_index.json`)으로 붙였다.
  - 고정 지점: `VWorldMapAdapter.CENTERS`(3개 좌표) · `geo.json` L3(3개 경계) · `current_situations_seed.json`(3개 상황) · 헤더의 `.context-select`
  - 지도 이동 자체는 좌표만 있으면 되므로 검색은 VWorld 지오코딩이나 행정경계 자료로 붙일 수 있다. **다만 상황(situation)은 seed 계약이라 지역을 늘리는 것과 검색으로 이동만 하는 것은 다른 범위다** — 착수 전에 어디까지인지 먼저 정한다.
  - 검색으로 3개 지역 밖으로 이동하면 위험지구·하천·상황이 비게 된다. "이 지역은 계획자료 미확보" 안내가 함께 필요하다. 관측소는 전국이라 그대로 보인다.
  - **[같이 볼 것] 기상청 전국 격자표 반입.** 활용가이드의 `격자_위경도(2607).xlsx` 에 시군구 단위 격자 **256개**가 있다. 지금 `kmaNowcast.GRID_BY_ADMIN` 은 3개 지역 하드코딩이다.
    - **행정코드 방식은 2026-08-10 확정됐다 → `data/reference/admin_code_map.json` (경계면 변환).** Seed 는 구 코드를 유지하고 외부 대조 시에만 현행 코드로 바꾼다. 격자표 반입 스크립트는 이 표를 거쳐 키를 맞추면 된다.
    - 실조회로 확인한 사실: VWorld 는 **이미 현행 코드만** 준다(`45190`·`42810` NOT_FOUND, `52190`·`51810` OK). 즉 "신 코드가 없다"가 아니라 **우리 Seed 가 낡았다.** `geo.json` L3 의 출처 문자열 `sig_cd=45190` 은 지금은 죽은 참조다.
    - 전면 마이그레이션을 택하지 않은 이유: `45190` 이 Seed·reference 33개 파일 **403건**에 있고 그중 5건은 `EVT::20200801-FLOOD-45190-001` 처럼 **식별자 일부**라 passage 71·relation 25·유사사례·보고서 참조가 함께 움직인다. 남원은 대체물이라 버려질 작업이 될 수 있다.
    - 검증: `python scripts/verify_admin_codes.py` (VWorld 실조회로 표 대조, 키 없으면 SKIP·네트워크 0건)

## In progress
- **Phase 8** — 코드측 승격 준비는 100% 끝났다. Shadow 하네스(`npm run test:provider-shadow -- --provider <id>`), 승격 절차(`docs/29`), 승격 원장(`tests/provider/provider_promotion_status.json`)과 그 검사 게이트(`npm run test:promotion-status`)가 모두 있다.
  - `kma_nowcast` = **SHADOW_TESTED** (승인 1 완료, 2026-08-10). 실호출 3개 지역 전부 SHADOW_PASSED(Observation 8건, fixture 8건 전건 구조 일치, 비밀정보 0건). **SELECTABLE 은 미승인** — Vercel env 설정은 그 자체가 승격이라 승인 2 이후 사용자가 직접 한다. 키 활용기간 2026-08-10~2028-08-10, 로컬 `.env` 전용.
  - `une_rag` = **SHADOW_TESTED** (승인 1 완료). SELECTABLE 은 **보류** — 내부망(사내 IP)이라 외부 시연에서 접근 불가, 당분간 Seed 검색 유지. Vercel env 에 `UNE_RAG_*` 설정 금지 상태.
  - 나머지 4종 = **FIXTURE_VALIDATED**. t3q 3종은 실 Endpoint 미확정으로 `promotion_hold`.
  - **실제 연결된 Provider 는 없으며 배포본은 전부 Seed/Mock 동작.**
- 승인 없이 진행 가능한 코드 작업은 현재 없다. 아래 Next steps 는 전부 사용자 조치가 선행 조건이다.

## Pending — 데이터 수령 대기
- **부산·인제·영천 국가기본도 하천 3종 원본 SHP**: 사용자가 올리기로 함(2026-08-14). 수령 후 `scripts/extract_river_layers.py`의 대상지역 산정을 `geo.json` L3 bbox 대신 `scripts/river_regions.py`로 바꿔 6개 지역 전부 재추출 → `build_river_web_layers.py` 재실행. 현재 그 3곳에서는 소하천구역과 하천표준데이터 지점만 나온다.
- **타이포 스케일 확정**: 현재 크기는 상황실 원거리 시인성 전제의 잠정값(1920px 본문 17.7px). 접근성 요구가 아니라 설계 판단이며, 디자인 실험실 산출물(type scale) 수령 후 `styles.css` `:root`의 `--fs-*` clamp 5개 + 확대 브레이크포인트 루트 배율 3개만 교체하면 됨. 상세: `docs/30_design_system_handoff.md` B-7
- **부산·인제·영천 계획자료 구조화**: 사용자가 자연재해저감 종합계획·하천기본계획 **PDF를 추후 제공** 예정. 수령 후 `data/reference/districts.json`·`rivers.json`·`geo.json`과 동일 스키마로 전사하면 지도 POI 팝업·계획·근거 패널이 그대로 동작한다(코드 변경 불필요). 현재는 의왕 41430(17지구)·구미 47190(6지구)·남원 45190(6지구) + 하천 3개(안양천·구미천·요천)만 커버.
- 참고: 원시 xlsx(`메타데이터 참고자료(T3Q)/`)에는 전국 재해대장 115,563행·위험지구 약 6,300지구가 있으나 **위험요인 서술·임계값·근거 문서페이지·좌표가 없어** 팝업 수준의 정보를 만들 수 없다(그 정보는 저감계획 PDF 판독에서 나옴). 재해대장은 피해금액·복구비 보강용으로 조인 가능.

## Pending approval
- 없음. **GM-A-01 seed 불일치는 2026-08-07 승인으로 해소**(PR #5 머지 · `GM-A-04 구미천지구`로 참조 교체, 스모크 S8/S9 재구성으로 미존재 ID 가드 보존).

## 진행에 필요한 것 (2026-08-11 정리 — 전부 사용자 조치가 선행)

> **개발이 끝난 상태가 아니다.** Phase 1~7 완료, Phase 8 진행 중이며 **실제 연결된 Provider 는 아직 없다**(배포본 전부 Seed/Mock).
> 아래는 "무엇이 오면 무엇이 풀리는지" 목록이다. 코드측 준비는 각 항목마다 끝나 있다.

| # | 필요한 것 | 누가 | 오면 풀리는 것 | 소요 |
|---|---|---|---|---|
| 1 | **Vercel env `DATA_GO_KR_SERVICE_KEY`** (승인 2) | 사용자 직접 | kma_nowcast SELECTABLE — 화면에 실제 기상 관측값 | 설정 5분 + 회귀 |
| 2 | **HRFCO 서비스키·Endpoint** | 사용자 | hrfco Shadow Test → 승인 1 | 키 받으면 당일 |
| 3 | **`4005670`↔`Y4 남원수위표` 동일 지점 확인** | 담당 확인 | hrfco 관측소 코드 확정(후보는 확보됨) | 확인 1건 |
| 4 | **부산·인제·영천 계획자료 PDF** (자연재해저감 종합계획·하천기본계획) | 사용자 | 실제 검증 대상 3개 지역 전환 — districts·rivers·geo 전사 | 자료량에 따름 |
| 5 | **부산 대상 구·군 확정** | 발주처/사용자 | 행정코드 매핑표·경계·격자 확정 | 확인 1건 |
| 6 | **타이포 스케일**(디자인 실험실 산출물) | 디자인 | `styles.css` `--fs-*` 5개 + 배율 3개 교체 | 교체 2곳 |
| 7 | **외부 접근 가능한 UNE RAG Endpoint** | 인프라 | une_rag SELECTABLE 재검토 | 미정 |
| 8 | **T3Q 실 Endpoint·인증 계약** | T3Q | t3q 3종 `promotion_hold` 해제 | 미정 |

**결정만 필요한 것(자료 불필요)**
- 지역 검색창 범위 + 전국 격자표 반입 방식 (백로그, 위 "서비스 범위" 절 참고)
- ~~하천 표시 밀도~~ → **2026-08-12 해소.** 남원 실폭 400개 중 250개가 **소하천**이고 소하천은 서비스 범위 안이다(노이즈가 아니었다). 범위 밖인 세류·기타하천만 제외했다.

**환경 주의(PC 이동 시)**: `.env` 는 gitignore 라 따라가지 않는다. 다른 PC 에서는 `VITE_VWORLD_MAP_KEY`·`VITE_VWORLD_SERVICE_DOMAIN`·`DATA_GO_KR_SERVICE_KEY` 를 다시 넣어야 한다. **키는 Decoding 형태로 넣는다**(Encoding 을 넣으면 이중 인코딩된다).

## Next steps (Phase 8 잔여 — provider별 독립 진행, 전부 사용자 조치 선행)
1. ~~kma_nowcast 승인1~~ → **2026-08-10 완료.** 남은 것은 **승인 2(SELECTABLE)** 뿐이다.
   - Vercel 프로젝트(`une-aidata-web`) env 에 `DATA_GO_KR_SERVICE_KEY` 를 넣는 순간 실경로로 전환된다 = **그 행위 자체가 SELECTABLE 승격**이라 사용자가 직접 한다(docs/29 §17-18).
   - 넣은 뒤 회귀 재통과 + `integrations/status` 표기 확인. 되돌리려면 Vercel env 를 지우면 Seed 로 복귀한다.
   - 새 키가 필요할 때 함정 2가지: 활용신청 승인 반영 전이면 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR(30)` → 시간 두고 재시도. 발표 시각 전이면 `NO_DATA(03)` → `KMA_REQUEST_LAG_MINUTES` 를 60~70 으로 올린다.
   - **키는 Encoding 이 아니라 Decoding 형태로 넣는다.** 코드가 `searchParams` 로 한 번 더 인코딩해서 Encoding 키를 넣으면 `%252B` 로 이중 인코딩된다.
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
- 검증: `npm run validate` → `npm run test:contracts` → `npm run typecheck` → `npm run test:runtime-gate` → `npm run test:provider-conformance` → `npm run test:promotion-status` → `npm run test:reference-geojson`
- 선택(키 있을 때): `npm run test:admin-codes` — VWorld 실조회로 행정코드 매핑표 대조. 키 없으면 SKIP·네트워크 0건
- 콘솔 스모크 3종: `python scripts/smoke_dashboard_console.py` · `npm run test:evidence-console` · `npm run test:report-console` / E2E: `npm run test:e2e`
- 하천 참조자료 재생성: `npm run data:rivers` (원자료 폴더 2개가 리포 루트에 있어야 한다 · gitignore 대상) / 검증 `npm run test:river-reference`
- 빌드: `npm run build` / 개발: `npm run dev:web`
- Windows: `python3` 대신 `python`, `.sh` 는 Git Bash 로 실행
