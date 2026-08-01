import { useEffect, useMemo, useState } from 'react';
import type { T3qCqCoverage, T3qIntegrationReadiness, T3qReadinessState } from '../types/contracts';
import { loadT3qCqCoverage, loadT3qReadiness } from '../services/apiClient';

const STATE_LABEL:Record<T3qReadinessState,string>={designed:'교체경계 설계',mock_ready:'Mock 준비',seed_ready:'Seed 준비',configured:'설정됨',verified:'검증됨',pending:'협의대기',error:'오류'};
function badgeClass(state:string){return state==='verified'?'actual':state==='configured'||state==='seed_ready'?'derived':state==='error'?'error':'provisional';}

export function T3qReadinessPanel({adminCode}:{adminCode?:string}){
  const [readiness,setReadiness]=useState<T3qIntegrationReadiness|null>(null);
  const [coverage,setCoverage]=useState<T3qCqCoverage|null>(null);
  const [open,setOpen]=useState(false);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{setError(null);Promise.all([loadT3qReadiness(),loadT3qCqCoverage(adminCode)]).then(([r,c])=>{setReadiness(r.readiness);setCoverage(c);}).catch((e:unknown)=>setError(e instanceof Error?e.message:'T3Q 정합상태 조회 실패'));},[adminCode]);
  const summary=useMemo(()=>{const rows=readiness?.dimensions??[];return{ready:rows.filter(row=>['verified','configured','mock_ready','seed_ready'].includes(row.state)).length,total:rows.length,pending:rows.filter(row=>row.state==='pending').length};},[readiness]);
  return <section className="t3q-readiness" aria-labelledby="t3q-readiness-title">
    <button type="button" className="t3q-readiness-toggle" aria-expanded={open} aria-controls="t3q-readiness-body" onClick={()=>setOpen(value=>!value)}>
      <span><strong id="t3q-readiness-title">T3Q 구조 기반 Mock·CQ 커버리지</strong><small>외부 기술연계 없이 UNE Mock/Seed로 독립 동작</small></span>
      <span className="readiness-summary"><b>{summary.ready}/{summary.total||6}</b><small>준비·설정</small></span>
    </button>
    {open?<div id="t3q-readiness-body" className="t3q-readiness-body">
      {error?<p role="alert" className="inline-error">{error}</p>:null}
      {readiness?<>
        <p className="readiness-notice">{readiness.notice}</p>
        <div className="readiness-dimensions">{readiness.dimensions.map(row=><article key={row.dimension_id} className="readiness-card">
          <header><strong>{row.name}</strong><span className={`status-badge ${badgeClass(row.state)}`}>{STATE_LABEL[row.state]}</span></header>
          <p><b>반영:</b> {row.implemented.join(' · ')}</p>
          <p><b>잔여:</b> {row.pending.join(' · ')||'없음'}</p>
          <small><b>완료 게이트:</b> {row.completion_gate}</small>
        </article>)}</div>
      </>:null}
      {coverage?<div className="cq-coverage"><h3>재난담당자 핵심 질문 5문</h3><ol>{coverage.items.map(item=><li key={item.cq_id}>
        <div className="cq-title"><strong>{item.cq_id} {item.question}</strong><span className={`status-badge ${item.runtime_state==='verified'?'actual':item.runtime_state==='partial'?'derived':'provisional'}`}>{item.runtime_state==='verified'?'검증됨':item.runtime_state==='partial'?'부분구현':item.runtime_state==='mock'?'Mock 구현':item.runtime_state}</span></div>
        <p><b>화면:</b> {item.screen_outputs.join(' · ')}</p>
        <p><b>현재 Provider:</b> {item.current_providers.join(' · ')}</p>
        <p><b>현재 제약:</b> {item.blocking_items.join(' · ')||'외부 협력 없이 Mock으로 동작'}</p>
      </li>)}</ol></div>:null}
      {readiness?.development_constraints?.length?<div className="consultation-items"><h3>현 단계 개발 제약</h3><ul>{readiness.development_constraints.map(item=><li key={item}>{item}</li>)}</ul></div>:null}{readiness?.future_replacement_items?.length?<div className="consultation-items"><h3>향후 Provider 교체 시 확인항목</h3><ul>{readiness.future_replacement_items.map(item=><li key={item}>{item}</li>)}</ul></div>:null}
    </div>:null}
  </section>;
}
