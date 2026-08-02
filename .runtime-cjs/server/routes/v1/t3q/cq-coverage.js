"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const t3qReadiness_js_1 = require("../../../domain/t3qReadiness.js");
function GET(request) { const url = new URL(request.url); const adminCode = url.searchParams.get('admin_code'); return (0, http_js_1.envelope)((0, t3qReadiness_js_1.getT3qCqCoverage)(adminCode), { provider: 'T3qCqCoverageProvider', dataStatus: 'provisional' }); }
