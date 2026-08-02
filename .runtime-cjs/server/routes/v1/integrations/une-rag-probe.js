"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const uneRag_js_1 = require("../../../providers/uneRag.js");
async function GET() {
    const result = await (0, uneRag_js_1.probeUneRagOpenApi)();
    return (0, http_js_1.envelope)(result, {
        provider: 'UNE_RAG_OPENAPI_PROBE',
        dataStatus: result.reachable ? 'actual' : 'provisional',
        warnings: result.warning ? [result.warning] : [],
    });
}
