import { useEffect, useState } from 'react';
import type { T3qMockSearchScenario, T3qSearchPreview } from '../types/contracts';
import { loadT3qMockScenarios, searchT3qMock } from '../services/apiClient';

export function T3qMockSearchPanel({adminCode}:{adminCode?:string}){
  const [scenarios,setScenarios]=useState<T3qMockSearchScenario[]>([]);
  const [selected,setSelected]=useState<string>('');
  const [query,setQuery]=useState('관내 어떤 하천이 범람 위험인가');
  const [result,setResult]=useState<T3qSearchPreview|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{loadT3qMockScenarios().then(data=>{setScenarios(data.scenarios);const first=data.scenarios.find(row=>row.admin_code===(adminCode??'45190'))??data.scenarios[0];if(first){setSelected(first.scenario_id);setQuery(first.query);}}).catch(e=>setError(e instanceof Error?e.message:'Mock 시나리오 로드 실패'));},[adminCode]);
  function choose(id:string){setSelected(id);const row=scenarios.find(item=>item.scenario_id===id);if(row)setQuery(row.query);}
  async function run(){setBusy(true);setError(null);try{const scenario=scenarios.find(item=>item.scenario_id===selected);setResult(await searchT3qMock({query,admin_code:scenario?.admin_code??adminCode??null,taxonomy_codes:scenario?.taxonomy_codes??[],schema_types:scenario?.schema_types??[],top_k:15}));}catch(e){setError(e instanceof Error?e.message:'Mock 검색 실패');}finally{setBusy(false);}}
  return <section className="mock-search-panel" aria-labelledby="mock-search-title">
    <div className="mock-search-header"><div><h2 id="mock-search-title">T3Q 구조 Mock 검색</h2><p>Event Master→RefDisasterEventID→Passage 흐름을 실제 외부호출 없이 최대 15건까지 검증합니다.</p></div><span className="status-badge provisional">시연용 Mock</span></div>
    <div className="mock-search-controls"><label>대표 질문<select value={selected} onChange={e=>choose(e.target.value)}>{scenarios.map(row=><option key={row.scenario_id} value={row.scenario_id}>{row.cq_id} {row.title}</option>)}</select></label><label>질의<input value={query} onChange={e=>setQuery(e.target.value)} /></label><button type="button" onClick={run} disabled={busy}>{busy?'검색 중':'Mock 검색'}</button></div>
    {error?<p role="alert" className="inline-error">{error}</p>:null}
    {result?<div className="mock-search-results"><p className="readiness-notice">{result.warnings.join(' ')}</p><div className="mock-result-grid"><div><h3>Event Master {result.events.length}건</h3>{result.events.length?<ul>{result.events.map(event=><li key={event.event_id}><strong>{event.event_id}</strong><span>{event.region_code_5} · {event.disaster_type} · {event.taxonomy_codes.join(', ')}</span></li>)}</ul>:<p>해당 조건의 Mock Event 없음</p>}</div><div><h3>Passage {result.passages.length}건</h3>{result.passages.length?<ul>{result.passages.map(passage=><li key={passage.passage_id}><strong>{passage.title??passage.passage_id}</strong><span>{passage.schema_type} · {passage.passage_id}</span><small>Ref: {passage.ref_disaster_event_id??'없음'} / lineage: {passage.lineage.source_file??'미확보'}</small></li>)}</ul>:<p>해당 조건의 Mock Passage 없음</p>}</div></div></div>:null}
  </section>;
}
