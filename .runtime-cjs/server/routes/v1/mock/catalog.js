"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../../http");
const seeds_1 = require("../../../seeds");
async function GET() { return (0, http_1.envelope)(seeds_1.seed.mockContractCatalog, { provider: 'MockContractCatalogProvider', dataStatus: 'mock', warnings: ['실제 T3Q 데이터가 아닌 Mock 계약 카탈로그입니다.'] }); }
