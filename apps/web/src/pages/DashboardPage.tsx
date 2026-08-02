import type { AgentResponse, CurrentSituation, PriorityAreaResult, ProcedureStep, SimilarEvent } from '../types/contracts';
import { SituationAgentPanel } from '../components/SituationAgentPanel';
import { InsightPanel } from '../components/InsightPanel';
import { SituationTimeline } from '../components/SituationTimeline';
import { MapPanel } from '../features/map/MapPanel';
import { IntegrationStatusPanel } from '../components/IntegrationStatusPanel';
import { T3qReadinessPanel } from '../components/T3qReadinessPanel';
import { T3qMockSearchPanel } from '../components/T3qMockSearchPanel';

interface Props {
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
}

export function DashboardPage(props: Props) {
  return (
    <>
      <div className="dashboard-grid">
        <SituationAgentPanel situation={props.situation} onSituationCreated={props.onSituationCreated} onAgentResponse={props.onAgentResponse} />
        <MapPanel adminCode={props.situation?.admin_code ?? '45190'} highlightedFeatureId={props.highlightedFeature} />
        <InsightPanel priorities={props.priorities} procedures={props.procedures} similarEvents={props.events} selectedEventId={props.selectedEventId} onHighlight={props.onHighlight} onSelectEvent={props.onSelectEvent} />
      </div>
      <IntegrationStatusPanel />
      <T3qReadinessPanel adminCode={props.situation?.admin_code} />
      <T3qMockSearchPanel adminCode={props.situation?.admin_code} />
      <SituationTimeline situation={props.situation} />
    </>
  );
}
