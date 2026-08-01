"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envelope = envelope;
exports.body = body;
exports.badRequest = badRequest;
function envelope(data, options = {}) {
    const requestId = crypto.randomUUID();
    return Response.json({
        data,
        meta: {
            request_id: requestId,
            provider: options.provider ?? 'VercelFunction',
            data_status: options.dataStatus ?? 'provisional',
            fallback_used: options.fallbackUsed ?? false,
            generated_at: new Date().toISOString(),
        },
        warnings: options.warnings ?? [],
        errors: options.errors ?? [],
    }, { status: options.status ?? 200, headers: { 'x-correlation-id': requestId } });
}
async function body(request) {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json'))
        throw new Error('Content-Type은 application/json이어야 합니다.');
    return request.json();
}
function badRequest(message) {
    return envelope(null, { status: 400, errors: [message] });
}
