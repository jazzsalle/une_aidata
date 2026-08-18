# PROGRESS.md — 회사↔집 인계 기록

> **이 파일은 "지금 무엇을 해야 하는지"만 담는다.** 완료 기록은 `docs/PROGRESS_ARCHIVE.md` 에 원문 그대로 있다.
> SessionStart 훅(`.claude/scripts/load_progress.sh`)이 이 파일에서 재개용 절만 뽑아 주입하므로,
> 완료 이력을 여기에 계속 쌓으면 정작 필요한 절이 잘려 나간다(2026-08-09 실제로 그랬다).

## Last updated
2026-08-19 새벽 — **하천 자료를 전국으로 넓히고 자료 구성을 다시 잡았다.** 브랜치 두 개를
푸시해 두었고 PR 은 아직 없다.

  feat/sochun-ledger-crosscheck   커밋 3개  NDMS 소하천 전체 목록 대조표 · 시군구 코드표
  feat/nationwide-river-layers    위 3개 + 커밋 7개  전국 하천 레이어 (이 브랜치가 최신)

**원자료가 전부 `GIS_data/` 아래로 옮겨졌다.** 경로는 `scripts/source_data.py` 한 곳만 안다 —
또 옮기면 그 파일만 고치면 된다. `GIS_data/` 는 gitignore 지만 `메타데이터 참고자료(T3Q)/` 만
예외로 계속 추적한다(예전부터 리포가 들고 있던 참고문서다).

**전국하천표준데이터는 삭제했고 앞으로 쓰지 않는다.** 국가하천 33·지방하천 672건뿐이라 전국
완전 목록이 아니었다. 그 자리는 하천망도(국가 73 · 지방 3,783)가 대신한다.

### 지금 반입돼 있는 것

```
LSMD_SOCHUN_{시군구}.geojson       188개 · 폴리곤 116,758 · 하천명 95.5% · 112 MB
river_network_catalog.json         국가·지방하천 3,856 (코드·이름·등급·라벨점·시군구배정)
river_region_catalog.json          지도 지역 선택기용 시군구 목록
river_search_index.json            23,540건 (소하천 19,684 + 국가·지방 3,856) · gzip 523 KB
TN_RIVER_BNDRY/BT_{41430,47190,52190}.geojson   경계·실폭 — **아직 3개 지역만**
```

### 자료를 어떻게 나눠 쓰는지 (근거는 docs/32 §7)

- **형상을 반입하는 것은 면(폴리곤)뿐**이다. 중심선(322만건)·하천망도는 형상을 넣지 않고
  속성만 전처리에 쓴다. 단 **하천당 표기용 파생점 1개는 예외**다(라벨점) — 이 구분을 안 적어
  두었다가 라벨 레이어를 과잉 삭제해 지도에서 하천명이 통째로 사라진 적이 있다.
- **등급 조인 원천은 중심선**이다. 하천망도로 조인하면 정확도가 68~78%이고 소하천을 국가·
  지방하천으로 올리는 오판이 남원만 205건이다.
- 하천명 라벨은 **bbox 중심을 쓰지 않는다.** 굽은 하천에서 옆 하천 위에 이름이 찍힌다.
  국가·지방은 카탈로그 `label_point`(내부점), 소하천은 폴리곤 레이어가 `getInteriorPoint()`.

### 화면에 들어간 것

- 상단이 **지역(전국 시군구) + 상황** 두 선택기로 나뉘었다. 시드가 없는 시군구를 골라도
  지도·하천은 보이고 판단 패널은 마지막 상황을 유지하며 '이 지역은 하천자료만'을 알린다.
- 지도 하천 검색이 전국이다. 국가·지방하천은 `scope='nationwide'` 라 결과를 골라도 지역을
  바꾸지 않고 위치로만 움직인다.
- 오른쪽 패널에 **하천 탭**(국가하천/지방하천/소하천)이 생겼다. 탭 순서는 앞의 4개를 그대로
  두고 맨 뒤에 넣었다 — 콘솔 스모크가 탭을 인덱스로 지목한다.

