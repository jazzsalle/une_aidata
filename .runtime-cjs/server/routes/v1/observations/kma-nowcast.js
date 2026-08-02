"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const kmaNowcast_js_1 = require("../../../providers/kmaNowcast.js");
async function GET(request) {
    try {
        const url = new URL(request.url);
        const adminCode = url.searchParams.get('admin_code');
        if (!adminCode)
            return (0, http_js_1.badRequest)('admin_code는 필수입니다.');
        const result = await (0, kmaNowcast_js_1.fetchKmaNowcast)(adminCode);
        return (0, http_js_1.envelope)({ observations: result.observations, grid: (0, kmaNowcast_js_1.kmaGrid)(adminCode), request: result.request }, { provider: 'KMA_ULTRA_SRT_NCST', dataStatus: result.observations.length ? 'actual' : 'provisional', warnings: result.warning ? [result.warning] : [] });
    }
    catch (error) {
        return (0, http_js_1.badRequest)(error instanceof Error ? error.message : '기상청 실황 조회 실패');
    }
}
