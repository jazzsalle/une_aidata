"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const http_1 = require("../../../http");
const t3qGateway_1 = require("../../../providers/t3qGateway");
async function POST(request) { try {
    const input = await (0, http_1.body)(request);
    const query = input.query?.trim();
    if (!query)
        return (0, http_1.badRequest)('query는 필수입니다.');
    const topK = Math.min(Math.max(Number(input.top_k ?? 5), 1), 20);
    const payload = { query, admin_code: input.admin_code ?? null, taxonomy_codes: Array.isArray(input.taxonomy_codes) ? input.taxonomy_codes.map(String) : [], schema_types: Array.isArray(input.schema_types) ? input.schema_types.map(String) : [], top_k: topK };
    const result = await (0, t3qGateway_1.searchT3qPreview)(payload);
    return (0, http_1.envelope)(result, { provider: 'T3qStructureMockProvider', dataStatus: 'mock', warnings: result.warnings });
}
catch (error) {
    return (0, http_1.badRequest)(error instanceof Error ? error.message : 'T3Q 검색 미리보기 실패');
} }
