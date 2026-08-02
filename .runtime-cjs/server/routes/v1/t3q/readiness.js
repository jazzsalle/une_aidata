"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../../http");
const t3qReadiness_1 = require("../../../domain/t3qReadiness");
function GET() { const readiness = (0, t3qReadiness_1.getT3qIntegrationReadiness)(); return (0, http_1.envelope)({ readiness, summary: (0, t3qReadiness_1.readinessCounts)(readiness) }, { provider: 'T3qReadinessProvider', dataStatus: 'provisional' }); }
