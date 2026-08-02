"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const seeds_js_1 = require("../../../seeds.js");
const DATASETS = {
    'L-FLOOD-RISK-AREA': seeds_js_1.seed.mockFloodRiskAreas,
    'L-DANGEROUS-RESERVOIR': seeds_js_1.seed.mockDangerousReservoirs,
    'L-STORM-FLOOD-IMPROVEMENT': seeds_js_1.seed.mockStormFloodImprovementDistricts,
};
async function GET(request) { const layerId = new URL(request.url).searchParams.get('layer_id'); if (!layerId || !DATASETS[layerId])
    return (0, http_js_1.badRequest)('지원하는 layer_id가 필요합니다.'); return (0, http_js_1.envelope)(DATASETS[layerId], { provider: 'MockSpatialProvider', dataStatus: 'mock', warnings: ['형상·속성은 시연용 가상값입니다.'] }); }
