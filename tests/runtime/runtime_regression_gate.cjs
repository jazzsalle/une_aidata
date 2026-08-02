const fs=require('fs');
const path=require('path');
const {searchSimilarEvents}=require('../../.runtime-cjs/server/domain/similarEvents.js');
const {searchT3qPreview}=require('../../.runtime-cjs/server/providers/t3qGateway.js');
const {POST:reportPost}=require('../../.runtime-cjs/server/routes/v1/reports/drafts.js');
const catchAll=require('../../.runtime-cjs/api/index.js');
const seed=require('../../.runtime-cjs/server/seeds.js').seed;

function fail(message){throw new Error(message);}
function assert(condition,message){if(!condition)fail(message);}
function approx(a,b,tolerance=0.25){return Math.abs(a-b)<=tolerance;}
function getRequiredChecks(situation){const raw=situation.user_input?.required_checks;return Array.isArray(raw)?raw.map(String):[];}
function eventSummary(event,rank){return{
  rank,
  event_id:event.event_id,
  event_name:event.event_name,
  admin_code:event.admin_code,
  score:event.similarity.event_similarity_score,
  coverage:event.similarity.comparison_coverage,
  confidence:event.similarity.confidence_status,
  graph:event.similarity.graph_similarity_status,
  factors:event.similarity.factors.map(f=>({code:f.factor_code,name:f.factor_name,availability:f.availability,weight:f.weight,effective_weight:f.effective_weight,normalized_score:f.normalized_score,contribution_score:f.contribution_score})),
  response_comparison:event.response_comparison.map(r=>({current:r.current_required_check,past:r.past_event_action,difference:r.difference,confirm:r.operator_confirmation_required})),
  data_status:event.data_status,
  official_data:event.official_data
};}

