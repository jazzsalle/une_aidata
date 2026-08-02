"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const seeds_js_1 = require("../../../seeds.js");
const t3qMetadata_js_1 = require("../../../providers/t3qMetadata.js");
function GET() {
    return (0, http_js_1.envelope)({ alignment: seeds_js_1.seed.t3qAlignment, integration: { api_configured: (0, t3qMetadata_js_1.t3qConfigured)(), mcp_configured: (0, t3qMetadata_js_1.t3qMcpConfigured)(), message: t3qMetadata_js_1.T3Q_PENDING_MESSAGE } }, { provider: 'T3qAlignmentSeedProvider', dataStatus: 'provisional' });
}
