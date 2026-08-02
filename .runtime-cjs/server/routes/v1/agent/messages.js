"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const http_js_1 = require("../../../http.js");
const agent_js_1 = require("../../../domain/agent.js");
const situations_js_1 = require("../../../domain/situations.js");
async function POST(request) { try {
    const input = await (0, http_js_1.body)(request);
    if (!input.message?.trim())
        return (0, http_js_1.badRequest)('message는 필수입니다.');
    const situation = input.situation ?? (input.situation_id ? (0, situations_js_1.findSeedSituation)(input.situation_id) : undefined);
    if (!situation)
        return (0, http_js_1.badRequest)('situation이 필요합니다.');
    return (0, http_js_1.envelope)(await (0, agent_js_1.buildAgentResponse)(situation, input.message.trim()), { provider: 'AgentToolRouterFunction', dataStatus: 'provisional' });
}
catch (error) {
    return (0, http_js_1.badRequest)(error instanceof Error ? error.message : 'Agent 처리 실패');
} }
