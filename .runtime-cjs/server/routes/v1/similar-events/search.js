"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const http_1 = require("../../../http");
const similarEvents_1 = require("../../../domain/similarEvents");
const situations_1 = require("../../../domain/situations");
async function POST(request) { try {
    const input = await (0, http_1.body)(request);
    const situation = input.situation ?? (input.situation_id ? (0, situations_1.findSeedSituation)(input.situation_id) : undefined);
    if (!situation)
        return (0, http_1.badRequest)('situation 또는 유효한 situation_id가 필요합니다.');
    const result = await (0, similarEvents_1.searchSimilarEvents)(situation, input.top_k ?? 5);
    return (0, http_1.envelope)(result.events, { provider: 'SimilarEventCompositeProvider', dataStatus: 'derived', warnings: ['과거 피해·복구 참고 Seed이며 현재 피해예측 결과가 아닙니다.', ...result.warnings] });
}
catch (error) {
    return (0, http_1.badRequest)(error instanceof Error ? error.message : '유사사례 검색 실패');
} }
