"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../../server/http");
const seeds_1 = require("../../../server/seeds");
async function GET() { return (0, http_1.envelope)(seeds_1.seed.t3qMockSearchScenarios, { provider: 'MockSearchScenarioProvider', dataStatus: 'mock', warnings: ['CQ 5문 화면·검색 흐름 검증용 시나리오입니다.'] }); }
