"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const seeds_js_1 = require("../../../seeds.js");
async function GET() { return (0, http_js_1.envelope)(seeds_js_1.seed.mockContractCatalog, { provider: 'MockContractCatalogProvider', dataStatus: 'mock', warnings: ['실제 T3Q 데이터가 아닌 Mock 계약 카탈로그입니다.'] }); }
