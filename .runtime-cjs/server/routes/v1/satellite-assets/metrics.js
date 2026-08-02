"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const seeds_js_1 = require("../../../seeds.js");
function GET(request) {
    const url = new URL(request.url);
    const eventId = url.searchParams.get('event_id') ?? 'POC-FLOOD-IMAGE-SAMPLE-001';
    const metrics = seeds_js_1.seed.floodMaskMetrics;
    if (metrics.event_id !== eventId)
        return (0, http_js_1.envelope)({ ...metrics, phases: [] }, { provider: 'FloodMaskPixelMetricProvider', dataStatus: 'derived', warnings: ['해당 Event의 Seed 수계마스크 지표가 없습니다.'] });
    return (0, http_js_1.envelope)(metrics, { provider: 'FloodMaskPixelMetricProvider', dataStatus: 'derived', warnings: ['픽셀 기반 상대변화이며 지리면적·피해예측이 아닙니다.'] });
}
