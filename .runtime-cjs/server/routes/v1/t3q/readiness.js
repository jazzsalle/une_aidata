"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const t3qReadiness_js_1 = require("../../../domain/t3qReadiness.js");
function GET() { const readiness = (0, t3qReadiness_js_1.getT3qIntegrationReadiness)(); return (0, http_js_1.envelope)({ readiness, summary: (0, t3qReadiness_js_1.readinessCounts)(readiness) }, { provider: 'T3qReadinessProvider', dataStatus: 'provisional' }); }
