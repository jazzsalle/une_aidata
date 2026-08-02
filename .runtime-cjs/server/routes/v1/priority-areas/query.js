"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const http_1 = require("../../../http");
const priorityAreas_1 = require("../../../domain/priorityAreas");
const situations_1 = require("../../../domain/situations");
async function POST(request) {
    try {
        const input = await (0, http_1.body)(request);
        const situation = input.situation ?? (input.situation_id ? (0, situations_1.findSeedSituation)(input.situation_id) : undefined);
        if (!situation)
            return (0, http_1.badRequest)('situation 또는 유효한 situation_id가 필요합니다.');
        return (0, http_1.envelope)((0, priorityAreas_1.calculatePriorityAreas)(situation), { provider: 'PriorityAreaRuleService', dataStatus: 'derived', warnings: ['공식 위험도·피해예측이 아닌 현재조건 기반 POC 상대순위입니다.'] });
    }
    catch (error) {
        return (0, http_1.badRequest)(error instanceof Error ? error.message : '우선 확인지역 산정 실패');
    }
}
