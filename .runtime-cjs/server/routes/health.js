"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../http.js");
function GET() { return (0, http_js_1.envelope)({ status: 'ok', service: 'UNE Disaster Safety POC Vercel API', version: '1.5.1' }, { provider: 'VercelNodeFunction', dataStatus: 'actual' }); }
