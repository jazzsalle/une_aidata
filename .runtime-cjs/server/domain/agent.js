"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAgentResponse = buildAgentResponse;
const priorityAreas_js_1 = require("./priorityAreas.js");
const similarEvents_js_1 = require("./similarEvents.js");
const seeds_js_1 = require("../seeds.js");
async function buildAgentResponse(situation, message) {
    const priority = (0, priorityAreas_js_1.calculatePriorityAreas)(situation);
    const similar = await (0, similarEvents_js_1.searchSimilarEvents)(situation, 3);
    const procedures = seeds_js_1.seed.procedures.procedures.filter(item => Array.isArray(item.target_admin_codes) && item.target_admin_codes.includes(situation.admin_code)).slice(0, 5);
    const first = priority.areas[0];
    const best = similar.events[0];
    return { message_id: `MSG-${crypto.randomUUID()}`, answer: first ? `현재 입력·관측 조건을 계획 위험지식과 비교하여 ${first.name}을 우선 확인 후보 1순위로 제시합니다.${best ? ` 유사 참고사례는 '${best.event_name}'이며 사건 유사도는 ${best.similarity_score}점입니다.` : ''} 본 결과는 공식 위험도나 피해예측이 아니라 담당자 현장 확인을 지원하는 상대순위입니다.` : '현재 조건에서 우선 확인지역을 산정하지 못했습니다.', user_message: message, priority_areas: priority.areas, similar_events: similar.events, procedures, map_actions: first ? [{ action: 'highlight', target_id: first.spatial_object_id }, { action: 'fit_bounds', target_id: first.spatial_object_id }, { action: 'toggle_layer', layer_id: 'L-FLOOD-TRACE', visible: true }] : [], evidence: best?.evidence ?? [], warnings: ['Rule/Seed Agent 응답에 UNE RAG 근거를 구성 가능할 때 결합합니다.', ...similar.warnings], limitations: ['현재 피해예측 결과가 아닙니다.', '피해·복구는 향후 T3Q NDMS 기반 데이터로 교체할 Seed 참고정보입니다.', '대응절차는 부산 북구청 매뉴얼 참고 잠정 템플릿입니다.'], operator_confirmation_required: true };
}
