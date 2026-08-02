"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uneRagConfigured = uneRagConfigured;
exports.searchUneRag = searchUneRag;
exports.probeUneRagOpenApi = probeUneRagOpenApi;
const env_js_1 = require("../env.js");
let cachedToken = null;
function join(base, path) { return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`; }
function timeoutMs() { const n = Number((0, env_js_1.env)('UNE_RAG_TIMEOUT_MS') ?? '15000'); return Number.isFinite(n) ? n : 15000; }
function authMode() { return ((0, env_js_1.env)('UNE_RAG_AUTH_MODE') ?? 'login').toLowerCase(); }
function tokenFromJson(value) {
    if (!value || typeof value !== 'object')
        return undefined;
    const row = value;
    const candidates = [row.access_token, row.token, row.jwt, row.data?.access_token, row.data?.token];
    return candidates.find((v) => typeof v === 'string' && v.length > 8);
}
async function login(baseUrl) {
    if (authMode() === 'apikey')
        return (0, env_js_1.env)('UNE_RAG_API_KEY');
    if (authMode() === 'basic')
        return undefined;
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000)
        return cachedToken.value;
    const username = (0, env_js_1.env)('UNE_RAG_USERNAME'), password = (0, env_js_1.env)('UNE_RAG_PASSWORD'), path = (0, env_js_1.env)('UNE_RAG_LOGIN_PATH');
    if (!username || !password || !path)
        return undefined;
    const response = await fetch(join(baseUrl, path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(timeoutMs()) });
    if (!response.ok)
        throw new Error(`UNE RAG 로그인 실패: HTTP ${response.status}`);
    const payload = await response.json();
    const token = tokenFromJson(payload);
    if (!token)
        throw new Error('UNE RAG 로그인 응답에서 token을 찾지 못했습니다.');
    cachedToken = { value: token, expiresAt: Date.now() + 45 * 60 * 1000 };
    return token;
}
function valueAtPath(payload, path) {
    if (!path)
        return undefined;
    return path.split('.').filter(Boolean).reduce((current, segment) => current && typeof current === 'object' ? current[segment] : undefined, payload);
}
function arrayFromPayload(payload) {
    const configured = valueAtPath(payload, (0, env_js_1.env)('UNE_RAG_RESPONSE_ARRAY_PATH'));
    if (Array.isArray(configured))
        return configured;
    if (Array.isArray(payload))
        return payload;
    if (!payload || typeof payload !== 'object')
        return [];
    const row = payload;
    for (const key of ['results', 'items', 'documents', 'hits', 'chunks', 'data']) {
        const v = row[key];
        if (Array.isArray(v))
            return v;
        if (v && typeof v === 'object') {
            const nested = arrayFromPayload(v);
            if (nested.length)
                return nested;
        }
    }
    return [];
}
function text(row, keys) { for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim())
        return v;
} }
function number(row, keys) { for (const k of keys) {
    const v = row[k];
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && !Number.isNaN(Number(v)))
        return Number(v);
} }
function normalize(item, index) {
    const row = (item && typeof item === 'object' ? item : {});
    const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {});
    const content = text(row, ['content', 'text', 'chunk', 'passage', 'answer', 'body']) ?? text(metadata, ['content', 'text']) ?? '';
    const score = number(row, ['score', 'similarity', 'distance', 'rag_score', 'relevance_score']) ?? number(metadata, ['score', 'similarity']);
    const page = number(row, ['page', 'page_no', 'page_number']) ?? number(metadata, ['page', 'page_no', 'page_number']);
    const passage = text(row, ['passage_id', 'chunk_id', 'id']) ?? text(metadata, ['passage_id', 'chunk_id']);
    const title = text(row, ['title', 'document_title', 'source_title', 'filename']) ?? text(metadata, ['title', 'document_title', 'source_title', 'filename']) ?? `UNE RAG 검색결과 ${index + 1}`;
    return { evidence_id: `UNE-RAG-${passage ?? index + 1}`, source_type: 'UNE_RAG_PASSAGE', title, content, excerpt: content.slice(0, 360), page, passage_id: passage, score, rag_score: score, data_status: 'actual', metadata };
}
function uneRagConfigured() { return Boolean((0, env_js_1.env)('UNE_RAG_BASE_URL') && ((0, env_js_1.env)('UNE_RAG_API_KEY') || ((0, env_js_1.env)('UNE_RAG_USERNAME') && (0, env_js_1.env)('UNE_RAG_PASSWORD')))); }
async function searchUneRag(input) {
    const request = typeof input === 'string' ? { query: input } : input;
    const baseUrl = (0, env_js_1.env)('UNE_RAG_BASE_URL');
    if (!baseUrl)
        return { results: [], warning: 'UNE_RAG_BASE_URL 미설정으로 Seed 근거를 사용합니다.' };
    const path = (0, env_js_1.env)('UNE_RAG_SEARCH_PATH');
    if (!path)
        return { results: [], warning: 'UNE_RAG_SEARCH_PATH 미설정으로 Seed 근거를 사용합니다.' };
    try {
        const mode = authMode();
        const token = await login(baseUrl);
        const headers = { 'content-type': 'application/json', 'accept': 'application/json' };
        if (mode === 'basic')
            headers.authorization = `Basic ${btoa(`${(0, env_js_1.env)('UNE_RAG_USERNAME') ?? ''}:${(0, env_js_1.env)('UNE_RAG_PASSWORD') ?? ''}`)}`;
        else if (token)
            headers.authorization = mode === 'apikey' ? `Bearer ${token}` : `Bearer ${token}`;
        const topK = request.topK ?? Number((0, env_js_1.env)('UNE_RAG_DEFAULT_TOP_K') ?? '5');
        const body = {};
        body[(0, env_js_1.env)('UNE_RAG_QUERY_FIELD') ?? 'query'] = request.query;
        body[(0, env_js_1.env)('UNE_RAG_TOPK_FIELD') ?? 'top_k'] = topK;
        body[(0, env_js_1.env)('UNE_RAG_FILTERS_FIELD') ?? 'filters'] = request.filters ?? {};
        const dataset = (0, env_js_1.env)('UNE_RAG_DEFAULT_DATASET');
        if (dataset)
            body[(0, env_js_1.env)('UNE_RAG_DATASET_FIELD') ?? 'dataset'] = dataset;
        const response = await fetch(join(baseUrl, path), { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs()) });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const rows = arrayFromPayload(payload).map(normalize).filter(i => i.content || i.title);
        return { results: rows, warning: rows.length ? undefined : 'UNE RAG 응답은 성공했으나 검색결과 배열을 찾지 못했습니다.' };
    }
    catch (error) {
        return { results: [], warning: `UNE RAG 호출 실패: ${error instanceof Error ? error.message : 'unknown error'}` };
    }
}
async function probeUneRagOpenApi() {
    const baseUrl = (0, env_js_1.env)('UNE_RAG_BASE_URL');
    const openapiPath = (0, env_js_1.env)('UNE_RAG_OPENAPI_PATH') ?? '/openapi.json';
    if (!baseUrl)
        return { reachable: false, openapi_path: openapiPath, candidate_paths: [], warning: 'UNE_RAG_BASE_URL 미설정' };
    try {
        const response = await fetch(join(baseUrl, openapiPath), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(Math.min(timeoutMs(), 8000)) });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const info = (payload.info && typeof payload.info === 'object' ? payload.info : {});
        const paths = (payload.paths && typeof payload.paths === 'object' ? payload.paths : {});
        const candidatePaths = Object.entries(paths).map(([path, value]) => ({ path, methods: value && typeof value === 'object' ? Object.keys(value).filter(method => ['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) : [] })).filter(item => item.methods.length);
        return { reachable: true, openapi_path: openapiPath, title: typeof info.title === 'string' ? info.title : undefined, version: typeof info.version === 'string' ? info.version : undefined, candidate_paths: candidatePaths };
    }
    catch (error) {
        return { reachable: false, openapi_path: openapiPath, candidate_paths: [], warning: `UNE RAG OpenAPI 접근 실패: ${error instanceof Error ? error.message : 'unknown error'}` };
    }
}
