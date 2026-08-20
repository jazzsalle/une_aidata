import type { AgentResponse, CurrentSituation, PriorityAreaResult, ProcedureStep, SimilarEvent } from '../types/contracts';
import type { AgentContextItem } from '../types/uiContext';
import { SituationAgentPanel } from '../components/SituationAgentPanel';
import { InsightPanel } from '../components/InsightPanel';
import { SituationTimeline } from '../components/SituationTimeline';
import { MapPanel } from '../features/map/MapPanel';
import { IntegrationStatusPanel } from '../components/IntegrationStatusPanel';
import { PlanKnowledgePanel } from '../components/PlanKnowledgePanel';
import { EventTimelinePanel } from '../components/EventTimelinePanel';
import { SatellitePreviewPanel } from '../components/SatellitePreviewPanel';
import { T3qReadinessPanel } from '../components/T3qReadinessPanel';
import { PanelResizer, useResizableLeftPanel } from '../components/PanelResizer';

interface Props {
  /** 지도가 보고 있는 시군구코드. 상황과 별개로 움직인다. */
  mapRegion: string;
  onRegionChange(code: string): void;
  focusTarget: { key: string; lonLat: [number, number]; zoom?: number } | null;
  onFocusMap(lonLat: [number, number], zoom?: number): void;
  situation: CurrentSituation | null;
  priorities: PriorityAreaResult | null;
  procedures: ProcedureStep[];
  events: SimilarEvent[];
  selectedEventId: string | null;
  highlightedFeature: string | null;
  onSituationCreated(situation: CurrentSituation): void;
  onAgentResponse(response: AgentResponse): void;
  onHighlight(id: string): void;
  onSelectEvent(id: string): void;
  /** AI Agent 질의에 함께 전달할 선택 대상 목록. */
  agentContext: AgentContextItem[];
  onAddContext(item: AgentContextItem): void;
  onRemoveContext(item: AgentContextItem): void;
}

export function DashboardPage(props: Props) {
  const leftPanel = useResizableLeftPanel();
  return (
    <>
      <div className="dashboard-grid" ref={leftPanel.gridRef} style={leftPanel.style}>
        <SituationAgentPanel situation={props.situation} onSituationCreated={props.onSituationCreated} onAgentResponse={props.onAgentResponse} contextItems={props.agentContext} onRemoveContext={props.onRemoveContext}
          onOpenLink={(link)=>{
            // 메타 CQ 답변의 바로가기 — kind 별로 기존 지도 연동 경로를 그대로 태운다.
            if(link.kind==='region'&&link.admin_code)props.onRegionChange(link.admin_code);
            else if(link.kind==='river'&&link.nav)props.onFocusMap(link.nav,13);
            else if(link.kind==='district'&&link.target_id)props.onHighlight(link.target_id);
          }} />
        <PanelResizer control={leftPanel} />
        <MapPanel adminCode={props.situation?.admin_code ?? '45190'} mapRegion={props.mapRegion} onRegionChange={props.onRegionChange} focusTarget={props.focusTarget} highlightedFeatureId={props.highlightedFeature} priorityAreas={props.priorities?.areas} onSelectFeature={props.onAddContext} />
        <InsightPanel mapRegion={props.mapRegion} onFocusMap={props.onFocusMap} priorities={props.priorities} procedures={props.procedures} similarEvents={props.events} selectedEventId={props.selectedEventId} onHighlight={props.onHighlight} onSelectEvent={props.onSelectEvent} adminCode={props.situation?.admin_code ?? null} onAddContext={props.onAddContext} />
      </div>
      <IntegrationStatusPanel />
      <PlanKnowledgePanel />
      <EventTimelinePanel />
      <SatellitePreviewPanel />
      <T3qReadinessPanel adminCode={props.situation?.admin_code} />
      <SituationTimeline situation={props.situation} />
    </>
  );
}
