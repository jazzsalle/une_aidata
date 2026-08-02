"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const http_js_1 = require("../../../http.js");
const publicObservation_js_1 = require("../../../providers/publicObservation.js");
const seeds_js_1 = require("../../../seeds.js");
async function POST(request) {
    try {
        const input = await (0, http_js_1.body)(request);
        if (!input.admin_code)
            return (0, http_js_1.badRequest)('admin_code는 필수입니다.');
        const live = await (0, publicObservation_js_1.fetchPublicObservations)(input.admin_code, input.reference_time);
        if (live.observations.length)
            return (0, http_js_1.envelope)(live.observations, { provider: 'PublicObservationProvider', dataStatus: 'actual', warnings: live.warnings });
        const scenario = seeds_js_1.seed.currentSituations.situations.find((item) => item.admin_code === input.admin_code)?.observations ?? [];
        return (0, http_js_1.envelope)(scenario, { provider: 'ScenarioObservationProvider', dataStatus: 'scenario', fallbackUsed: true, warnings: live.warnings });
    }
    catch (error) {
        return (0, http_js_1.badRequest)(error instanceof Error ? error.message : '관측조회 실패');
    }
}
