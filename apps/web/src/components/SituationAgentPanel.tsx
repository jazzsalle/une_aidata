import { useEffect,useMemo,useRef,useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type {AgentResponse,CreateSituationInput,CurrentSituation,Observation,SituationMode} from '../types/contracts';
import type {AgentContextItem} from '../types/uiContext';
import {createSituation,sendAgentMessage} from '../services/apiClient';
import {moveTabFocus} from '../hooks/useRovingTabs';
interface Props{situation:CurrentSituation|null;onSituationCreated(s:CurrentSituation):void;onAgentResponse(r:AgentResponse):void;
 /** 지도·우측 패널에서 선택해 질의와 함께 전달할 대상. 미연결이어도 동작이 깨지지 않도록 optional 이다. */
 contextItems?:AgentContextItem[];onRemoveContext?(item:AgentContextItem):void;}
interface AgentTurn{turn_id:string;role:'user'|'assistant';text:string;created_at:string;response?:AgentResponse;context?:AgentContextItem[];}
const SUGGESTIONS=['우선 확인지역의 선정 근거는?','현재와 유사한 과거 피해·복구 사례는?','매뉴얼상 먼저 확인할 절차는?','침수흔적도와 위성영상 변화를 비교해줘'];
function valueOf(s:CurrentSituation|null,type:string){const v=s?.observations.find(i=>i.type===type)?.value;return typeof v==='number'?String(v):'';}
function paragraphs(text:string){return text.split(/\n+/).map(line=>line.trim()).filter(Boolean);}
function turnTime(iso:string){return new Date(iso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});}
function contextKey(item:AgentContextItem){return `${item.kind}:${item.id}`;}
function contextText(item:AgentContextItem){return item.detail?`${item.label} · ${item.detail}`:item.label;}
export function SituationAgentPanel({situation,onSituationCreated,onAgentResponse,contextItems,onRemoveContext}:Props){
 const [activeTab,setActiveTab]=useState<'input'|'agent'>('input');const [message,setMessage]=useState('현재 조건에서 우선 확인해야 할 지역과 근거를 알려줘');const [sending,setSending]=useState(false);const [applying,setApplying]=useState(false);const [applyError,setApplyError]=useState('');const [sendError,setSendError]=useState('');const [mode,setMode]=useState<SituationMode>('hybrid');const [rain3h,setRain3h]=useState('');const [rain12h,setRain12h]=useState('');const [water,setWater]=useState('');const [flow,setFlow]=useState('');const [symptom,setSymptom]=useState('');const [turns,setTurns]=useState<AgentTurn[]>([]);const [suggestionsOpen,setSuggestionsOpen]=useState(true);
 const threadRef=useRef<HTMLDivElement|null>(null);
 const observations=useMemo(()=>situation?.observations??[],[situation]);
 const context=useMemo(()=>contextItems??[],[contextItems]);
 useEffect(()=>{setMode(situation?.mode==='scenario'?'scenario':'hybrid');setRain3h(valueOf(situation,'RAINFALL_3H'));setRain12h(valueOf(situation,'RAINFALL_12H'));setWater(valueOf(situation,'WATER_LEVEL'));setFlow(valueOf(situation,'DISCHARGE'));setSymptom(String(situation?.user_input?.location_text??''));setTurns([]);setSendError('');setSuggestionsOpen(true);},[situation?.situation_id]);
 useEffect(()=>{const el=threadRef.current;if(el)el.scrollTop=el.scrollHeight;},[turns.length,sending,activeTab]);
 function observation(type:string,value:string,unit:string,trend?:string):Observation|undefined{const n=Number(value);if(!Number.isFinite(n))return undefined;return{type,value:n,unit,trend,observed_at:new Date().toISOString(),source_provider:'UserInputProvider',value_status:'scenario',official_data:false};}
 async function apply(){if(!situation||applying)return;setApplying(true);setApplyError('');try{const obs=[observation('RAINFALL_3H',rain3h,'mm'),observation('RAINFALL_12H',rain12h,'mm'),observation('WATER_LEVEL',water,'m','rising'),observation('DISCHARGE',flow,'m3/s','rising')].filter(Boolean) as Observation[];const input:CreateSituationInput={admin_code:situation.admin_code,reference_time:new Date().toISOString(),mode,hazards:situation.hazards,observations:obs.length?obs:situation.observations,user_input:{field_symptoms:symptom?[symptom]:[],location_text:symptom}};onSituationCreated(await createSituation(input));}catch(e){setApplyError(`조건 적용·재산정에 실패했습니다. 기존 조건이 유지됩니다. (${e instanceof Error?e.message:'알 수 없는 오류'})`);}finally{setApplying(false);}}
 async function submit(){const text=message.trim();if(!situation||!text||sending)return;const askedId=`ask-${Date.now()}`;const sentContext=context.slice();setSending(true);setSendError('');setTurns(prev=>[...prev,{turn_id:askedId,role:'user',text,created_at:new Date().toISOString(),context:sentContext}]);setMessage('');setSuggestionsOpen(false);
  try{const response=await sendAgentMessage(situation,text,sentContext);setTurns(prev=>[...prev,{turn_id:response.message_id||`answer-${Date.now()}`,role:'assistant',text:response.answer,created_at:new Date().toISOString(),response}]);onAgentResponse(response);}
  catch(e){setTurns(prev=>prev.filter(turn=>turn.turn_id!==askedId));setMessage(text);setSendError(`질의 실행에 실패했습니다. 잠시 후 다시 시도해 주세요. (${e instanceof Error?e.message:'알 수 없는 오류'})`);}
  finally{setSending(false);}}
 function onComposerKeyDown(e:ReactKeyboardEvent<HTMLTextAreaElement>){if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void submit();}}
 function renderTurn(turn:AgentTurn){
  const response=turn.response;
  return <article key={turn.turn_id} className={`agent-turn ${turn.role}`}>
   <p className="agent-turn-head"><span className="agent-turn-role">{turn.role==='user'?'담당자 질문':'AI Agent 답변'}</span><span className="agent-turn-time">{turnTime(turn.created_at)}</span></p>
   <div className="agent-turn-body">{paragraphs(turn.text).map((line,index)=><p key={`${turn.turn_id}-p-${index}`}>{line}</p>)}</div>
   {turn.context&&turn.context.length?<p className="agent-turn-context"><span className="agent-turn-context-label">함께 전달한 선택 대상</span>{turn.context.map(item=><span key={`${turn.turn_id}-c-${contextKey(item)}`} className="agent-turn-context-item">{contextText(item)}</span>)}</p>:null}
   {response?<p className="agent-turn-summary">근거 {response.evidence.length}건 · 유사사례 {response.similar_events.length}건 · 지도 이동 {response.map_actions.length?'있음':'없음'}</p>:null}
   {response&&response.warnings.length?<div className="agent-turn-notes warnings"><h4>확인 필요 안내</h4><ul>{response.warnings.map((item,index)=><li key={`${turn.turn_id}-w-${index}`}>{item}</li>)}</ul></div>:null}
   {response&&response.limitations.length?<div className="agent-turn-notes limitations"><h4>자료 한계</h4><ul>{response.limitations.map((item,index)=><li key={`${turn.turn_id}-l-${index}`}>{item}</li>)}</ul></div>:null}
   {response?<p className="agent-turn-confirm">담당자 확인 필요 · 공식 위험도·피해예측·자동 조치결정이 아닌 참고정보입니다.</p>:null}
  </article>;
 }
 return <aside className="left-panel"><div className="panel-tabs" role="tablist" aria-label="상황 입력 및 AI Agent" onKeyDown={e=>moveTabFocus<'input'|'agent'>(e,['input','agent'] as const,activeTab,setActiveTab,'situation-tab') }><button id="situation-tab-0" role="tab" aria-selected={activeTab==='input'} aria-controls="situation-panel-input" tabIndex={activeTab==='input'?0:-1} type="button" className={activeTab==='input'?'active':''} onClick={()=>setActiveTab('input')}>재난상황 입력</button><button id="situation-tab-1" role="tab" aria-selected={activeTab==='agent'} aria-controls="situation-panel-agent" tabIndex={activeTab==='agent'?0:-1} type="button" className={activeTab==='agent'?'active':''} onClick={()=>setActiveTab('agent')}>AI Agent{context.length?<span className="agent-tab-badge" aria-hidden="true">{context.length}</span>:null}</button></div><p className="sr-only" aria-live="polite">{context.length?`AI Agent 질의와 함께 전달될 선택 대상 ${context.length}건이 있습니다.`:''}</p>{activeTab==='input'?<div id="situation-panel-input" role="tabpanel" aria-labelledby="situation-tab-0" className="panel-scroll"><div className={`status-banner ${situation?.mode==='scenario'?'scenario':'hybrid'}`}>{situation?.mode==='scenario'?'시나리오 데이터 · 공식 관측 아님':'공공 API 조회 + 사용자 입력 · 실패 시 시나리오 대체'}</div><label className="field"><span>지역</span><input value={situation?.admin_name??''} readOnly/></label><label className="field"><span>입력 모드</span><select value={mode} onChange={e=>setMode(e.target.value as SituationMode)}><option value="hybrid">공공 API + 사용자 입력</option><option value="scenario">시나리오</option></select></label><div className="field-grid"><label className="field"><span>3시간 강우(mm)</span><input inputMode="decimal" value={rain3h} onChange={e=>setRain3h(e.target.value)}/></label><label className="field"><span>12시간 강우(mm)</span><input inputMode="decimal" value={rain12h} onChange={e=>setRain12h(e.target.value)}/></label><label className="field"><span>수위(m)</span><input inputMode="decimal" value={water} onChange={e=>setWater(e.target.value)}/></label><label className="field"><span>유량(m³/s)</span><input inputMode="decimal" value={flow} onChange={e=>setFlow(e.target.value)}/></label></div><label className="field"><span>현장징후·확인지역</span><textarea value={symptom} onChange={e=>setSymptom(e.target.value)}/></label><h3>적용 중인 조건</h3><div className="observation-list">{observations.slice(0,5).map((i,index)=><article key={`${i.type}-${index}`}><span>{i.name??i.type}</span><strong>{String(i.value)}{i.unit?` ${i.unit}`:''}</strong><small>{i.official_data?'공식':'입력/시나리오'} · {new Date(i.observed_at).toLocaleTimeString('ko-KR')}</small></article>)}</div>{applyError?<p role="alert" className="inline-error">{applyError}</p>:null}<button type="button" className="primary full" disabled={!situation||applying} onClick={apply}>{applying?'적용 중…':'현재 조건 적용·재산정'}</button></div>:<div id="situation-panel-agent" role="tabpanel" aria-labelledby="situation-tab-1" className="panel-scroll agent-chat">
  <div ref={threadRef} className="agent-thread" role="log" aria-live="polite" aria-relevant="additions text" aria-label="AI Agent 대화" tabIndex={0}>
   <p className="agent-thread-intro">현재 입력조건과 계획·과거사례·매뉴얼 데이터를 연결해 우선 확인지역과 근거를 제공합니다. 답변은 참고정보이며 담당자 확인이 필요합니다.</p>
   {turns.map(renderTurn)}
   {sending?<p className="agent-turn-pending">AI Agent가 답변을 정리하는 중입니다…</p>:null}
  </div>
  <div className="agent-composer">
   {context.length?<div className="agent-context-bar">
    <p id="agent-context-hint" className="agent-context-hint">선택한 대상 {context.length}건이 질의와 함께 전달됩니다. 질문에 대상을 적지 않아도 됩니다.</p>
    <ul className="agent-context-chips">{context.map(item=><li key={contextKey(item)} className={`agent-context-chip kind-${item.kind}`}>
     <span className="agent-context-chip-text">{contextText(item)}</span>
     {onRemoveContext?<button type="button" className="agent-context-remove" aria-label={`${item.label} 참조 제거`} onClick={()=>onRemoveContext(item)}><span aria-hidden="true">×</span></button>:null}
    </li>)}</ul>
   </div>:null}
   <textarea id="agent-composer-input" className="agent-input" aria-label="AI Agent 질의" aria-describedby={context.length?'agent-composer-hint agent-context-hint':'agent-composer-hint'} rows={6} placeholder="현재 상황에서 확인할 내용을 질문하세요" value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={onComposerKeyDown}/>
   <p id="agent-composer-hint" className="agent-composer-hint">Ctrl(⌘)+Enter로 전송합니다.</p>
   {sendError?<p role="alert" className="inline-error">{sendError}</p>:null}
   <button type="button" className="primary full agent-send" disabled={sending||!situation} onClick={()=>{void submit();}}>{sending?'조회 중…':'질의 실행'}</button>
  </div>
  <details className="agent-suggestions" open={suggestionsOpen} onToggle={e=>setSuggestionsOpen(e.currentTarget.open)}>
   <summary>추천질문</summary>
   <div className="agent-suggestion-list">{SUGGESTIONS.map(i=><button key={i} type="button" className="suggestion" onClick={()=>setMessage(i)}>{i}</button>)}</div>
  </details>
 </div>}</aside>;
}
