# 08. T3Q 데이터 구축 플랫폼(메타·온톨로지·MCP) 조회 분석

- 조회일: 2026-07-30 / 조회자: 유엔이(UNE) POC팀 / 방식: **조회 전용**(수정·실행 일절 없음)
- 대상: T3Q "Any-to-Any Data Consultant" 테스트 사이트 `https://dev165.rootsall.net/` (관리자 MOIS 계정, 접속 계정은 별도 전달)
- **주의: 본 사이트는 T3Q가 데이터 구축 중에 운용하는 테스트 모듈이다. 여기 기재된 스키마·코드·Agent 구조는 확정 규격이 아니며, 본사업 확정 시 변경될 수 있다.**
- 본 문서의 모든 수치·명칭은 화면 표기 그대로이며, 각 절에 근거(메뉴 경로)를 표기한다.

---

## 1. 사이트 개요·구조

배너: "재난안전 AI데이터 구축사업 — 데이터로 예측하고, AI로 대응하는 국가재난안전". 좌측 메뉴가 곧 구축 파이프라인이다.

| 단계 | 메뉴 | 내용(확인 상태) |
|---|---|---|
| ① 원시 (Raw Data) | DB연결관리 | PostgreSQL `mois`(172.16.16.165) 1건 활성 |
| | 정형파일관리 | 스키마그룹 폴더 체계 + **NDMS-Schema 24파일** |
| | 문서관리 | 비정형 원본 — **소하천정비종합계획 전국(PDF 250+장별 md 229폴더), 홍수취약지구 249** 등 |
| | 영상관리 | 빈 상태 |
| ② 문제유형정의 | DB스키마수집 | mois DB 24테이블 메타 수집 완료(DDL·RowCount·샘플·FK) |
| | 정형파일스키마 | 파일별 1:1 스키마 수집(xlsx→SQLite+md), NDMS 24종 수집완료 |
| | 도메인표준스키마 | 빈 상태 |
| | 문서변환 | PDF·HWP→Markdown, 장(章) 단위 파일 관리 |
| | 변환파일병합/분할 | 병합/분할 도구(데이터 없음) |
| | 영상변환 | 씬 분리·STT 예정(빈 상태) |
| | 문제유형(역량질의)정의 | CQ 1건(태풍·호우 실증, 질문 5개) |
| | 응용온톨로지스키마생성 | **온톨로지 스키마 18건 생성 완료** |
| ③ 온톨로지 인스턴스 구축 | 인스턴스변환(정형) | 변환 Agent 6건, 인스턴스 7.6만+ |
| | Sheet인스턴스조회 | 0건(도구 4종 정의됨) |
| | 인스턴스생성(비정형) | **홍수취약지구 249건 인스턴스 생성 완료** |
| | 영상처리 | 빈 상태 |
| | 속성 마스터 / 관계 인스턴스 | 빈 상태(KG 관계 수집은 이후 단계) |

원시데이터 처리현황판(메인 대시보드)은 데이터셋별 진행상태를 **원시 → 문제유형정의 → 인스턴스구축** 3단계로 표기한다. 현재 인스턴스구축 도달은 `04-취약지역/홍수취약지구`가 유일하고, 대부분은 문제유형정의 단계다.

## 2. 데이터 구축 흐름 (화면 근거로 재구성)

```
원시 수집(파일/DB/NAS)
  → 스키마 수집(정형: DDL·데이터사전 / 비정형: md 변환·장 단위 분할)
    → 역량질의(CQ) 정의
      → 응용온톨로지 스키마 생성(LLM 지원, SchemaType·속성·연결 정의)
        → 인스턴스 생성(변환 Agent 실행 → Passage 인스턴스)
          → [예정] 속성 마스터·관계 인스턴스(KG) → 검색/Agent 서비스
```

특징 3가지:
1. **모든 데이터의 최종 단위가 "Passage"다.** 정형(DB 행·NDMS 필드정의·재난문자)도, 비정형(관리카드 PDF·계획 문서)도 SchemaType별 Passage 인스턴스로 수렴한다. RAG 검색을 전제로 한 설계다.
2. **근거(계보) 부착이 기본값이다.** 정형 DB(mois)의 hazard_zones 각 행에 `source_categories`·`source_rows`(원본 엑셀 경로·시트명·행번호 JSON)가 붙어 있다(② DB스키마수집 › 샘플). 비정형은 원본 파일↔md↔passage가 버전관리(커밋 개념)로 연결된다.
3. **Agent 기반 변환.** 인스턴스 생성이 "변환 Agent"(SchemaType별 템플릿 설정→실행→로그) 단위로 관리되고, Sheet 도구가 `sheet_passage_extract`, `extract_sheet_from_search`, `extract_sheet_from_sql` 등 MCP 도구식 명명을 쓴다.

