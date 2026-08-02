"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const http_js_1 = require("../../../http.js");
const seeds_js_1 = require("../../../seeds.js");
const uneRag_js_1 = require("../../../providers/uneRag.js");
async function POST(request) {
    try {
        const input = await (0, http_js_1.body)(request);
        const structured = seeds_js_1.seed.districts.districts.filter((item) => !input.admin_code || item.admin_code === input.admin_code);
        const rag = await (0, uneRag_js_1.searchUneRag)(input.query ?? '');
        return (0, http_js_1.envelope)({ structured, rag_results: rag.results }, { provider: 'RiskKnowledgeCompositeProvider', dataStatus: 'provisional', warnings: rag.warning ? [rag.warning] : [] });
    }
    catch (error) {
        return (0, http_js_1.badRequest)(error instanceof Error ? error.message : '위험지식 검색 실패');
    }
}
