import type { SatelliteEvidenceSet } from '../types/contracts';

interface Props { sets:SatelliteEvidenceSet[]; selectedId:string|null; onSelect(id:string):void; }
function formatBytes(value:number){ return value<1024?`${value} B`:`${(value/1024).toFixed(1)} KB`; }
export function EvidenceSetSelector({sets,selectedId,onSelect}:Props){
  const selected=sets.find(item=>item.evidence_set_id===selectedId)??sets[0]??null;
  function download(){ if(!selected)return; const blob=new Blob([JSON.stringify(selected,null,2)],{type:'application/json;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${selected.evidence_set_id}_manifest.json`; a.click(); URL.revokeObjectURL(url); }
  return <section className="evidence-section evidence-set-registry" aria-labelledby="evidence-set-title">
    <div className="section-heading-row"><div><h2 id="evidence-set-title">위성 증거세트 선택·출처 추적</h2><p>PRE·EVENT·POST 영상과 수계마스크 6개 자산을 하나의 사건 증거세트로 관리합니다.</p></div><span className="seed-badge">{selected?.version??'미선택'}</span></div>
    <label className="evidence-set-select">증거세트<select value={selected?.evidence_set_id??''} onChange={e=>onSelect(e.target.value)}>{sets.map(item=><option key={item.evidence_set_id} value={item.evidence_set_id}>{item.title}</option>)}</select></label>
    {selected?<><div className="evidence-set-alert" role="note"><strong>{selected.area.is_target_region?'시범 대상지역 자료':'시범 대상지역 외 자료'}</strong><span>{selected.area.target_area_note}</span></div>
    <dl className="summary-definition-list evidence-set-summary"><div><dt>사건</dt><dd>{selected.event_id}</dd></div><div><dt>기간</dt><dd>{new Date(selected.event_start_at).toLocaleString('ko-KR')} ~ {new Date(selected.event_end_at).toLocaleString('ko-KR')}</dd></div><div><dt>자산</dt><dd>{selected.asset_ids.length}개 · {selected.tile_size_px.join('×')} px</dd></div><div><dt>Provider</dt><dd>{selected.provider} → {selected.replacement_provider}</dd></div><div><dt>지도 관계</dt><dd>{selected.base_map}와 별도 표출 · 오버레이 금지</dd></div><div><dt>무결성</dt><dd>{selected.integrity.algorithm} · {selected.integrity.assets.length}개 확인</dd></div></dl>
    <div className="evidence-action-row"><button type="button" onClick={download}>증거세트 Manifest 다운로드</button></div>
    <details><summary>자산 체크섬과 사용 제한 확인</summary><div className="accessible-data-table-wrap"><table><caption>증거세트 자산 무결성</caption><thead><tr><th scope="col">자산 ID</th><th scope="col">크기</th><th scope="col">파일용량</th><th scope="col">SHA-256 앞 12자리</th></tr></thead><tbody>{selected.integrity.assets.map(a=><tr key={a.asset_id}><th scope="row">{a.asset_id}</th><td>{a.width}×{a.height}</td><td>{formatBytes(a.bytes)}</td><td><code>{a.sha256.slice(0,12)}</code></td></tr>)}</tbody></table></div><ul>{selected.usage_limits.map(item=><li key={item}>{item}</li>)}</ul></details></>:null}
  </section>;
}