앞서: 2026-08-14 소하천구역 6개 지역 반입(PR #19), 2026-08-12 하천 등급 3종 범위 확정(PR #18),
kma_nowcast SHADOW_TESTED(PR #13).
**실제 연결된 Provider 는 여전히 없다** — 배포본은 전부 Seed/Mock 이다.

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
- ~~**[백로그 · 2026-08-10] 지역 선택을 별도 검색창으로 바꾼다.**~~ → **2026-08-14 해소(PR #19).** "지역을 늘리는 것"과 "지도만 이동하는 것"이 다른 범위라는 게 보류 사유였는데, **지도 전용 지역 선택기**로 그 둘을 갈랐다 — 앱 지역(`adminCode`)·`current_situations_seed` 계약은 그대로 두고 지도만 6곳을 오간다. 계획자료가 없는 부산·인제·영천에서는 '이 지역은 하천 공간자료만 있습니다' 안내가 뜬다. 검색은 VWorld 지오코딩이 아니라 전처리 색인(`river_search_index.json`, 1,835건·424 KB)으로 붙였다.
  - 코드 위치: `apps/web/src/features/map/mapRegions.ts`(지역 6곳 · 프런트 단일 출처) ↔ `scripts/river_regions.py`(전처리 단일 출처). **지역을 늘릴 때 이 두 파일을 함께 고친다.**
  - **아직 3개 지역 하드코딩으로 남아 있는 곳**: `geo.json` L3(경계 3개) · `current_situations_seed.json`(상황 3개) · 헤더 `.context-select`(앱 지역). 이건 계획자료(PDF)가 와야 풀린다 — 아래 "Pending" 4번.
- **[열린 백로그] 기상청 전국 격자표 반입.** 활용가이드의 `격자_위경도(2607).xlsx` 에 시군구 단위 격자 **256개**가 있다. 지금 `kmaNowcast.GRID_BY_ADMIN` 은 3개 지역 하드코딩이다.
    - **행정코드 방식은 2026-08-10 확정됐다 → `data/reference/admin_code_map.json` (경계면 변환).** Seed 는 구 코드를 유지하고 외부 대조 시에만 현행 코드로 바꾼다. 격자표 반입 스크립트는 이 표를 거쳐 키를 맞추면 된다.
    - 실조회로 확인한 사실: VWorld 는 **이미 현행 코드만** 준다(`45190`·`42810` NOT_FOUND, `52190`·`51810` OK). 즉 "신 코드가 없다"가 아니라 **우리 Seed 가 낡았다.** `geo.json` L3 의 출처 문자열 `sig_cd=45190` 은 지금은 죽은 참조다.
    - 전면 마이그레이션을 택하지 않은 이유: `45190` 이 Seed·reference 33개 파일 **403건**에 있고 그중 5건은 `EVT::20200801-FLOOD-45190-001` 처럼 **식별자 일부**라 passage 71·relation 25·유사사례·보고서 참조가 함께 움직인다. 남원은 대체물이라 버려질 작업이 될 수 있다.
    - 검증: `python scripts/verify_admin_codes.py` (VWorld 실조회로 표 대조, 키 없으면 SKIP·네트워크 0건)

## In progress
**Phase 8** — 코드측 준비는 끝났다. Shadow 하네스(`npm run test:provider-shadow -- --provider <id>`) · 절차(`docs/29`) · 원장(`tests/provider/provider_promotion_status.json`) · 게이트(`npm run test:promotion-status`) 모두 있다.

| Provider | 상태 | 남은 것 |
|---|---|---|
| `kma_nowcast` | SHADOW_TESTED (승인1 완료 08-10) | 승인2 = 사용자가 Vercel env 에 키 투입. 키 유효 ~2028-08-10, 지금은 로컬 `.env` 전용 |
| `une_rag` | SHADOW_TESTED (승인1 완료) | SELECTABLE **보류** — 내부망이라 외부 시연 불가. Vercel env 에 `UNE_RAG_*` 설정 금지 |
| 나머지 4종 | FIXTURE_VALIDATED | t3q 3종은 실 Endpoint 미확정 → `promotion_hold` |

**실제 연결된 Provider 는 없고 배포본은 전부 Seed/Mock 이다.** 승인 없이 지금 할 수 있는 코드 작업은 **배포 URL 실검증 1건**(Next steps 0번)뿐이다.

## Pending — 데이터 수령 대기
- ~~부산·인제·영천 국가기본도 하천 3종 원본 SHP~~ → **2026-08-19 수령 완료.** `GIS_data/국가기본도_하천{경계,실폭,중심선}/` 에 **전국 단일 SHP** 로 들어왔다. 전국 반입은 Next steps 0번 참고(용량 결정이 필요하다).
- **부산·인제·영천 계획자료 PDF**(자연재해저감 종합계획·하천기본계획, 사용자 제공 예정): 수령 후 `districts.json`·`rivers.json`·`geo.json` 과 같은 스키마로 전사하면 지도 POI 팝업·계획·근거 패널이 **코드 변경 없이** 동작한다. 현재 커버는 의왕(17지구)·구미(6)·남원(6) + 하천 3개(안양천·구미천·요천)뿐이다. 원시 xlsx(`메타데이터 참고자료(T3Q)/`)의 재해대장 115,563행은 **위험요인·임계값·근거페이지·좌표가 없어** 팝업을 못 만든다(피해금액 보강용 조인만 가능).
- **타이포 스케일**(디자인 실험실 산출물): 현재는 상황실 원거리 시인성 전제의 잠정값. 수령 후 `styles.css` `:root` 의 `--fs-*` clamp 5개 + 확대 브레이크포인트 배율 3개만 교체. 상세 `docs/30_design_system_handoff.md` B-7

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

## Next steps

**0. 이번 하천 작업에서 남은 것** (2026-08-19 신설)
   - **국가기본도 경계·실폭을 전국으로 넓히기.** 지금은 의왕·구미·남원 3곳뿐이라 나머지
     시군구에서는 '이 지역 자료 없음' 으로 뜬다(소하천구역은 전국이라 하천 자체는 보인다).
     원자료는 `GIS_data/국가기본도_하천{경계,실폭}/*.zip` 에 전국 단일 SHP 로 있다.
     - 규모: 경계 140,851 폴리곤 16.6M 정점 · 실폭 28,262 폴리곤 22.9M 정점 = **39.5M 정점**.
       소하천구역과 같은 2 m 단순화로 뽑으면 **약 156 MB** 로 추정된다(소하천 112 MB 위에 더해짐).
       **용량 결정이 필요하다** — 5 m 로 완화하면 절반쯤 되고, 실폭은 폴리곤당 809 정점이라
       10 m 로 줄여도 시군구 축척에서 차이가 없다.
     - 절차: 중심선(`GIS_data/국가기본도_하천중심선`)에서 RVC001~003 만 골라 격자 색인을 만들고
       (전체 322만 중 494,216건), 경계·실폭 폴리곤 안을 지나는 중심선의 최상위 등급을 붙인다.
       시군구 배정은 `scripts/build_river_network_regions.py` 와 같은 방식(행정동 경계 공간판정).
     - 파일명은 **시군구코드**를 쓴다. 남원은 앱코드 45190 이 아니라 자료코드 52190 이다 —
       이걸 틀리면 그 지역에서 하천이 통째로 안 뜬다(2026-08-19 실제로 겪었고 게이트에 가드를 넣었다).
   - **PR 올리기.** 브랜치 2개가 푸시돼 있다. 하나로 묶으려면 `feat/nationwide-river-layers`
     하나만 PR 로 올리면 10개 커밋이 다 들어간다.
   - 배포 URL 실검증(https://une-aidata-web.vercel.app) — VWorld 등록 도메인은 배포 환경에서만
     실증된다. 전국 시군구 전환·하천 탭·하천명 라벨을 브라우저에서 확인할 것.


**Phase 8 잔여 — provider별 독립 진행, 전부 사용자 조치 선행**
1. ~~kma_nowcast 승인1~~ → **2026-08-10 완료.** 남은 것은 **승인 2(SELECTABLE)** 뿐이다.
   - Vercel 프로젝트(`une-aidata-web`) env 에 `DATA_GO_KR_SERVICE_KEY` 를 넣는 순간 실경로로 전환된다 = **그 행위 자체가 승격**이라 사용자가 직접 한다(docs/29 §17-18). 넣은 뒤 회귀 재통과 + `integrations/status` 확인. 되돌리려면 env 를 지우면 Seed 로 복귀.
   - 함정 3가지: 활용신청 승인 반영 전이면 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR(30)` → 시간 두고 재시도 / 발표 시각 전이면 `NO_DATA(03)` → `KMA_REQUEST_LAG_MINUTES` 60~70 / **키는 Decoding 형태로** — Encoding 을 넣으면 코드가 한 번 더 인코딩해 `%252B` 가 된다.
2. **hrfco_hydrology** — 관측소 후보 조사 완료(2026-08-09). **결론만: 남원 `4005670` · 구미 `2011631` · 의왕 없음(비워 두고 호출 안 함).** 근거·전수 대조표·주의점(구미는 이름만 보고 고르면 틀린다)은 전부 `docs/31_hrfco_station_candidates.md` 에 있다. 남은 절차 2가지: ① 키로 HRFCO 관측소 목록과 `obscd` 대조 ② `4005670` ↔ `Y4 남원수위표` 동일 지점 확인. 그 뒤 `HRFCO_STATION_MAP_JSON` 투입 → Shadow Test.
3. **une_rag**: 외부 접근 가능한 Endpoint 확보 시 승인2 재검토. 경로 추정 금지 — Swagger probe(`/api/v1/integrations/une-rag-probe`) 먼저(v0.7 규칙 5).
4. **t3q 3종**: 실 Endpoint·인증 계약 확정 전까지 `promotion_hold` — Phase 8 승인 대상 아님.
5. **공통 주의**: 키는 **로컬 셸 env 로만**. Vercel env 설정은 그 자체가 SELECTABLE 승격 행위라 승인2 이후 사용자가 직접 한다. DEFAULT 전환 금지. 절차: `docs/29_provider_shadow_and_promotion_procedure.md`

## Blockers
- **`gh` CLI 활성 계정 확인 — PR 을 만들 때 걸린다.** 이 리포는 `jazzsalle/une_aidata` 이고 `sangraedo` 계정은 READ 권한뿐이라 `gh pr create` 가 `must be a collaborator` 로 실패한다(2026-08-14 실제로 걸림). `git push` 는 자격증명이 달라 통과하므로 **push 는 되는데 PR 만 안 되는** 모습으로 나타난다. 우회: `gh auth switch --user jazzsalle` 후 `gh repo view jazzsalle/une_aidata --json viewerPermission` 이 `ADMIN` 인지 확인.
- **작업 시작 전 `git fetch && git log --oneline HEAD..origin/main` 을 먼저 본다.** 2026-08-14 에 26 커밋 뒤처진 브랜치 위에서 작업해, 그대로 PR 을 올렸다면 PR #7~#18 이 통째로 되돌아갈 뻔했다. 회사↔집 왕복이 잦은 리포라 이게 재발하기 쉽다.
- **Windows 의 `python3` 는 Microsoft Store 스텁일 수 있다 — 무엇을 시켜도 "Python" 한 줄만 찍고 exit 49.** PATH 에 실재하므로 `command -v` 는 통과한다. npm 스크립트의 `python3` 를 전부 `python` 으로 바꿔 실행할 것(CLAUDE.md 규칙). 2026-08-14 에 이것 때문에 **SessionStart 훅이 조용히 아무 컨텍스트도 주입하지 않고 있었다** — `load_progress.sh` 가 존재 확인만 하고 골랐기 때문. 실행 가능 여부까지 확인하도록 고쳤다.
- **PowerShell 에서 `.sh` 게이트 실행 주의 — Phase 8 주 실행 경로에 직접 걸린다.** `npm run test:provider-shadow` = `bash scripts/run_provider_shadow_test.sh` 이고 그 `:10` 이 `rm -rf .runtime-cjs` 를 한다. bash 가 WSL 로 잡히면 `.runtime-cjs` 가 삭제된 채 재컴파일에 실패할 수 있다. 우회: Git Bash 에서 `tsc -p tsconfig.runtime.json` + `.runtime-cjs/package.json`(`{"type":"commonjs"}`) 확인 후 `node tests/provider/provider_shadow_gate.cjs --provider <id>` 직접 실행.
- (해소됨) `jsonschema` 미설치 · @playwright/test 404 — 둘 다 설치 완료.

## How to run

**PC 이동 후 준비 (집 PC 에서 이 3줄부터)**
1. `git fetch && git status` — main 이 `c52075e`(PR #19 머지) 이상인지, 미커밋 변경이 없는지 확인
2. `npm install` + `python -m pip install -r requirements.txt` — requirements 에 **numpy·pyproj·pyshp 가 2026-08-14 추가**됐다(하천 전처리용). 이미 설치돼 있으면 넘어간다
3. `.env` 재작성 — **gitignore 라 따라오지 않는다.** `VITE_VWORLD_MAP_KEY` · `VITE_VWORLD_SERVICE_DOMAIN` · `DATA_GO_KR_SERVICE_KEY`. **키는 Decoding 형태로 넣는다**(Encoding 을 넣으면 코드가 한 번 더 인코딩해 `%252B` 가 된다)

**따라오지 않는 것 (gitignore)** — 없어도 앱 실행·검증·배포는 전부 된다
- `.env`
- **`GIS_data/` 통째로**(약 2.5 GB) — 소하천구역 zip 460 MB · 국가기본도 3종 967 MB · 행정동 경계 130 MB · 법정동 연계정보 79 MB · 하천망도 65 MB · NDMS 소하천 목록 등. **전처리 입력일 뿐이고 산출물은 전부 커밋돼 있다.** 없으면 `npm run data:rivers` · `data:river-network` · `data:sgg-code-map` · `data:sochun-crosscheck` 만 못 돌린다.
  - 예외로 `GIS_data/메타데이터 참고자료(T3Q)/` 는 계속 추적한다(예전부터 리포가 들고 있던 참고문서다).
  - 경로는 `scripts/source_data.py` 한 곳만 안다. 폴더를 또 옮기면 그 파일만 고치면 된다.
- `build/`(전처리 중간산출), `node_modules/`, `__pycache__/`

**명령**
- 개발: `npm run dev:web` (루트 `npm run dev` 는 `vercel dev` 라 재귀호출로 실패한다) / 빌드: `npm run build`
- 검증: `npm run validate` → `test:contracts` → `typecheck` → `test:runtime-gate` → `test:provider-conformance` → `test:promotion-status` → `test:reference-geojson` → `test:river-reference`
- 콘솔 스모크 3종: `python scripts/smoke_dashboard_console.py` · `npm run test:evidence-console` · `npm run test:report-console` / E2E: `npm run test:e2e`
- 하천 참조자료 재생성: `npm run data:rivers` — **원자료 폴더 2개 필요**(위 참조)
- 선택(키 있을 때): `npm run test:admin-codes` — VWorld 실조회로 행정코드 표 대조. 키 없으면 SKIP·네트워크 0건
- **Windows: npm 스크립트의 `python3` 는 `python` 으로 바꿔 실행**(Store 스텁 주의 — Blockers 참고), `.sh` 는 Git Bash
