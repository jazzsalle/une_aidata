"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../http.js");
const seeds_js_1 = require("../../seeds.js");
function GET(request) { const admin = new URL(request.url).searchParams.get('admin_code'); const collection = { ...seeds_js_1.seed.floodTraces, features: seeds_js_1.seed.floodTraces.features.filter(f => !admin || f.properties?.admin_code === admin) }; return (0, http_js_1.envelope)(collection, { provider: 'StaticSeedFloodTraceProvider', dataStatus: 'mock', warnings: ['POC 임의 Seed이며 실제 침수흔적도 또는 피해예측 결과가 아닙니다.'] }); }