## 3. 데이터 메타 상세

### 3.1 스키마그룹 10종 (재난안전 응용 온톨로지의 상위 분류) — 메인 대시보드
00-통합식별 / 01-상황경보 / 02-문서보고 / 03-피해복구 / 04-취약지역 / 05-잠재위험요소 / 06-기상수문환경 / 07-영상GeoAI / 08-공간기준 / 09-해외참조 / 10-정책표준참조.
각 그룹은 RFP 요구ID(DAR-001~013, TER-004, DQR-001)에 근거를 명시해 분류된다. 예: 00=DAR-001(사건 단위 식별체계), 04=DAR-007~008(취약지역 통합 DB), 09=TER-004 유사사례·AI_SIM.

### 3.2 SchemaType 46종 (Event-Centric Core Spine)
허브 1종(DisasterEventMasterPassage) + 도메인 45종. 그룹별: 01상황경보 4종(FloodWarning·DisasterAlert·GovResponse·MonitoringPoint), 02문서보고 4종, 03피해복구 6종, 04취약지역 4종+**FloodVulnerableZonePassage**(홍수취약지구 통합 마스터), 05잠재위험요소 6종, 06기상수문환경 4종(WaterLevel·WaterInfrastructure 포함), 07영상GeoAI 6종(**AIAnalysisPassage** 포함), 08공간기준 2종(LegalRegion·RegionHistory), 09해외참조 4종, 10정책표준참조 4종.

### 3.3 재난사건 Master (DisasterEventMasterPassage) — 응용온톨로지 › 00-통합식별 상세
- 속성 그룹: EventIdentity(사건ID·유형·지역·순번·상태) / Time(시작·종료·생애주기) / Location(행정구역명·**법정동코드 10자리**·WGS84 좌표) / Damage(사망·실종·부상·공공·사유·농작물·기반시설 7종+피해규모등급) / CrisisLevel / RiskFactors(주요인·부요인)
- **EVENT ID 생성 규칙: `{YYYYMMDD}-{DisasterTypeCode}-{RegionCode5}-{Sequence3}`**, 정식 표기 `EVT::20240715-FLOOD-44210-001`
- EventStatus: 발생·진행·종료·보정·**병합**
- Master는 하위 passage 목록을 갖지 않고, **각 도메인 passage가 `RefDisasterEventID`로 역참조**한다(허브-스포크).

### 3.4 표준 코드 체계(Controlled Vocabulary) 9종 — 동일 문서·그래프 JSON
| 코드계 | 값 |
|---|---|
| disaster_type | FLOOD·TYPH·QUAKE·SLOPE·FIRE·SNOW(자연) / FIRE_S·CHEM·BIO(사회) — 간이 코드 |
| crisis_level | LVL_01 관심 · LVL_02 주의 · LVL_03 경계 · LVL_04 심각 |
| damage_scale | DMG_DEATH/MISS/INJ(명), DMG_PUB/PVT/AGR(백만원), DMG_INFRA |
| risk_factor | rain_fall·rain·precipitation·wind·slope·river_level·tide·temperature |
| observation_source | MET_AWS·MET_ASOS·SAT_SAR·SAT_OPT·GIS_ADM·GIS_HAZ·GIS_VULN |
| sop_stage / doc_type | S01~S05 / DOC_DAMAGE·RESPONSE·SITUATION·LOG |
| propagation_channel | CBS_EMG·CBS_DIS(공식)·MEDIA_*·SNS_* + 신뢰등급 |
| ai_analysis_type | AI_SUM·AI_PRED·**AI_SIM(유사사례)**·AI_SOP·AI_EVAL·AI_IMG |

### 3.5 재난유형 T코드 택사노미 — 온톨로지 그래프 JSON(taxonomyDomains)
- **facet "T", standard "TTAK.KO-10.1047"**, 3단 깊이 77노드, prefix 매칭(부모 선택 시 하위 자동 포함)
- T1 자연재난: T101 기상(T10105 태풍·T10106 풍수해·T10107 호우 등 8), T102 수문(T10206 홍수 등 6), T103 기후, T104 지질(T10401 산사태 등 3), T105 천문 / T2 사회재난: T201~ (붕괴 T202에 급경사지·댐 포함)
- 모든 SchemaType 노드에 taxonomyCodes 태깅(예: FloodWarningPassage=T102, FloodVulnerableZonePassage=T102)
- 즉 T3Q는 **간이 disaster_type 코드와 T코드 표준 택사노미의 이중 체계**를 쓴다. 사건 ID·속성에는 간이 코드, 분류·필터에는 T코드.