async function main(){
  const situations=seed.currentSituations.situations;
  const eventRecords=seed.damageRecovery.records;
  const cqScenarios=seed.t3qMockSearchScenarios.scenarios;
  assert(eventRecords.length===15,`Mock Event 수가 15가 아님: ${eventRecords.length}`);
  assert(situations.length===5,`회귀 상황 수가 5가 아님: ${situations.length}`);
  assert(cqScenarios.length===5,`CQ 시나리오 수가 5가 아님: ${cqScenarios.length}`);

  const expectedTop={
    'SIT-NW-POC-001':'EVT::20230809-FLOOD-45190-902',
    'SIT-UW-POC-001':'EVT::20240718-FLOOD-41430-901',
    'SIT-GM-POC-001':'EVT::20230810-TYPH-47190-901',
    'SIT-UW-SLOPE-POC-001':'EVT::20240805-SLOPE-41430-901',
    'SIT-GM-SLOPE-POC-001':'EVT::20240712-SLOPE-47190-901'
  };
  const result={
    generated_at:new Date().toISOString(),
    source_version:'1.4.0-runtime-gate',
    runtime_mode:'MOCK_PROVIDER_NEUTRAL',
    npm_install:{status:'BLOCKED',reason:'내부 npm registry에서 React/Vite/@playwright/test 패키지 조회 404. 전체 React production build는 외부 개발환경에서 재실행 필요.'},
    counts:{events:eventRecords.length,situations:situations.length,cq:cqScenarios.length},
    rankings:[],cq_results:[],report_results:[],catch_all_results:[],checks:[]
  };

  for(const situation of situations){
    const first=await searchSimilarEvents(situation,15);
    const second=await searchSimilarEvents(situation,15);
    assert(first.events.length===15,`${situation.situation_id}: 15개 Event 전체 순위 미생성 (${first.events.length})`);
    assert(new Set(first.events.map(e=>e.event_id)).size===15,`${situation.situation_id}: Event ID 중복`);
    assert(first.events[0]?.event_id===expectedTop[situation.situation_id],`${situation.situation_id}: 예상 1위 불일치 (${first.events[0]?.event_id})`);
    assert(first.events.map(e=>e.event_id).join('|')===second.events.map(e=>e.event_id).join('|'),`${situation.situation_id}: 반복 실행 순위 비결정적`);
    for(let i=1;i<first.events.length;i++)assert(first.events[i-1].similarity_score>=first.events[i].similarity_score,`${situation.situation_id}: 점수 내림차순 위반 at ${i}`);

    const required=getRequiredChecks(situation);
    first.events.forEach((event,index)=>{
      const available=event.similarity.factors.filter(f=>f.availability==='AVAILABLE');
      const unavailable=event.similarity.factors.filter(f=>f.availability==='NOT_AVAILABLE');
      assert(event.similarity.factors.length===7,`${situation.situation_id}/${event.event_id}: 요인 7종 아님`);
      assert(event.similarity.graph_similarity_status==='NOT_AVAILABLE',`${event.event_id}: Graph 상태가 NOT_AVAILABLE 아님`);
      assert(event.similarity.graph_similarity_score===null,`${event.event_id}: Graph 점수가 null 아님`);
      assert(available.every(f=>f.normalized_score>=0&&f.normalized_score<=1),`${event.event_id}: normalized_score 범위 오류`);
      assert(unavailable.every(f=>f.normalized_score===null&&f.contribution_score===0),`${event.event_id}: 결측요인 처리 오류`);
      const effective=available.reduce((sum,f)=>sum+f.effective_weight,0);
      if(available.length)assert(approx(effective,100,0.6),`${event.event_id}: 유효가중치 합계 ${effective}`);
      const contribution=available.reduce((sum,f)=>sum+f.contribution_score,0);
      assert(approx(Math.round(contribution),event.similarity_score,1),`${event.event_id}: 기여도 합계 ${contribution} != 점수 ${event.similarity_score}`);
      assert(event.similarity.comparison_coverage===event.similarity.available_weight,`${event.event_id}: 비교범위/가용가중치 불일치`);
      assert(event.response_comparison.length===(required.length||1),`${event.event_id}: 대응비교 건수 불일치`);
      assert(event.response_comparison.every(r=>r.operator_confirmation_required===true),`${event.event_id}: 담당자 확인 플래그 누락`);
      assert(event.is_prediction===false,`${event.event_id}: 예측 플래그 오류`);
      assert(event.official_data===false,`${event.event_id}: Mock/Seed 공식데이터 오표기`);
      if(index===0)assert(event.response_comparison.some(r=>r.past_event_action!==null),`${event.event_id}: 1위 사례 대응비교 과거조치 미확보`);
    });

    result.rankings.push({
      situation_id:situation.situation_id,
      admin_code:situation.admin_code,
      admin_name:situation.admin_name,
      hazards:situation.hazards,
      expected_top_event_id:expectedTop[situation.situation_id],
      warnings:first.warnings,
      events:first.events.map((event,index)=>eventSummary(event,index+1))
    });

    const selected=first.events[0];
    const selection={similar_event_ids:[selected.event_id],include_flood_trace:true,updated_at:new Date().toISOString()};
    const request=new Request('http://runtime.local/api/v1/reports/drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({situation,selected_evidence:selection})});
    const response=await reportPost(request);
    assert(response.ok,`${situation.situation_id}: 보고서 API 실패 ${response.status}`);
    const envelope=await response.json();
    const report=envelope.data;
    const refs=report.sections.reference_evidence.similar_events;
    assert(refs.length===1,`${situation.situation_id}: 보고서 유사사례 선택 1건 미반영`);
    assert(refs[0].event_id===selected.event_id,`${situation.situation_id}: 보고서 Event ID 불일치`);
    assert(refs[0].similarity_factors.length===7,`${situation.situation_id}: 보고서 요인점수 누락`);
    assert(refs[0].response_comparison.length===required.length,`${situation.situation_id}: 보고서 대응비교 누락`);
    assert(report.sections.priority_areas.length>0,`${situation.situation_id}: 보고서 우선확인지역 누락`);
    assert(report.ndms_submission===false,`${situation.situation_id}: NDMS 자동제출 플래그 오류`);
    result.report_results.push({situation_id:situation.situation_id,report_id:report.report_id,selected_event_id:selected.event_id,similar_event_count:refs.length,factor_count:refs[0].similarity_factors.length,response_comparison_count:refs[0].response_comparison.length,priority_area_count:report.sections.priority_areas.length,ndms_submission:report.ndms_submission});
  }

  for(const scenario of cqScenarios){
    const preview=await searchT3qPreview({query:scenario.query,admin_code:scenario.admin_code,taxonomy_codes:scenario.taxonomy_codes,schema_types:scenario.schema_types,top_k:15});
    const eventIds=preview.events.map(e=>e.event_id);
    const passageIds=preview.passages.map(p=>p.passage_id);
    for(const expected of scenario.expected_event_ids)assert(eventIds.includes(expected),`${scenario.cq_id}: 예상 Event 미포함 ${expected}`);
    assert(preview.passages.length>0,`${scenario.cq_id}: Passage 결과 없음`);
    assert(preview.passages.every(p=>p.ref_disaster_event_id&&eventIds.includes(p.ref_disaster_event_id)),`${scenario.cq_id}: Passage→Event 참조 불일치`);
    assert(preview.passages.every(p=>p.lineage&&Object.keys(p.lineage).length>0),`${scenario.cq_id}: lineage 누락`);
    result.cq_results.push({cq_id:scenario.cq_id,title:scenario.title,query:scenario.query,event_ids:eventIds,passage_ids:passageIds,schemas:[...new Set(preview.passages.map(p=>p.schema_type))],warnings:preview.warnings});
  }

  // Catch-all(api/index.ts) 디스패치 검증: 정상 200 envelope / 미등록 404 / 메서드 불일치 405
  assert(typeof catchAll.GET==='function'&&typeof catchAll.POST==='function','catch-all: GET/POST 핸들러 미노출');
  const healthResponse=await catchAll.GET(new Request('http://runtime.local/api/health'));
  assert(healthResponse.status===200,`catch-all: /api/health 상태 ${healthResponse.status} != 200`);
  const healthEnvelope=await healthResponse.json();
  assert(healthEnvelope&&typeof healthEnvelope==='object'&&'data'in healthEnvelope,'catch-all: envelope data 누락');
  assert(healthEnvelope.meta&&typeof healthEnvelope.meta.request_id==='string'&&typeof healthEnvelope.meta.provider==='string'&&typeof healthEnvelope.meta.data_status==='string'&&typeof healthEnvelope.meta.generated_at==='string','catch-all: envelope meta 형식 오류');
  assert(Array.isArray(healthEnvelope.warnings)&&Array.isArray(healthEnvelope.errors),'catch-all: envelope warnings/errors 배열 아님');
  assert(healthEnvelope.errors.length===0,'catch-all: /api/health 정상응답에 errors 존재');
  const notFoundResponse=await catchAll.GET(new Request('http://runtime.local/api/no-such-route'));
  assert(notFoundResponse.status===404,`catch-all: 미등록 경로 상태 ${notFoundResponse.status} != 404`);
  const notFoundEnvelope=await notFoundResponse.json();
  assert(Array.isArray(notFoundEnvelope.errors)&&notFoundEnvelope.errors.length>0,'catch-all: 404 envelope errors 누락');
  const methodMismatchResponse=await catchAll.POST(new Request('http://runtime.local/api/health',{method:'POST'}));
  assert(methodMismatchResponse.status===405,`catch-all: 메서드 불일치 상태 ${methodMismatchResponse.status} != 405`);
  const methodMismatchEnvelope=await methodMismatchResponse.json();
  assert(Array.isArray(methodMismatchEnvelope.errors)&&methodMismatchEnvelope.errors.length>0,'catch-all: 405 envelope errors 누락');
  result.catch_all_results=[
    {case:'GET /api/health',status:healthResponse.status,expected:200,envelope:true},
    {case:'GET /api/no-such-route',status:notFoundResponse.status,expected:404,envelope:true},
    {case:'POST /api/health',status:methodMismatchResponse.status,expected:405,envelope:true}
  ];

  result.checks=[
    {id:'RG-01',name:'15 Event 전체 순위·결정성',status:'PASS'},
    {id:'RG-02',name:'요인별 점수·가중치 재정규화',status:'PASS'},
    {id:'RG-03',name:'현재 확인사항·과거 대응비교',status:'PASS'},
    {id:'RG-04',name:'CQ 5문 Event·Passage·lineage',status:'PASS'},
    {id:'RG-05',name:'보고서 선택근거·점수·대응비교 연계',status:'PASS'},
    {id:'RG-06',name:'React/Vite Production Build',status:'BLOCKED',note:result.npm_install.reason}
  ];

  const jsonPath=path.resolve('tests/runtime/runtime_regression_result.json');
  fs.writeFileSync(jsonPath,JSON.stringify(result,null,2));
  fs.mkdirSync(path.resolve('preview/runtime-regression'),{recursive:true});
  fs.writeFileSync(path.resolve('preview/runtime-regression/runtime_regression_result.json'),JSON.stringify(result,null,2));

  const rows=result.checks.map(c=>`| ${c.id} | ${c.name} | ${c.status} | ${c.note??''} |`).join('\n');
  const rankingRows=result.rankings.map(r=>`| ${r.situation_id} | ${r.admin_name} | ${r.events[0].event_id} | ${r.events[0].score} | ${r.events.length} |`).join('\n');
  const cqRows=result.cq_results.map(r=>`| ${r.cq_id} | ${r.title} | ${r.event_ids.join(', ')} | ${r.passage_ids.length} |`).join('\n');
  const md=`# Runtime Regression Gate 결과\n\n- 생성시각: ${result.generated_at}\n- Event: ${result.counts.events}건\n- 상황: ${result.counts.situations}건\n- CQ: ${result.counts.cq}건\n- 런타임 모드: ${result.runtime_mode}\n\n## 종합 결과\n\n| ID | 검증항목 | 결과 | 비고 |\n|---|---|---|---|\n${rows}\n\n## 화면 순위 검증\n\n| 상황 ID | 지역 | 1위 Event | 점수 | 순위대상 |\n|---|---|---|---:|---:|\n${rankingRows}\n\n## CQ 5문 검증\n\n| CQ | 질문 | Event | Passage 수 |\n|---|---|---|---:|\n${cqRows}\n\n## 제한사항\n\n${result.npm_install.reason}\n\nCore Domain/API와 독립 브라우저 회귀 대시보드는 검증했으나, React·Vite 실제 Production Build 및 기존 React 화면 E2E는 패키지 설치가 가능한 개발환경에서 재실행해야 한다.\n`;
  fs.writeFileSync(path.resolve('tests/runtime/RUNTIME_REGRESSION_RESULT.md'),md);
  console.log(`PASS runtime regression: ${result.counts.events} events, ${result.counts.situations} situations, ${result.counts.cq} CQ`);
}

main().catch(error=>{console.error('FAIL runtime regression:',error.stack||error);process.exit(1);});
