"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const seeds_js_1 = require("../../../seeds.js");
async function GET() { return (0, http_js_1.envelope)(seeds_js_1.seed.t3qMockSearchScenarios, { provider: 'MockSearchScenarioProvider', dataStatus: 'mock', warnings: ['CQ 5문 화면·검색 흐름 검증용 시나리오입니다.'] }); }
