// Provider Fixture 검증 게이트 (Phase 7)
// - provider 6종 × 케이스 3종(대표응답·오류·Timeout)을 .runtime-cjs 컴파일 산출물의 "매퍼 함수"로만 검증한다.
// - 실제 네트워크 호출 금지: fetch를 호출하는 함수(fetchKmaNowcast 등)는 require만 하고 실행하지 않으며,
//   global fetch를 가드로 교체해 호출 0건을 단언한다.
// - 결과는 provider별 lifecycle: "FIXTURE_VALIDATED"로만 기록한다 — DEFAULT 전환 아님, Phase 8 Shadow Test 전 단계.
const fs=require('fs');
const path=require('path');

const kma=require('../../.runtime-cjs/server/providers/kmaNowcast.js');
const hrfco=require('../../.runtime-cjs/server/providers/hrfcoHydrology.js');
const uneRag=require('../../.runtime-cjs/server/providers/uneRag.js');
const t3q=require('../../.runtime-cjs/server/providers/t3qFixtureAdapter.js');

function fail(message){throw new Error(message);}
function assert(condition,message){if(!condition)fail(message);}

// 네트워크 호출 가드: 게이트 실행 중 fetch가 단 한 번이라도 호출되면 즉시 실패시킨다.
let fetchCallCount=0;
globalThis.fetch=()=>{fetchCallCount+=1;throw new Error('provider fixture gate: 실제 네트워크 호출 금지');};

const FIXTURE_ROOT=path.resolve('data/fixtures/providers');
function loadFixture(providerId,file){return JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT,providerId,file),'utf8'));}

// AbortSignal.timeout 초과 시 던져지는 TimeoutError(DOMException)류 모의 객체 — 실 HTTP 없이 오류 경로에 주입한다.
function makeTimeoutError(){const error=new Error('The operation was aborted due to timeout');error.name='TimeoutError';return error;}
// T3Q Adapter는 payload 기반이므로 Timeout 모의 객체를 fixture 오류 형식(result_code/error)으로 감싸 오류 경로에 주입한다.
function timeoutPayload(){const error=makeTimeoutError();return{result_code:error.name,error:{code:error.name,message:error.message}};}

// 대표응답 산출물 전수 스캔: actual로 위장한 값(official_data=true, value_status/data_status='actual')이 0건이어야 한다.
function assertNoActualDisguise(value,where,seen=new Set()){
  if(!value||typeof value!=='object'||seen.has(value))return;
  seen.add(value);
  if(Array.isArray(value)){value.forEach((item,i)=>assertNoActualDisguise(item,`${where}[${i}]`,seen));return;}
  assert(value.official_data!==true,`${where}: official_data=true 위장 발견`);
  assert(value.value_status!=='actual',`${where}: value_status=actual 위장 발견`);
  assert(value.data_status!=='actual',`${where}: data_status=actual 위장 발견`);
  for(const[key,child]of Object.entries(value))assertNoActualDisguise(child,`${where}.${key}`,seen);
}

const OBSERVATION_FIELDS=['observation_id','type','station_id','name','value','unit','observed_at','source_provider','value_status','official_data'];
function assertObservationContract(obs,where){
  for(const field of OBSERVATION_FIELDS)assert(obs[field]!==undefined,`${where}: Observation 계약 필드 결손 ${field}`);
  assert(obs.value_status==='mock',`${where}: value_status가 mock이 아님 (${obs.value_status})`);
  assert(obs.official_data===false,`${where}: official_data가 false가 아님`);
}

// mapHrfcoFixturePayload용 표본 관측소 설정 — SAMPLE-ST-01은 명백한 표본코드이며 홍수통제소 공식 관측소 코드가 아니다(v0.7 규칙 3).
const HRFCO_SAMPLE_STATION={admin_code:'99999',official_station_code:'SAMPLE-ST-01',official_station_name:'표본 관측지점(POC)',river_name:'표본하천'};