### 3.6 정형 기준선: mois DB와 NDMS
- mois DB(PostgreSQL) 24테이블: 위험지구 도메인 정제 테이블(hazard_zones 14,921 / hazard_zone_details 17,499 / hazard_zone_statuses 22,619 / hazard_reduction_projects 25,540 / management_areas 1,642 / disaster_types 9종=저감계획 재해구분 / administrative_areas 249) + raw_* 스테이징 14종. 원천은 **자연재해저감종합계획 시도 입력 DB(NDMS 계열 엑셀 5종: 기본정보·위험지구속성·지구현황·조사현황·지구단위 시행계획)**. 좌표(lon/lat)는 아직 NULL.
- NDMS 22개 시스템 테이블정의서(재난관리·상황전파·GIS통합상황·침수가뭄급경사지·소하천관리·국민재난안전포털 등) 전량 스키마 수집 → FieldPassage 66,885건·TablePassage 4,885건으로 인스턴스화. **행안부 NDMS 실계 스키마와의 정합을 데이터로 확보하는 접근.**

## 4. 온톨로지 상세 (그래프 JSON: 노드 852·엣지 836)

- 구성: schema 45 + hub 1 + propertyGroup 226 + property 559(전부 터미널) + vocabulary 9 + domain 12
- 스키마 간 연결 51엣지, 유형 8종:
  - `ref_event`(18) 사건 직접 역참조: 경보·보고·통계·관측·AI분석 → Master
  - `spatial`(15) 공간 연결: 취약지구·시설·관측지점 → Master/LegalRegionPassage(법정동)
  - `references`(6) / `type_match`(4, 행동요령·분류) / `relates_to`(3, 동일지구 등) / `derived`(3, **해외참조→Master "유사사례"**) / `code_ref`(2, 용어·SOP지침)
- 유사사례(AI_SIM)가 그래프의 1급 관계로 존재: AIAnalysisPassage↔OverseasDisasterEventPassage(derived/references)
- 역량질의(CQ) 1건 정의: "AI 기반 자연재난(태풍·호우) 대응 지원 서비스 구축 및 실증" — ①군내 어떤 하천이 범람 위험인가 ②저지대 침수 위험 지역 ③급경사지 산사태 위험 지역 ④모니터링할 수위계/우량계 ⑤과거 침수지역. 온톨로지가 이 5개 질문 해결을 목표로 설계된다.
- 샘플 해결 시나리오(00-통합식별 문서): 키워드→Master 검색→도메인 passage를 RefDisasterEventID로 조회→LLM이 EVT ID를 인용해 답변 생성. 홍수취약지구 문서에는 "단일 스키마 내 N-Depth 구조로 복합 질문을 한 번의 검색으로 해결" 시나리오도 있다.

## 5. 인스턴스 구축 현황 (2026-07 중순 기준)

| SchemaType | 인스턴스 | 원천 |
|---|---|---|
| FieldPassage / TablePassage | 66,885 / 4,885 | NDMS 테이블정의서 |
| DisasterMessagePassage | 4,802 | 긴급재난문자 CBS |
| FloodVulnerableZonePassage | 약 250 | 홍수취약지구 관리카드 PDF 249건(하천별: 한강·안양천·태화·형산강 등, 파일당 1건) |
| (SystemRevision·SystemDomain) | 실행 실패 상태 | NDMS |

- 비정형 인스턴스 실례: `ID "25-형산강-1", Name "경북 경주시 천북면 신당리 1399-407(우안) 제방고 부족에 따른 월류위험"` — 취약지구 ID는 `{연도}-{하천}-{순번}`
- 홍수취약지구 관리카드 스키마에 **RiverPlan(측점·계획홍수량·계획홍수위·제방고·고시일)과 FloodRiskSystem(대응수위·참조관측소·단계별 제공수위: 1단계 주의보/2단계 경보·제공방법 SMS/CBS)**이 포함된다.

## 6. 원시 코퍼스 커버리지 (문서관리 기준)

