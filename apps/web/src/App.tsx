import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { PageHeading } from './components/PageHeading';
import { DashboardPage } from './pages/DashboardPage';
import { EvidencePage } from './pages/EvidencePage';
import { ReportPage } from './pages/ReportPage';
import { useRoute } from './hooks/useRoute';
import { loadLayers, loadObservations, loadPriorityAreas, loadProcedures, loadReport, loadReportEvidenceSelection, loadSatelliteAssets, loadSimilarEvents, loadFloodMaskMetrics, selectFloodPhaseAssets, loadSatelliteEvidenceSets, loadSituations, saveReportEvidenceSelection, saveSituationView } from './services/apiClient';
import type { AgentResponse, CurrentSituation, LayerCatalogItem, PriorityAreaResult, ProcedureStep, ReportDraft, ReportEvidenceSelection, SatelliteAsset, SimilarEvent, FloodMaskMetrics, PhaseSelectionResult, SatelliteEvidenceSet } from './types/contracts';
import './styles.css';

function mergeObservations(situation: CurrentSituation, observations: CurrentSituation['observations']): CurrentSituation {
  if (!observations.length) return situation;
  const actualTypes=new Set(observations.filter(item=>item.value_status==='actual').map(item=>item.type));
  return {...situation,observations:[...observations,...situation.observations.filter(item=>!actualTypes.has(item.type))],data_quality:{...situation.data_quality,public_api_merged:true,merged_at:new Date().toISOString()}};
}

