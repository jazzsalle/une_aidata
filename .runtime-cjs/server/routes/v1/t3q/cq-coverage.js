"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../../http");
const t3qReadiness_1 = require("../../../domain/t3qReadiness");
function GET(request) { const url = new URL(request.url); const adminCode = url.searchParams.get('admin_code'); return (0, http_1.envelope)((0, t3qReadiness_1.getT3qCqCoverage)(adminCode), { provider: 'T3qCqCoverageProvider', dataStatus: 'provisional' }); }