- **소하천정비종합계획: 전국 10개 시도, 시군구·권역 단위 폴더 229개 + PDF 250** — 장(章) 단위 md 변환 완료(예: 의왕시 15파일, 제1장 과업의 개요~제12장, 원본 HWP)
- 조회 확인된 우리 관련 지자체: **의왕시(15)**, **구미시(강동 17·강서 26)**, **인제군(1권역 28·2권역 20)**, **영천시(15)** — 본사업 목표(부산/인제/영천)와 1차 POC(의왕/구미/남원) 지역이 모두 원시 코퍼스에 존재(남원시는 소하천 폴더에 없음, 전북은 고창·군산·김제·무주·순창·완주·익산·장수·전주·진안)
- 홍수취약지구 249, 침수흔적도 23, 재해연보·재난연감 9, 중대본 보고서 8, 보도자료 10 등
- **자연재해저감종합계획_위험지구 폴더는 존재하나 비정형 문서 0건** — 저감계획은 정형(시도 입력 DB) 경로로만 구축됨. 하천기본계획 폴더도 3건뿐
- 참고 폴더: NDMS-Schema, 10-팀문서(95), 샘플·과제·NIA

## 7. 우리 POC와의 정합성

### 7.1 방향 일치 포인트 (대외 어필 가능)
| T3Q 구축 방향 (근거) | 우리 POC 구현 |
|---|---|
| 사건 중심(Event-Centric) 허브 온톨로지, EVENT_ID `{일자}-{유형}-{행정5}-{순번}` (00-통합식별) | 동일 4요소 Event ID `[유형]-[일자]-[행정5]-[순번]` (event_id, 상황입력→EVT 골격) |
| 모든 데이터를 Passage 단위로 구조화, RAG 검색 전제 (전 메뉴) | chunks.jsonl passage_id 체계, BM25+메타 검색 |
| 원본→행 단위 lineage(source_rows) 부착 (DB스키마수집) | source_asset_id→evidence_unit_id→passage_id 체인, 전 응답 citations |
| T코드 택사노미 TTAK.KO-10.1047, 3단 prefix 필터 (그래프 JSON) | chunks hazard_codes T10105/T10106/T10107/T10206/T10401 태깅, 유형 필터 |
| 위기경보 4단계 관심/주의/경계/심각 (00-통합식별) | criteria.json 위기경보 4단계 동일 |
| 저감계획 재해구분 9종(01 하천재해, 03 사면재해…) (mois DB disaster_types) | chunks disaster_kind 동일 축 |
| 홍수취약지구 관리카드: 계획홍수량·계획홍수위·참조관측소·주의보/경보 제공수위 (FloodVulnerableZonePassage) | rivers.json 산정지점·계획홍수량·특보 기준유량, 하천 상세조회 화면 |
| 위험지구 1건=1 Passage (홍수취약지구 인스턴스) | "위험지구 1건=1청크" 청킹 규칙 동일 |
| 문서를 장(章) 단위로 변환·관리 (문서변환) | 장·절 경계 우선 청킹, "장-쪽번호" 근거 표기 |
| 공간 연결: 법정동코드·WGS84·GIS 레이어(spatial 엣지, GIS_HAZ/GIS_VULN) | admin_code·geo.json·VWorld L1~L4 레이어 |
| 유사사례가 표준 AI 분석유형(AI_SIM)·그래프 관계 (00-통합식별, 그래프) | 유사사례 Top-K 모듈 + similarity_factors |
| CQ 5문(하천 범람·저지대 침수·산사태·관측소 모니터링·과거 침수) (역량질의) | 상황입력→검색·지도·상세 시나리오 S1~S3와 동일 질문 구조 |
| RAG 해결 시나리오: Master 검색→역참조→LLM이 ID 인용 답변 (00-통합식별 §6) | /api/search→/api/ask, rag_answer_id·citations 필수 |

### 7.2 차이·유의 사항
- **Event ID 순서/자릿수**: T3Q `20240715-FLOOD-44210-001`(일자 선행·순번 3자리) vs 우리 `INUNDATION-20260723-41430-0001`(유형 선행·4자리). 요소는 동일하므로 표기 변환만으로 호환 — T3Q 규격 확정 시 우리 event_id 생성기를 맞추면 됨(파서 어댑터 1곳).
- **재난유형 코드 이중화**: T3Q는 사건 속성에 간이 코드(FLOOD·TYPH·SLOPE), 분류에 T코드. 우리는 Event 코드(HEAVY_RAIN 등)+T코드 병기. 매핑표 필요: HEAVY_RAIN↔TYPH(태풍·호우)/T10107, FLOOD↔FLOOD/T10206, INUNDATION↔FLOOD(홍수·침수)/T10106, TYPHOON↔TYPH/T10105, LANDSLIDE↔SLOPE/T10401. 특히 T3Q FLOOD가 "홍수·침수"를 포괄하므로 우리 FLOOD/INUNDATION 구분이 더 세분화되어 있음 — 축소 매핑 규칙을 정해둘 것.
- **저감계획 구축 경로**: T3Q는 저감계획을 정형 DB(시도 입력 DB→hazard_zones 14,921) 중심으로, 비정형 본문은 미착수. 우리는 비정형 본문(PDF 6종)+수동 시드 중심. 상호 보완적 — 우리 화면이 "본문 근거(citations)"를 보여주는 차별점이 되고, 향후 T3Q hazard_zones를 districts 데이터 소스로 교체 가능.
- **좌표**: T3Q hazard_zones lon/lat NULL(지오코딩 전). 우리는 VWorld 지오코딩 완료 — 지도 표출은 우리가 선행.
- **표준 코드 미확정**: 간이 disaster_type·전파채널 등은 재난메타 정의서 v0.6의 6패싯(T/P/S/A/R/I)·DCAT 매핑과 아직 별개 체계. 테스트 모듈임을 감안해 v0.6 기준 유지가 안전.

