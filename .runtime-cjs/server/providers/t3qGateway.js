"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.t3qSearchConfigured = t3qSearchConfigured;
exports.t3qRuntimeMode = t3qRuntimeMode;
exports.searchT3qPreview = searchT3qPreview;
const seeds_js_1 = require("../seeds.js");
const t3qCompatibility_js_1 = require("../domain/t3qCompatibility.js");
function normalize(text) { return (text ?? '').toLocaleLowerCase('ko-KR').replace(/[^0-9a-zA-Z가-힣]+/g, ' ').replace(/\s+/g, ' ').trim(); }
const QUERY_STOPWORDS = new Set(['관내', '어떤', '어디', '어디인가', '무엇', '해야', '하는가', '확인']);
function queryTokens(query) {
    return normalize(query).split(' ').filter(Boolean).map(token => token
        .replace(/(어디인가|해야하는가|하는가|인가)$/, '')
        .replace(/(에서|으로|에게|부터|까지|보다|처럼)$/, '')
        .replace(/(은|는|이|가|을|를|의)$/, '')).filter(token => token.length >= 2 && !QUERY_STOPWORDS.has(token));
}
function containsQuery(passage, query) {
    const tokens = queryTokens(query);
    if (!tokens.length)
        return true;
    const hay = normalize(`${passage.title ?? ''} ${passage.content ?? ''} ${passage.schema_type}`);
    return tokens.some(token => hay.includes(token));
}
function taxonomyMatches(selected, candidates) { return selected.length === 0 || selected.some(code => candidates.some(candidate => (0, t3qCompatibility_js_1.taxonomyPrefixMatch)(code, candidate) || (0, t3qCompatibility_js_1.taxonomyPrefixMatch)(candidate, code))); }
function t3qSearchConfigured() { return false; }
function t3qRuntimeMode() { return 'mock_only'; }
async function searchT3qPreview(request) {
    const allEvents = seeds_js_1.seed.t3qMockEvents.events;
    const allPassages = seeds_js_1.seed.t3qMockPassages.passages;
    let structural = allPassages.filter(row => (!request.admin_code || row.admin_code === request.admin_code) && taxonomyMatches(request.taxonomy_codes, row.taxonomy_codes));
    if (request.schema_types?.length)
        structural = structural.filter(row => request.schema_types.includes(row.schema_type));
    const lexical = structural.filter(row => containsQuery(row, request.query));
    const usedStructuralFallback = lexical.length === 0 && structural.length > 0;
    const passages = usedStructuralFallback ? structural : lexical;
    const eventIds = new Set(passages.map(row => row.ref_disaster_event_id).filter(Boolean));
    let events = allEvents.filter(row => (!request.admin_code || row.region_code_5 === request.admin_code) && taxonomyMatches(request.taxonomy_codes, row.taxonomy_codes));
    if (eventIds.size)
        events = events.filter(row => eventIds.has(row.event_id));
    const warnings = ['현재 단계는 T3Q 외부 기술연계 없이 UNE Mock 계약으로만 동작합니다.', '결과는 실제 T3Q 데이터·공식 위험정보·피해예측이 아닙니다.'];
    if (usedStructuralFallback)
        warnings.push('질의어 직접일치 결과가 없어 행정구역·T코드·SchemaType 구조필터 결과를 사용했습니다.');
    if (!events.length && !passages.length)
        warnings.push('조건에 맞는 Mock 데이터가 없습니다. 데이터 미확보 상태를 정상 결과로 처리합니다.');
    return { request, mode: 'mock_contract', events: events.slice(0, request.top_k), passages: passages.slice(0, request.top_k), warnings };
}