export default function App() {
  const { route, navigate } = useRoute();
  const [situations, setSituations] = useState<CurrentSituation[]>([]); const [selectedId, setSelectedId] = useState('');
  const [activeSituation,setActiveSituation]=useState<CurrentSituation|null>(null); const [priorities,setPriorities]=useState<PriorityAreaResult|null>(null);
  const [procedures,setProcedures]=useState<ProcedureStep[]>([]); const [satellites,setSatellites]=useState<SatelliteAsset[]>([]);
  const [floodMaskMetrics,setFloodMaskMetrics]=useState<FloodMaskMetrics|null>(null);
  const [phaseSelections,setPhaseSelections]=useState<PhaseSelectionResult[]>([]); const [evidenceSets,setEvidenceSets]=useState<SatelliteEvidenceSet[]>([]); const [selectedEvidenceSetId,setSelectedEvidenceSetId]=useState<string|null>(null); const [similarEvents,setSimilarEvents]=useState<SimilarEvent[]>([]);
  const [selectedEventId,setSelectedEventId]=useState<string|null>(null); const [layers,setLayers]=useState<LayerCatalogItem[]>([]); const [report,setReport]=useState<ReportDraft|null>(null);
  const [reportEvidence,setReportEvidence]=useState<ReportEvidenceSelection>({similar_event_ids:[],include_flood_trace:false,updated_at:new Date().toISOString()});
  const [highlightedFeature,setHighlightedFeature]=useState<string|null>(null); const [error,setError]=useState<string|null>(null); const [notice,setNotice]=useState<string|null>(null);
  const selected=useMemo(()=>situations.find(item=>item.situation_id===selectedId)??situations[0]??null,[situations,selectedId]);

  useEffect(()=>{Promise.all([loadSituations(),loadLayers()]).then(([loadedSituations,loadedLayers])=>{setSituations(loadedSituations);setLayers(loadedLayers);if(loadedSituations[0])setSelectedId(loadedSituations[0].situation_id);}).catch((e:unknown)=>setError(e instanceof Error?e.message:'초기 데이터 로드 실패'));},[]);
  useEffect(()=>{if(!selected)return;setHighlightedFeature(null);setReportEvidence(loadReportEvidenceSelection(selected.situation_id));loadObservations(selected).then(result=>{const merged=mergeObservations(selected,result.observations);setActiveSituation(merged);if(result.meta.data_status==='actual')setNotice('기상청 초단기실황을 현재 조건에 반영했습니다.');}).catch(()=>setActiveSituation(selected));},[selected?.situation_id]);
  useEffect(()=>{if(!activeSituation)return;Promise.all([loadPriorityAreas(activeSituation),loadProcedures(activeSituation.admin_code),loadSatelliteAssets(activeSituation.admin_code),loadSimilarEvents(activeSituation)]).then(([p,proc,sat,events])=>{setPriorities(p);setProcedures(proc);setSatellites(sat);setSimilarEvents(events);setSelectedEventId(events[0]?.event_id??null);}).catch((e:unknown)=>setError(e instanceof Error?e.message:'상황 데이터 로드 실패'));},[activeSituation?.situation_id,activeSituation?.observations.map(o=>`${o.type}:${String(o.value)}`).join('|')]);
  useEffect(()=>{loadSatelliteEvidenceSets().then(sets=>{setEvidenceSets(sets);setSelectedEvidenceSetId(prev=>prev??sets[0]?.evidence_set_id??null);}).catch(()=>setEvidenceSets([]));},[]);
  useEffect(()=>{const set=evidenceSets.find(item=>item.evidence_set_id===selectedEvidenceSetId)??evidenceSets[0];if(!set)return;loadFloodMaskMetrics(set.event_id).then(setFloodMaskMetrics).catch(()=>setFloodMaskMetrics(null));selectFloodPhaseAssets({event_id:set.event_id,event_start_at:set.event_start_at,event_end_at:set.event_end_at}).then(result=>setPhaseSelections(result.results)).catch(()=>setPhaseSelections([]));},[selectedEvidenceSetId,evidenceSets.length]);
  useEffect(()=>{if(!activeSituation)return;loadReport(activeSituation,reportEvidence).then(setReport).catch((e:unknown)=>setError(e instanceof Error?e.message:'보고서 초안 생성 실패'));},[activeSituation?.situation_id,JSON.stringify(reportEvidence)]);

  function onSituationCreated(next:CurrentSituation){setSituations(prev=>[next,...prev.filter(i=>i.situation_id!==next.situation_id)]);setSelectedId(next.situation_id);setNotice('현재 조건을 적용하고 우선 확인지역·유사사례를 다시 산정했습니다.');}
  function onAgentResponse(response:AgentResponse){if(response.similar_events[0]){setSimilarEvents(response.similar_events);setSelectedEventId(response.similar_events[0].event_id);}setHighlightedFeature(response.map_actions[0]?.target_id??null);}
  function updateEvidence(next:ReportEvidenceSelection,message:string){if(!activeSituation)return;setReportEvidence(next);saveReportEvidenceSelection(activeSituation.situation_id,next);setNotice(message);}

  return <div className="app-shell multi-page-shell">
    <AppHeader route={route} situations={situations} selected={activeSituation??selected} onNavigate={navigate} onSelect={setSelectedId} onSave={()=>{const id=saveSituationView(activeSituation??selected,highlightedFeature);setNotice(id?'상황뷰를 브라우저에 저장했습니다.':'저장할 상황이 없습니다.');}} />
    {error?<div className="global-error" role="alert">{error}</div>:null}
    <main id="main-content" className={`page-main page-${route.id}`}><PageHeading title={route.title} description={route.description} status={notice}/>
      {route.id==='dashboard'?<DashboardPage situation={activeSituation??selected} priorities={priorities} procedures={procedures} events={similarEvents} selectedEventId={selectedEventId} highlightedFeature={highlightedFeature} onSituationCreated={onSituationCreated} onAgentResponse={onAgentResponse} onHighlight={setHighlightedFeature} onSelectEvent={setSelectedEventId}/>:null}
      {route.id==='evidence'?<EvidencePage situation={activeSituation??selected} satellites={satellites} metrics={floodMaskMetrics} selectionResults={phaseSelections} evidenceSets={evidenceSets} selectedEvidenceSetId={selectedEvidenceSetId} onSelectEvidenceSet={setSelectedEvidenceSetId} events={similarEvents} selection={reportEvidence} onSelectSatelliteEventSet={(assetIds,eventId,evidenceSet)=>updateEvidence({...reportEvidence,satellite_event_set:{asset_ids:assetIds,event_id:eventId,evidence_set_id:evidenceSet.evidence_set_id,provenance_version:evidenceSet.version,target_region_match:evidenceSet.area.is_target_region,added_at:new Date().toISOString()},satellite_pair:null,updated_at:new Date().toISOString()},'PRE·EVENT·POST 증거세트와 출처·무결성 정보를 보고서 근거에 반영했습니다.')} onToggleFloodTrace={()=>updateEvidence({...reportEvidence,include_flood_trace:!reportEvidence.include_flood_trace,updated_at:new Date().toISOString()},reportEvidence.include_flood_trace?'침수흔적도 근거를 보고서에서 제외했습니다.':'침수흔적도 근거를 보고서에 반영했습니다.')} onToggleEvent={(eventId)=>{const ids=reportEvidence.similar_event_ids.includes(eventId)?reportEvidence.similar_event_ids.filter(id=>id!==eventId):[...reportEvidence.similar_event_ids,eventId];updateEvidence({...reportEvidence,similar_event_ids:ids,updated_at:new Date().toISOString()},'과거 피해·대응·복구 사례 선택을 보고서에 반영했습니다.');}}/>:null}
      {route.id==='report'?<ReportPage situation={activeSituation??selected} priorities={priorities} events={similarEvents} report={report} selection={reportEvidence}/>:null}
    </main><footer className="site-footer"><span>실제·시나리오·Seed 상태를 구분하여 표시합니다.</span><span>활성 레이어 {layers.filter(item=>item.default_visible).length}/{layers.length}</span></footer>
  </div>;
}
