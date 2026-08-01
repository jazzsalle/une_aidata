import type { CurrentSituation, FloodMaskMetrics, PhaseSelectionResult, ReportEvidenceSelection, SatelliteAsset, SimilarEvent, SatelliteEvidenceSet } from '../types/contracts';
import { SatelliteComparison } from '../components/SatelliteComparison';
import { DamageRecoveryEvidence } from '../components/DamageRecoveryEvidence';
import { MapPanel } from '../features/map/MapPanel';
import { EvidenceSetSelector } from '../components/EvidenceSetSelector';
interface Props { situation: CurrentSituation | null; satellites: SatelliteAsset[]; metrics: FloodMaskMetrics | null; selectionResults: PhaseSelectionResult[]; evidenceSets:SatelliteEvidenceSet[]; selectedEvidenceSetId:string|null; onSelectEvidenceSet(id:string):void; events: SimilarEvent[]; selection: ReportEvidenceSelection; onSelectSatelliteEventSet(assetIds:string[],eventId:string,evidenceSet:SatelliteEvidenceSet):void; onToggleFloodTrace():void; onToggleEvent(eventId:string):void; }
export function EvidencePage({ situation, satellites, metrics, selectionResults, evidenceSets, selectedEvidenceSetId, onSelectEvidenceSet, events, selection, onSelectSatelliteEventSet, onToggleFloodTrace, onToggleEvent }: Props) {
  const evidenceSet=evidenceSets.find(item=>item.evidence_set_id===selectedEvidenceSetId)??evidenceSets[0]??null;
  return <div className="evidence-page">
    <nav className="page-subnav" aria-label="피해·변화 근거 페이지 내 이동"><a href="#satellite-title">홍수 PRE·EVENT·POST 타일</a><a href="#flood-trace-summary">침수흔적도</a><a href="#damage-title">피해·대응·복구</a></nav>
    <EvidenceSetSelector sets={evidenceSets} selectedId={evidenceSet?.evidence_set_id??null} onSelect={onSelectEvidenceSet}/><SatelliteComparison satellites={satellites} metrics={metrics} selectionResults={selectionResults} evidenceSet={evidenceSet} selectedSet={selection.satellite_event_set} onAddToReport={onSelectSatelliteEventSet}/>
    <section className="evidence-section evidence-map-section" aria-labelledby="flood-trace-summary"><div className="section-heading-row"><div><h2 id="flood-trace-summary">침수흔적도·지도 근거</h2><p>VWorld 2D 지도에서는 침수흔적도·위험지구·하천을 확인하고, 위성영상·수계마스크는 별도 256×256 타일 카드로 확인합니다.</p></div><span className="seed-badge">현재 GeoJSON Seed</span></div>
      <div className="evidence-map-grid"><MapPanel adminCode={situation?.admin_code??'45190'} initialVisible={{'L-FLOOD-TRACE':true}} compact/><dl className="summary-definition-list"><div><dt>대상지역</dt><dd>{situation?.admin_name??'-'}</dd></div><div><dt>표출방식</dt><dd>GeoJSON 면 레이어·투명도 중첩</dd></div><div><dt>사건연계</dt><dd>DisasterEvent ID 기준</dd></div><div><dt>주의사항</dt><dd>POC Seed는 공식 침수범위가 아니며 향후 정식 자료로 교체</dd></div></dl></div>
      <div className="evidence-action-row"><button type="button" className="primary" aria-pressed={selection.include_flood_trace} onClick={onToggleFloodTrace}>{selection.include_flood_trace?'침수흔적도 근거 제외':'침수흔적도 근거를 보고서에 반영'}</button>{selection.include_flood_trace?<span className="selection-status" role="status">보고서 근거로 선택됨</span>:null}</div>
    </section>
    <DamageRecoveryEvidence events={events} selectedEventIds={selection.similar_event_ids} onToggleEvent={onToggleEvent}/>
  </div>;
}
