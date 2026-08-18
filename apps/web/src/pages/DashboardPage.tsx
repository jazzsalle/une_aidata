import type { AgentResponse, CurrentSituation, PriorityAreaResult, ProcedureStep, SimilarEvent } from '../types/contracts';
import type { AgentContextItem } from '../types/uiContext';
import { SituationAgentPanel } from '../components/SituationAgentPanel';
import { InsightPanel } from '../components/InsightPanel';
import { SituationTimeline } from '../components/SituationTimeline';
import { MapPanel } from '../features/map/MapPanel';
import { IntegrationStatusPanel } from '../components/IntegrationStatusPanel';
import { T3qReadinessPanel } from '../components/T3qReadinessPanel';
import { T3qMockSearchPanel } from '../components/T3qMockSearchPanel';
import { PanelResizer, useResizableLeftPanel } from '../components/PanelResizer';

interface Props {
  /** 지도가 보고 있는 시군구코드. 상황과 별개로 움직인다. */
  mapRegion: string;
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
        <SituationAgentPanel situation={props.situation} onSituationCreated={props.onSituationCreated} onAgentResponse={props.onAgentResponse} contextItems={props.agentContext} onRemoveContext={props.onRemoveContext} />
        <PanelResizer control={leftPanel} />
        <MapPanel adminCode={props.situation?.admin_code ?? '45190'} mapRegion={props.mapRegion} highlightedFeatureId={props.highlightedFeature} priorityAreas={props.priorities?.areas} onSelectFeature={props.onAddContext} />
        <InsightPanel priorities={props.priorities} procedures={props.procedures} similarEvents={props.events} selectedEventId={props.selectedEventId} onHighlight={props.onHighlight} onSelectEvent={props.onSelectEvent} adminCode={props.situation?.admin_code ?? null} onAddContext={props.onAddContext} />
      </div>
      <IntegrationStatusPanel />
      <T3qReadinessPanel adminCode={props.situation?.admin_code} />
      <T3qMockSearchPanel adminCode={props.situation?.admin_code} />
      <SituationTimeline situation={props.situation} />
    </>
  );
}
