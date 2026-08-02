"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../../http");
const uneRag_1 = require("../../../providers/uneRag");
async function GET() {
    const result = await (0, uneRag_1.probeUneRagOpenApi)();
    return (0, http_1.envelope)(result, {
        provider: 'UNE_RAG_OPENAPI_PROBE',
        dataStatus: result.reachable ? 'actual' : 'provisional',
        warnings: result.warning ? [result.warning] : [],
    });
}