// provider 6종 × 케이스 3종 정의. run()은 매퍼 함수만 실행한다(실 fetch 함수 실행 금지).
const PROVIDERS=[
  {
    provider_id:'kma_nowcast',
    fetch_only_required:typeof kma.fetchKmaNowcast==='function',
    cases:[
      {case_id:'KMA-REP-01',kind:'representative',run(){
        const result=kma.mapKmaFixturePayload(loadFixture('kma_nowcast','representative_response.json'),{adminCode:'41430'});
        assert(result.observations.length===8,`KMA 대표응답 Observation 8건 아님 (${result.observations.length})`);
        const types=new Set(result.observations.map(o=>o.type));
        for(const type of['RAINFALL_1H','TEMPERATURE','HUMIDITY','WIND_SPEED','WIND_DIRECTION','PRECIPITATION_TYPE','WIND_EAST_WEST','WIND_NORTH_SOUTH'])assert(types.has(type),`KMA CATEGORY 매핑 누락: ${type}`);
        result.observations.forEach((obs,i)=>{assertObservationContract(obs,`kma_nowcast.observations[${i}]`);assert(obs.source_provider.includes('FixtureValidation'),`kma[${i}]: fixture provider 표기 누락`);});
        assertNoActualDisguise(result,'kma_nowcast.representative');
      }},
      {case_id:'KMA-ERR-01',kind:'error',run(){
        let result;
        try{result=kma.mapKmaFixturePayload(loadFixture('kma_nowcast','error_response.json'),{adminCode:'41430'});}
        catch(error){fail(`KMA 오류 payload에서 예외 전파: ${error.message}`);}
        assert(result.observations.length===0,'KMA 오류 시 Observation이 비어있지 않음');
        assert(typeof result.warning==='string'&&result.warning.includes('기상청')&&result.warning.includes('30'),`KMA 오류 warning 형식 불일치: ${result.warning}`);
      }},
      {case_id:'KMA-TMO-01',kind:'timeout',run(){
        const result=kma.mapKmaFixtureError(makeTimeoutError());
        assert(result.observations.length===0,'KMA Timeout 시 Observation이 비어있지 않음');
        assert(result.warning.startsWith('기상청 초단기실황 호출 실패:')&&result.warning.includes('timeout'),`KMA Timeout Fallback warning 불일치: ${result.warning}`);
      }},
    ],
  },
  {
    provider_id:'hrfco_hydrology',
    fetch_only_required:typeof hrfco.fetchHrfcoHydrology==='function',
    cases:[
      {case_id:'HRFCO-REP-01',kind:'representative',run(){
        const result=hrfco.mapHrfcoFixturePayload(loadFixture('hrfco_hydrology','representative_response.json'),{adminCode:'99999',station:HRFCO_SAMPLE_STATION});
        assert(result.observations.length===2,`HRFCO 대표응답 Observation 2건 아님 (${result.observations.length})`);
        const byType=Object.fromEntries(result.observations.map(o=>[o.type,o]));
        assert(byType.WATER_LEVEL&&byType.WATER_LEVEL.value===1.23,'HRFCO WATER_LEVEL=1.23 매핑 실패');
        assert(byType.FLOW_RATE&&byType.FLOW_RATE.value===45.6,'HRFCO FLOW_RATE=45.6 매핑 실패');
        result.observations.forEach((obs,i)=>{
          assertObservationContract(obs,`hrfco_hydrology.observations[${i}]`);
          assert(obs.observed_at==='2026-07-31T09:00:00+09:00',`hrfco[${i}]: observed_at 정규화 실패 (${obs.observed_at})`);
          assert(obs.station_id==='SAMPLE-ST-01',`hrfco[${i}]: 표본 관측소 코드 미유지 (${obs.station_id})`);
          assert(obs.source_provider.includes('FixtureValidation'),`hrfco[${i}]: fixture provider 표기 누락`);
        });
        assertNoActualDisguise(result.observations,'hrfco_hydrology.representative.observations');
      }},
      {case_id:'HRFCO-ERR-01',kind:'error',run(){
        let result;
        try{result=hrfco.mapHrfcoFixturePayload(loadFixture('hrfco_hydrology','error_response.json'),{adminCode:'99999',station:HRFCO_SAMPLE_STATION});}
        catch(error){fail(`HRFCO 오류 payload에서 예외 전파: ${error.message}`);}
        assert(result.observations.length===0,'HRFCO 오류 시 Observation이 비어있지 않음');
        assert(typeof result.warning==='string'&&result.warning.includes('수위·유량 필드를 찾지 못했습니다'),`HRFCO 오류 warning 불일치: ${result.warning}`);
      }},
      {case_id:'HRFCO-TMO-01',kind:'timeout',run(){
        const result=hrfco.mapHrfcoFixtureError(makeTimeoutError(),{adminCode:'99999',station:HRFCO_SAMPLE_STATION});
        assert(result.observations.length===0,'HRFCO Timeout 시 Observation이 비어있지 않음');
        assert(result.warning.startsWith('홍수통제소 수위·유량 호출 실패:')&&result.warning.includes('timeout'),`HRFCO Timeout Fallback warning 불일치: ${result.warning}`);
      }},
    ],
  },
  {
    provider_id:'une_rag',
    fetch_only_required:typeof uneRag.searchUneRag==='function',
    cases:[
      {case_id:'UNERAG-REP-01',kind:'representative',run(){
        const result=uneRag.mapUneRagFixturePayload(loadFixture('une_rag','representative_response.json'));
        assert(result.results.length===2,`UNE RAG 대표응답 2건 아님 (${result.results.length})`);
        assert(result.results[0].evidence_id==='UNE-RAG-SAMPLE-PSG-0001',`UNE RAG evidence_id 형식 불일치: ${result.results[0].evidence_id}`);
        result.results.forEach((item,i)=>{
          for(const field of['evidence_id','source_type','title','content','excerpt','data_status'])assert(item[field]!==undefined&&item[field]!=='',`une_rag[${i}]: 계약 필드 결손 ${field}`);
          assert(item.source_type==='UNE_RAG_PASSAGE',`une_rag[${i}]: source_type 불일치`);
          assert(item.excerpt.length<=360,`une_rag[${i}]: excerpt 360자 초과`);
          assert(typeof item.score==='number'&&typeof item.rag_score==='number',`une_rag[${i}]: score/rag_score 결손`);
          assert(item.data_status==='mock',`une_rag[${i}]: data_status가 mock이 아님 (${item.data_status})`);
          assert(item.metadata&&item.metadata.fixture_validation===true,`une_rag[${i}]: fixture_validation metadata 누락`);
        });
        assertNoActualDisguise(result,'une_rag.representative');
      }},
      {case_id:'UNERAG-ERR-01',kind:'error',run(){
        // HTTP 401 + 오류 본문: payload 경로는 결과 배열을 찾지 못해 warning Fallback, 오류 매퍼는 catch 분기와 동일 문구를 산출한다.
        let payloadResult;
        try{payloadResult=uneRag.mapUneRagFixturePayload(loadFixture('une_rag','error_response.json'));}
        catch(error){fail(`UNE RAG 오류 payload에서 예외 전파: ${error.message}`);}
        assert(payloadResult.results.length===0,'UNE RAG 오류 payload에서 결과가 비어있지 않음');
        assert(typeof payloadResult.warning==='string'&&payloadResult.warning.length>0,'UNE RAG 오류 payload warning 누락');
        const errorResult=uneRag.mapUneRagFixtureError(new Error('HTTP 401'));
        assert(errorResult.results.length===0,'UNE RAG HTTP 401 시 결과가 비어있지 않음');
        assert(errorResult.warning==='UNE RAG 호출 실패: HTTP 401',`UNE RAG 오류 Fallback warning 불일치: ${errorResult.warning}`);
      }},
      {case_id:'UNERAG-TMO-01',kind:'timeout',run(){
        const result=uneRag.mapUneRagFixtureError(makeTimeoutError());
        assert(result.results.length===0,'UNE RAG Timeout 시 결과가 비어있지 않음');
        assert(result.warning.startsWith('UNE RAG 호출 실패:')&&result.warning.includes('timeout'),`UNE RAG Timeout Fallback warning 불일치: ${result.warning}`);
      }},
    ],
  },
  {
    provider_id:'t3q_event',
    fetch_only_required:true,
    cases:[
      {case_id:'T3QEVT-REP-01',kind:'representative',run(){
        const result=t3q.mapT3qEventFixture(loadFixture('t3q_event','representative_response.json'));
        assert(result.events.length===1&&result.passages.length===1,`T3Q Event 대표응답 매핑 건수 불일치 (events=${result.events.length}, passages=${result.passages.length})`);
        const event=result.events[0];
        for(const field of['event_id','disaster_type','taxonomy_codes','region_code_5','sequence','event_status'])assert(event[field]!==undefined&&event[field]!==null,`t3q_event.event: 계약 필드 결손 ${field}`);
        assert(event.taxonomy_codes.length===2,'t3q_event: taxonomy_codes 미보존');
        const passage=result.passages[0];
        for(const field of['passage_id','schema_type','ref_disaster_event_id','lineage','data_status'])assert(passage[field]!==undefined&&passage[field]!==null,`t3q_event.passage: 계약 필드 결손 ${field}`);
        assert(passage.ref_disaster_event_id===event.event_id,'t3q_event: Passage→Event 참조 불일치');
        assert(passage.lineage.source_asset_id&&passage.lineage.source_file&&passage.lineage.version,'t3q_event: lineage 결손');
        assert(passage.data_status==='mock','t3q_event: passage data_status가 mock이 아님');
        assert(typeof result.warning==='string'&&result.warning.includes('실제 T3Q 데이터'),'t3q_event: 실데이터 아님 고지 누락');
        assertNoActualDisguise(result,'t3q_event.representative');
      }},
      {case_id:'T3QEVT-ERR-01',kind:'error',run(){
        let result;
        try{result=t3q.mapT3qEventFixture(loadFixture('t3q_event','error_response.json'));}
        catch(error){fail(`T3Q Event 오류 payload에서 예외 전파: ${error.message}`);}
        assert(result.events.length===0&&result.passages.length===0,'T3Q Event 오류 시 결과가 비어있지 않음');
        assert(typeof result.warning==='string'&&result.warning.includes('AUTH_FAILED')&&result.warning.includes('Fallback'),`T3Q Event 오류 warning 불일치: ${result.warning}`);
      }},
      {case_id:'T3QEVT-TMO-01',kind:'timeout',run(){
        const result=t3q.mapT3qEventFixture(timeoutPayload());
        assert(result.events.length===0&&result.passages.length===0,'T3Q Event Timeout 시 결과가 비어있지 않음');
        assert(typeof result.warning==='string'&&result.warning.includes('TimeoutError')&&result.warning.includes('Fallback'),`T3Q Event Timeout warning 불일치: ${result.warning}`);
      }},
    ],
  },
  {
    provider_id:'t3q_risk',
    fetch_only_required:true,
    cases:[
      {case_id:'T3QRSK-REP-01',kind:'representative',run(){
        const result=t3q.mapT3qRiskFixture(loadFixture('t3q_risk','representative_response.json'));
        assert(result.risks.length===1,`T3Q Risk 대표응답 1건 아님 (${result.risks.length})`);
        assert(Object.keys(result.missing_required_fields).length===0,`T3Q Risk required_fields 결손: ${JSON.stringify(result.missing_required_fields)}`);
        const risk=result.risks[0];
        for(const field of t3q.T3Q_RISK_REQUIRED_FIELDS)assert(risk[field]!==undefined&&risk[field]!==null,`t3q_risk: 계약 필드 결손 ${field}`);
        assert(risk.official_data===false&&risk.data_status==='mock'&&risk.is_prediction===false,'t3q_risk: mock/비예측 상태 결손');
        assert(risk.geometry_ref.geometry_status==='mock','t3q_risk: geometry_ref mock 상태 미보존');
        assert(risk.evidence.length===1&&risk.evidence[0].passage_id==='SAMPLE-T3Q-PSG-0002','t3q_risk: evidence 매핑 실패');
        assert(result.official_data===false&&result.data_status==='mock','t3q_risk: 결과 mock 상태 결손');
        assertNoActualDisguise(result,'t3q_risk.representative');
      }},
      {case_id:'T3QRSK-ERR-01',kind:'error',run(){
        let result;
        try{result=t3q.mapT3qRiskFixture(loadFixture('t3q_risk','error_response.json'));}
        catch(error){fail(`T3Q Risk 오류 payload에서 예외 전파: ${error.message}`);}
        assert(result.risks.length===0,'T3Q Risk NO_DATA 시 결과가 비어있지 않음');
        assert(result.fallback==='local_plan_seed',`T3Q Risk Fallback 불일치: ${result.fallback}`);
        assert(typeof result.warning==='string'&&result.warning.includes('NO_DATA')&&result.warning.includes('임의 위험정보를 합성하지 않습니다'),`T3Q Risk 오류 warning 불일치: ${result.warning}`);
      }},
      {case_id:'T3QRSK-TMO-01',kind:'timeout',run(){
        const result=t3q.mapT3qRiskFixture(timeoutPayload());
        assert(result.risks.length===0,'T3Q Risk Timeout 시 결과가 비어있지 않음');
        assert(result.fallback==='local_plan_seed',`T3Q Risk Timeout Fallback 불일치: ${result.fallback}`);
        assert(typeof result.warning==='string'&&result.warning.includes('TimeoutError'),`T3Q Risk Timeout warning 불일치: ${result.warning}`);
      }},
    ],
  },
  {
    provider_id:'t3q_spatial',
    fetch_only_required:true,
    cases:[
      {case_id:'T3QSPA-REP-01',kind:'representative',run(){
        const result=t3q.mapT3qSpatialFixture(loadFixture('t3q_spatial','representative_response.json'));
        const features=result.feature_collection.features;
        assert(features.length===2,`T3Q Spatial 대표응답 Feature 2건 아님 (${features.length})`);
        assert(features[0].geometry&&features[0].geometry.type==='Polygon'&&features[1].geometry&&features[1].geometry.type==='Point','T3Q Spatial Polygon/Point 매핑 실패');
        assert(Object.keys(result.missing_required_fields).length===0,`T3Q Spatial required_fields 결손: ${JSON.stringify(result.missing_required_fields)}`);
        assert(result.map_activation_allowed===false&&result.geometry_status==='mock','T3Q Spatial 지도 활성화 금지·mock 상태 결손');
        assert(result.feature_collection.crs!==null,'T3Q Spatial crs 결손');
        features.forEach((feature,i)=>{
          const p=feature.properties;
          assert(p.map_activation_allowed===false&&p.official_data===false&&p.data_status==='mock'&&p.is_prediction===false,`t3q_spatial.features[${i}]: mock/활성화 금지 상태 결손`);
        });
        assert(result.official_data===false&&result.data_status==='mock','t3q_spatial: 결과 mock 상태 결손');
        assertNoActualDisguise(result,'t3q_spatial.representative');
      }},
      {case_id:'T3QSPA-ERR-01',kind:'error',run(){
        let result;
        try{result=t3q.mapT3qSpatialFixture(loadFixture('t3q_spatial','error_response.json'));}
        catch(error){fail(`T3Q Spatial 오류 payload에서 예외 전파: ${error.message}`);}
        assert(result.feature_collection.features.length===0,'T3Q Spatial 오류 시 Feature가 비어있지 않음');
        assert(result.fallback==='local_geojson_provider',`T3Q Spatial Fallback 불일치: ${result.fallback}`);
        assert(result.geometry_status==='not_available','T3Q Spatial 오류 시 geometry_status 불일치');
        assert(typeof result.warning==='string'&&result.warning.includes('CRS_NOT_CONFIRMED')&&result.warning.includes('임의 표출 없이'),`T3Q Spatial 오류 warning 불일치: ${result.warning}`);
      }},
      {case_id:'T3QSPA-TMO-01',kind:'timeout',run(){
        const result=t3q.mapT3qSpatialFixture(timeoutPayload());
        assert(result.feature_collection.features.length===0,'T3Q Spatial Timeout 시 Feature가 비어있지 않음');
        assert(result.fallback==='local_geojson_provider',`T3Q Spatial Timeout Fallback 불일치: ${result.fallback}`);
        assert(typeof result.warning==='string'&&result.warning.includes('TimeoutError'),`T3Q Spatial Timeout warning 불일치: ${result.warning}`);
      }},
    ],
  },
];

