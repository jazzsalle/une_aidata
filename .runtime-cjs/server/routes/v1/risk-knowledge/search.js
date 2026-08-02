"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const http_1 = require("../../../http");
const seeds_1 = require("../../../seeds");
const uneRag_1 = require("../../../providers/uneRag");
async function POST(request) {
    try {
        const input = await (0, http_1.body)(request);
        const structured = seeds_1.seed.districts.districts.filter((item) => !input.admin_code || item.admin_code === input.admin_code);
        const rag = await (0, uneRag_1.searchUneRag)(input.query ?? '');
        return (0, http_1.envelope)({ structured, rag_results: rag.results }, { provider: 'RiskKnowledgeCompositeProvider', dataStatus: 'provisional', warnings: rag.warning ? [rag.warning] : [] });
    }
    catch (error) {
        return (0, http_1.badRequest)(error instanceof Error ? error.message : '위험지식 검색 실패');
    }
}
