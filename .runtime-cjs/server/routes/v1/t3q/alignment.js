"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../../http");
const seeds_1 = require("../../../seeds");
const t3qMetadata_1 = require("../../../providers/t3qMetadata");
function GET() {
    return (0, http_1.envelope)({ alignment: seeds_1.seed.t3qAlignment, integration: { api_configured: (0, t3qMetadata_1.t3qConfigured)(), mcp_configured: (0, t3qMetadata_1.t3qMcpConfigured)(), message: t3qMetadata_1.T3Q_PENDING_MESSAGE } }, { provider: 'T3qAlignmentSeedProvider', dataStatus: 'provisional' });
}
