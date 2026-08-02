"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const seeds_js_1 = require("../../../seeds.js");
function GET() { return (0, http_js_1.envelope)(seeds_js_1.seed.similarityWeightProfiles, { provider: 'MockSimilarityPolicyProvider', dataStatus: 'mock', warnings: ['시연용 가중치 Profile이며 실제 T3Q 운영 가중치가 아닙니다.'] }); }
