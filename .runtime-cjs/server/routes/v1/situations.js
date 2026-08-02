"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const http_js_1 = require("../../http.js");
const situations_js_1 = require("../../domain/situations.js");
async function POST(request) {
    try {
        return (0, http_js_1.envelope)((0, situations_js_1.createSituation)(await (0, http_js_1.body)(request)), { provider: 'SituationFunction', dataStatus: 'provisional' });
    }
    catch (error) {
        return (0, http_js_1.badRequest)(error instanceof Error ? error.message : '현재상황 생성 실패');
    }
}
