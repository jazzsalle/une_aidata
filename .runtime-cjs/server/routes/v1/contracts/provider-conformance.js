"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const seeds_js_1 = require("../../../seeds.js");
function GET() {
    return (0, http_js_1.envelope)(seeds_js_1.seed.providerConformanceCases, { provider: 'ProviderConformanceRegistry', dataStatus: 'mock' });
}