function main(){
  const validatedAt=new Date().toISOString();
  const providers=[];
  const failures=[];
  for(const provider of PROVIDERS){
    assert(provider.fetch_only_required,`${provider.provider_id}: fetch 함수 require 실패`);
    const cases=[];
    for(const testCase of provider.cases){
      let pass=true;
      try{testCase.run();}
      catch(error){pass=false;failures.push(`${provider.provider_id}/${testCase.case_id}: ${error.message}`);}
      cases.push({case_id:testCase.case_id,kind:testCase.kind,pass});
    }
    providers.push({
      provider_id:provider.provider_id,
      lifecycle:cases.every(c=>c.pass)?'FIXTURE_VALIDATED':'DRAFT',
      cases,
      validated_at:validatedAt,
    });
  }
  assert(fetchCallCount===0,`게이트 실행 중 네트워크 호출 시도 ${fetchCallCount}건 감지`);

  const totalCases=providers.reduce((sum,p)=>sum+p.cases.length,0);
  const passedCases=providers.reduce((sum,p)=>sum+p.cases.filter(c=>c.pass).length,0);
  const result={
    generated_at:validatedAt,
    gate:'provider-fixture-gate',
    source_version:'1.5.1-provider-fixture-gate',
    runtime_mode:'FIXTURE_ONLY_NO_NETWORK',
    note:'FIXTURE_VALIDATED는 fixture 매핑 검증 완료 상태이며 DEFAULT 전환이 아니다. 실제 T3Q·공공 API 호출 없음. Phase 8 Shadow Test 전 단계.',
    network_calls:fetchCallCount,
    summary:{providers:providers.length,cases:totalCases,pass:passedCases,fail:totalCases-passedCases},
    providers,
  };
  fs.writeFileSync(path.resolve('tests/provider/provider_fixture_validation_result.json'),JSON.stringify(result,null,2));

  const rows=providers.flatMap(p=>p.cases.map(c=>`| ${p.provider_id} | ${c.case_id} | ${c.kind} | ${c.pass?'PASS':'FAIL'} | ${p.lifecycle} |`)).join('\n');
  const md=`# Provider Fixture Validation 결과

- 생성시각: ${validatedAt}
- 대상: provider 6종 × 케이스 3종(대표응답·오류·Timeout) = ${totalCases}건 (통과 ${passedCases}건)
- 실행 방식: \`.runtime-cjs\` CJS 컴파일 산출물의 fixture 매퍼 함수만 실행 (fetch 호출 함수는 require만, 실행 0건 — 네트워크 호출 ${fetchCallCount}건)

## 케이스별 결과

| Provider | Case | 종류 | 결과 | Lifecycle |
|---|---|---|---|---|
${rows}

## 상태 구분 (v1.1 준비상태 규칙)

- 본 결과의 \`FIXTURE_VALIDATED\`는 "대표응답·오류·Timeout이 fixture로 검증됨" 상태이며, "URL·인증키가 설정됨"(configured)과 구분된다.
- **DEFAULT 전환 아님**: 어떤 Provider도 기본 Provider로 전환하지 않으며 Mock/Seed 기본운영을 유지한다.
- **실호출 없음**: 실제 T3Q·공공 Open API·UNE RAG 호출을 수행하지 않았다. 게이트는 global fetch 가드로 네트워크 호출 0건을 단언한다.
- **Phase 8 Shadow Test 전 단계**: SHADOW_TESTED→SELECTABLE 승격은 Phase 8에서 승인 기반으로만 진행한다.
- fixture 유래 산출값은 전부 \`official_data=false\`·mock 상태이며 실제 관측·공식자료로 표시하지 않는다.
`;
  fs.writeFileSync(path.resolve('tests/provider/PROVIDER_FIXTURE_VALIDATION.md'),md);

  if(failures.length){
    console.error(`FAIL provider fixture gate: ${failures.length}건 실패`);
    for(const failure of failures)console.error(` - ${failure}`);
    process.exit(1);
  }
  console.log(`PASS provider fixture gate: ${providers.length} providers x 3 cases = ${totalCases} (all FIXTURE_VALIDATED, network calls: ${fetchCallCount})`);
}

try{main();}catch(error){console.error('FAIL provider fixture gate:',error.stack||error);process.exit(1);}
