import type { CurrentSituation, PriorityAreaResult, ReportDraft, ReportEvidenceSelection, SimilarEvent } from '../types/contracts';
import { ReportEditor } from '../components/ReportEditor';
export function ReportPage({ situation, priorities, events, report, selection }: { situation: CurrentSituation | null; priorities: PriorityAreaResult | null; events: SimilarEvent[]; report: ReportDraft | null; selection: ReportEvidenceSelection }) { return <ReportEditor situation={situation} priorities={priorities} events={events} report={report} selection={selection}/>; }
