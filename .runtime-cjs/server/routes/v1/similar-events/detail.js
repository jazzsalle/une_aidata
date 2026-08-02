"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const similarEvents_js_1 = require("../../../domain/similarEvents.js");
function GET(request) { const eventId = new URL(request.url).searchParams.get('event_id'); if (!eventId)
    return (0, http_js_1.envelope)(null, { status: 400, errors: ['event_id는 필수입니다.'] }); const event = (0, similarEvents_js_1.findSimilarEvent)(eventId); if (!event)
    return (0, http_js_1.envelope)(null, { status: 404, errors: ['유사사례를 찾지 못했습니다.'] }); return (0, http_js_1.envelope)(event, { provider: 'StaticDamageRecoveryProvider', dataStatus: 'mock', warnings: ['현재 피해예측이 아닌 POC 참고 Seed입니다.'] }); }