### 7.3 우리 설계 반영 사항
**즉시 반영 가능(우리 쪽 작업):**
1. 재난유형 코드 매핑표(Event 코드↔T3Q 간이 코드↔T코드)를 `data/manual/criteria.json` 또는 meta 응답에 추가 — 챗봇/API가 양쪽 코드를 수용하게.
2. 시연 멘트에 정합 근거 반영: "주관기관 온톨로지의 허브(Event Master)-역참조 구조, T코드 택사노미, 위험지구 1건=1passage, 근거 lineage 원칙을 POC가 동일하게 구현" (docs/07 시연 스크립트 보강).
3. 하천 상세 화면에 "참조관측소·단계별 제공수위" 표기 여지 확인 — T3Q 홍수취약지구 관리카드의 FloodRiskSystem과 필드명 정렬(rivers.json에 이미 특보 기준유량 있음).
4. event_id 생성 유틸에 T3Q 형식(`YYYYMMDD-{TYPE}-{REGION}-{SEQ3}`, `EVT::` 접두) 변환 함수 추가 준비.

**T3Q 확정 대기(모니터링):**
- 재난메타 정의서 v0.6 6패싯과 사이트 온톨로지의 통합 방식(아이타이쿤 검증 결과)
- MCP/Agent 서비스 노출 규격(현재는 내부 변환 Agent·도구 명명만 확인, 대외 API 미노출)
- 저감계획·하천기본계획 비정형 본문 구축 착수 여부(현재 0건) — 착수 시 우리 청킹 규격과의 정렬 협의
- 관계 인스턴스(KG)·속성 마스터 구축(현재 빈 상태), Milvus/OpenSearch 등 검색 스택

## 8. MCP/Agent 관련 확인 (테스트 단계)

- 사이트 내 "Agent"는 **인스턴스 변환 Agent**(SchemaType별 템플릿→실행→로그)로 구현돼 있고, Sheet 도구가 `sheet_passage_extract`·`extract_sheet_from_search`·`extract_sheet_from_sql` 등 도구(tool) 명명 규약을 따른다 — MCP 도구화의 전 단계로 해석된다.
- 대외 노출용 MCP 서버·RAG API 엔드포인트는 이번 조회 범위에서 확인되지 않았다(문서 생성·변환용 LLM 편집 기능만 존재). **우리 services/ 어댑터(llm·retrieval·uni_rag)의 교체 대상 규격은 아직 미확정**이라는 기존 리스크 인식(docs/01 §리스크)이 유효하다.
- 다만 데이터 계층의 계약 요소(Passage·RefDisasterEventID·taxonomyCodes·controlled vocabulary)는 방향이 잡혔으므로, 어댑터 교체 시 응답 매핑(우리 citations/similarity_factors ↔ T3Q passage/linkage)의 골격을 미리 그릴 수 있다.

## 9. 미확인·후속 확인 사항

1. 응용온톨로지 생성 로그·Agent 설정(LLM 프롬프트) 화면 — 실행 유발 우려로 미조회
2. mois DB 데이터 사전(데이터 사전 생성 기능) 산출물 — 생성 버튼이라 미실행
3. 소하천정비종합계획의 passage 인스턴스화 계획(현재 md 변환까지)
4. 09-해외참조·10-정책표준참조 원시 파일 상세 목록
5. 부산(본사업 목표) 데이터 부재 — 소하천 폴더에 부산 없음(테스트 범위로 추정)
6. `NDMS-Schema-20260702-merged`·`10-팀문서/이현석(95파일)` 내용

## 부록. 조회 원자료
세션 스크래치패드 `t3q/` 폴더에 페이지별 수집 원문(00_대시보드 ~ 08_온톨로지그래프, ontology-graph-with-props.json 602KB)을 보관. 필요 시 요청.
