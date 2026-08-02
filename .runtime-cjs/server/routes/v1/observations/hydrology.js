"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../../http");
const hrfcoHydrology_1 = require("../../../providers/hrfcoHydrology");
async function GET(request) {
    try {
        const url = new URL(request.url);
        const adminCode = url.searchParams.get('admin_code');
        if (!adminCode)
            return (0, http_1.badRequest)('admin_code는 필수입니다.');
        const status = (0, hrfcoHydrology_1.hydrologyStationStatus)(adminCode);
        const result = await (0, hrfcoHydrology_1.fetchHrfcoHydrology)(adminCode);
        return (0, http_1.envelope)({ observations: result.observations, station: result.station ?? status.station }, {
            provider: 'HRFCO_STANDARD_HYDROLOGY_DB',
            dataStatus: result.observations.length ? 'actual' : 'provisional',
            warnings: result.warning ? [result.warning] : [],
        });
    }
    catch (error) {
        return (0, http_1.badRequest)(error instanceof Error ? error.message : '홍수통제소 수위·유량 조회 실패');
    }
}
