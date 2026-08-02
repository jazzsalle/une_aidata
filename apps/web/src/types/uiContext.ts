// 지도·우측 패널에서 선택한 대상을 AI Agent 질의에 함께 실어 보내기 위한 화면 전용 컨텍스트.
// 사용자가 질문에 대상을 주어로 적지 않아도 선택 항목이 질의와 조합되도록 한다.
// 계약(contracts.ts)이 아닌 UI 상태이며, 서버에는 요청 본문의 부가 필드로만 전달된다.

export type AgentContextKind = 'district' | 'similar_event' | 'river';

export interface AgentContextItem {
  kind: AgentContextKind;
  id: string;
  label: string;
  detail?: string;
  admin_code?: string;
}

export function sameContext(a: AgentContextItem, b: AgentContextItem) {
  return a.kind === b.kind && a.id === b.id;
}
