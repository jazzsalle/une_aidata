"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../../server/http");
const seeds_1 = require("../../../server/seeds");
const DATASETS = {
    'L-FLOOD-RISK-AREA': seeds_1.seed.mockFloodRiskAreas,
    'L-DANGEROUS-RESERVOIR': seeds_1.seed.mockDangerousReservoirs,
    'L-STORM-FLOOD-IMPROVEMENT': seeds_1.seed.mockStormFloodImprovementDistricts,
};
async function GET(request) { const layerId = new URL(request.url).searchParams.get('layer_id'); if (!layerId || !DATASETS[layerId])
    return (0, http_1.badRequest)('지원하는 layer_id가 필요합니다.'); return (0, http_1.envelope)(DATASETS[layerId], { provider: 'MockSpatialProvider', dataStatus: 'mock', warnings: ['형상·속성은 시연용 가상값입니다.'] }); }
