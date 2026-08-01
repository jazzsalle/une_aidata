import { useEffect, useState } from 'react';
import type { IntegrationStatus } from '../types/contracts';
import { loadIntegrationStatus } from '../services/apiClient';
export function IntegrationStatusPanel(){
  const [rows,setRows]=useState<IntegrationStatus[]>([]); const [open,setOpen]=useState(false);
  useEffect(()=>{loadIntegrationStatus().then(setRows).catch(()=>setRows([]));},[]);
  return <section className="integration-status" aria-labelledby="integration-status-title">
    <button type="button" className="integration-status-toggle" aria-expanded={open} aria-controls="integration-status-body" onClick={()=>setOpen(v=>!v)}><span id="integration-status-title">연계 상태</span><strong>{rows.filter(r=>r.configured).length}/{rows.length || 4}</strong></button>
    {open?<div id="integration-status-body"><ul>{rows.map(row=><li key={row.integration_id}><span className={`status-badge ${row.validation_state==='verified'?'actual':row.configured?'derived':'provisional'}`}>{row.validation_state==='verified'?'검증됨':row.configured?'설정됨':row.validation_state==='pending'?'확인대기':'대체모드'}</span><div><strong>{row.name}</strong><p>{row.message}</p>{row.next_action?<small><b>다음 조치:</b> {row.next_action}</small>:null}</div></li>)}</ul></div>:null}
  </section>;
}
