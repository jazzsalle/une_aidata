"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../http.js");
const seeds_js_1 = require("../../seeds.js");
function GET(request) {
    const url = new URL(request.url);
    const admin = url.searchParams.get('admin_code');
    const rows = seeds_js_1.seed.procedures.procedures.filter((item) => !admin || item.target_admin_codes?.includes(admin));
    return (0, http_js_1.envelope)(rows, { provider: 'ProvisionalManualProvider', dataStatus: 'provisional', warnings: ['부산 북구청 풍수해 매뉴얼 참고 잠정절차이며 대상지 공식절차가 아닙니다.'] });
}
