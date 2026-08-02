"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchSimilarEvents = searchSimilarEvents;
exports.findSimilarEvent = findSimilarEvent;
const uneRag_js_1 = require("../providers/uneRag.js");
const domainProviders_js_1 = require("../providers/domainProviders.js");
const FACTOR_NAMES = { hazard_type: '재난유형', weather_hydrology: '기상·수문', spatial: '공간·유역', vulnerability: '취약요인', damage_pattern: '피해양상', response_pattern: '대응조치', temporal: '계절·시간' };
function asRecords(value) { return Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : []; }
function strings(value) { return Array.isArray(value) ? value.map(String).filter(Boolean) : []; }
function text(value) { return typeof value === 'string' ? value : ''; }
function hazardCodes(values) { const out = new Set(); for (const h of values) {
    out.add(h);
    if (h === 'HEAVY_RAIN')
        out.add('T10107');
    if (h === 'FLOOD')
        out.add('T10206');
    if (h === 'INUNDATION')
        out.add('T10106');
    if (h === 'TYPHOON')
        out.add('T10105');
    if (h === 'LANDSLIDE')
        out.add('T10401');
} return out; }
function jaccard(a, b) { if (!a.size || !b.size)
    return null; let n = 0; for (const v of a)
    if (b.has(v))
        n++; return n / (a.size + b.size - n); }
function numSimilarity(a, b, tolerance) { if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b))
    return null; return Math.max(0, 1 - Math.abs(a - b) / tolerance); }
function trendSimilarity(a, b) { if (typeof a !== 'string' || typeof b !== 'string')
    return null; if (a === b)
    return 1; const rising = new Set(['rising', 'rapid_rise']); return rising.has(a) && rising.has(b) ? 0.8 : 0.2; }
function avg(values) { const valid = values.filter((v) => typeof v === 'number'); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; }
function observation(s, type) { return s.observations.find(o => o.type === type)?.value; }
function currentInput(s, key) { return s.user_input?.[key]; }
function tokens(values) { const raw = Array.isArray(values) ? values.map(String).join(' ') : JSON.stringify(values ?? ''); return new Set(raw.toLowerCase().split(/[\s,·/()\[\]{}:'"-]+/).filter(v => v.length >= 2)); }
function tokenSimilarity(a, b) { return jaccard(tokens(a), tokens(b)); }
function season(value) { const m = new Date(value).getMonth() + 1; return Math.floor((m % 12) / 3); }
function factor(code, currentValue, candidateValue, score, weight, desc, evidenceIds = []) { return { factor_code: code, factor_name: FACTOR_NAMES[code] ?? code, current_value: currentValue, candidate_value: candidateValue, unit: null, normalized_score: score === null ? null : Math.round(score * 1000) / 1000, weight, effective_weight: 0, contribution_score: 0, availability: score === null ? 'NOT_AVAILABLE' : 'AVAILABLE', comparison_description: desc, evidence_ids: evidenceIds }; }
function seedEvidence(record) { return asRecords(record.evidence).map((e, i) => ({ evidence_id: String(e.evidence_id ?? `EVD-${i + 1}`), source_type: String(e.source_type ?? 'SEED'), title: String(e.title ?? '근거자료'), excerpt: typeof e.excerpt === 'string' ? e.excerpt : null, page: typeof e.page === 'number' ? e.page : null, passage_id: typeof e.passage_id === 'string' ? e.passage_id : null, data_status: (e.data_status ?? record.data_status ?? 'provisional') })); }
function damageTerms(record) { const d = record.damage; return d ? [d.description, d.private_facility, d.public_facility, d.agriculture] : []; }
function responseTerms(record) { return asRecords(record.response).map(r => r.action); }
function buildFactors(s, r, p, evidenceIds) {
    const cond = (r.conditions && typeof r.conditions === 'object' ? r.conditions : {});
    const risk = (r.risk_context && typeof r.risk_context === 'object' ? r.risk_context : {});
    const currentHazards = hazardCodes(s.hazards), candidateHazards = hazardCodes(strings(r.taxonomy_codes ?? r.hazards));
    const weather = avg([numSimilarity(observation(s, 'RAINFALL_3H'), cond.rainfall_3h_mm, 90), numSimilarity(observation(s, 'RAINFALL_12H'), cond.rainfall_12h_mm, 200), numSimilarity(observation(s, 'WATER_LEVEL'), cond.water_level_m, 5), numSimilarity(observation(s, 'WIND_SPEED'), cond.wind_speed_ms, 30), trendSimilarity(s.observations.find(o => o.type === 'WATER_LEVEL')?.trend, cond.water_level_trend)]);
    const currentKeywords = [currentInput(s, 'location_text'), currentInput(s, 'field_symptoms'), currentInput(s, 'affected_objects')];
    const vulnerability = tokenSimilarity(currentKeywords, [cond.risk_keywords, risk.risk_factors, risk.location, risk.river_name]);
    const damage = tokenSimilarity(currentInput(s, 'affected_objects'), damageTerms(r));
    const response = tokenSimilarity(currentInput(s, 'required_checks'), responseTerms(r));
    const sameAdmin = String(r.admin_code) === s.admin_code ? 1 : 0.35;
    const temporal = season(String(r.occurred_from)) === season(s.reference_time) ? 1 : 0.35;
    const w = p.weights;
    return [
        factor('hazard_type', s.hazards, strings(r.taxonomy_codes ?? r.hazards), jaccard(currentHazards, candidateHazards), w.hazard_type ?? 0, 'T코드·재난유형 겹침 정도', evidenceIds),
        factor('weather_hydrology', { rain3: observation(s, 'RAINFALL_3H'), rain12: observation(s, 'RAINFALL_12H'), water: observation(s, 'WATER_LEVEL'), wind: observation(s, 'WIND_SPEED') }, cond, weather, w.weather_hydrology ?? 0, '비교 가능한 강우·수위·풍속·추세의 평균 유사도', evidenceIds),
        factor('spatial', s.admin_code, r.admin_code, sameAdmin, w.spatial ?? 0, sameAdmin === 1 ? '동일 지자체' : '타 지역 비교', evidenceIds),
        factor('vulnerability', currentKeywords, [cond.risk_keywords, risk.risk_factors], vulnerability, w.vulnerability ?? 0, '위험지구·취약요인 키워드 비교', evidenceIds),
        factor('damage_pattern', currentInput(s, 'affected_objects'), damageTerms(r), damage, w.damage_pattern ?? 0, '현재 확인대상과 과거 피해대상 비교', evidenceIds),
        factor('response_pattern', currentInput(s, 'required_checks'), responseTerms(r), response, w.response_pattern ?? 0, '현재 확인사항과 과거 대응조치 비교', evidenceIds),
        factor('temporal', s.reference_time, r.occurred_from, temporal, w.temporal ?? 0, '계절·발생시기 유사도', evidenceIds)
    ];
}
function summarize(factors, profile, retrieval) { const available = factors.filter(f => f.availability === 'AVAILABLE' && f.normalized_score !== null); const availableWeight = available.reduce((s, f) => s + f.weight, 0); for (const f of factors) {
    if (f.availability === 'AVAILABLE' && f.normalized_score !== null && availableWeight > 0) {
        f.effective_weight = Math.round(f.weight / availableWeight * 1000) / 10;
        f.contribution_score = Math.round(f.normalized_score * f.weight / availableWeight * 1000) / 10;
    }
} const score = Math.round(available.reduce((s, f) => s + f.contribution_score, 0)); const confidence = availableWeight >= 85 ? 'HIGH' : availableWeight >= 70 ? 'MEDIUM' : 'LIMITED'; return { profile_id: profile.profile_id, profile_version: profile.version, event_similarity_score: score, retrieval_relevance_score: retrieval, available_weight: availableWeight, comparison_coverage: availableWeight, confidence_status: confidence, graph_similarity_score: null, graph_similarity_status: 'NOT_AVAILABLE', factors }; }
function compareResponses(s, r, evidenceIds) { const checks = strings(currentInput(s, 'required_checks')); const past = asRecords(r.response); return (checks.length ? checks : ['현재 확인사항 미입력']).map((check, i) => { const action = past[i] ?? past.find(p => tokenSimilarity(check, p.action) > 0) ?? null; return { action_category: `CHECK-${i + 1}`, current_required_check: check, past_event_action: action ? String(action.action ?? '') : null, responsible_agency: action && typeof action.responsible_agency === 'string' ? action.responsible_agency : null, past_outcome: action && typeof action.status === 'string' ? action.status : null, difference: action ? '과거 조치와 현재 확인사항을 비교하여 담당자가 적용 여부를 판단' : '대응조치 근거 미확보 - 현재 매뉴얼·현장 확인 필요', evidence_ids: evidenceIds, operator_confirmation_required: true }; }); }
async function searchSimilarEvents(situation, topK = 5) {
    let records;
    const warnings = [];
    try {
        records = (0, domainProviders_js_1.eventProvider)().listRecords();
    }
    catch (e) {
        warnings.push(e instanceof Error ? e.message : 'Event Provider 실패');
        records = [];
    }
    const query = `${situation.admin_name ?? situation.admin_code} ${situation.hazards.join(' ')} 과거 피해 대응 복구 유사사례`;
    const rag = await (0, uneRag_js_1.searchUneRag)({ query, topK: Math.min(topK, 5), filters: { admin_code: situation.admin_code, hazards: situation.hazards } });
    if (rag.warning)
        warnings.push(rag.warning);
    const retrieval = rag.results.length ? Math.max(...rag.results.map(r => r.rag_score ?? r.score ?? 0)) : null;
    const scored = records.map(record => { const ev = seedEvidence(record); const profile = (0, domainProviders_js_1.selectSimilarityProfile)([...situation.hazards, ...strings(record.taxonomy_codes ?? record.hazards)]); const factors = buildFactors(situation, record, profile, ev.map(e => e.evidence_id)); const similarity = summarize(factors, profile, retrieval); const reasons = factors.filter(f => f.availability === 'AVAILABLE').sort((a, b) => b.contribution_score - a.contribution_score).slice(0, 4).map(f => `${f.factor_name} ${f.contribution_score.toFixed(1)}점`); return { record, similarity, reasons, evidence: ev }; }).sort((a, b) => b.similarity.event_similarity_score - a.similarity.event_similarity_score).slice(0, Math.min(Math.max(topK, 1), 20));
    const ragEvidence = rag.results.map(r => ({ ...r, score: r.rag_score ?? r.score ?? null }));
    const events = scored.map(({ record, similarity, reasons, evidence }, index) => ({ event_id: String(record.event_id), record_id: String(record.record_id), admin_code: String(record.admin_code), admin_name: String(record.admin_name), event_name: String(record.event_name), occurred_from: String(record.occurred_from), occurred_to: typeof record.occurred_to === 'string' ? record.occurred_to : null, hazards: strings(record.hazards), similarity_score: similarity.event_similarity_score, similarity_reasons: reasons, spatial_relation: String(record.admin_code) === situation.admin_code ? '동일 지자체' : '타 지역', similarity, response_comparison: compareResponses(situation, record, evidence.map(e => e.evidence_id)), conditions: (record.conditions ?? {}), damage: (record.damage ?? {}), response: asRecords(record.response), recovery: asRecords(record.recovery), evidence: [...evidence, ...(index === 0 ? ragEvidence : [])], data_status: (record.data_status ?? 'synthetic_demo'), source_type: text(record.source_type) || undefined, provider_id: text(record.provider_id) || undefined, official_data: Boolean(record.official_data), is_prediction: false, display_badges: strings(record.display_badges) }));
    return { events, warnings };
}
function findSimilarEvent(eventId) { const r = (0, domainProviders_js_1.eventProvider)().listRecords().find(i => i.event_id === eventId); if (!r)
    return undefined; const ev = seedEvidence(r); const profile = (0, domainProviders_js_1.selectSimilarityProfile)(strings(r.taxonomy_codes ?? r.hazards)); const emptyFactors = Object.entries(profile.weights).map(([code, weight]) => factor(code, null, null, null, weight, '상세조회에서는 현재상황 비교점수를 산정하지 않음', ev.map(e => e.evidence_id))); const similarity = summarize(emptyFactors, profile, null); return { event_id: String(r.event_id), record_id: String(r.record_id), admin_code: String(r.admin_code), admin_name: String(r.admin_name), event_name: String(r.event_name), occurred_from: String(r.occurred_from), occurred_to: typeof r.occurred_to === 'string' ? r.occurred_to : null, hazards: strings(r.hazards), similarity_score: 0, similarity_reasons: [], spatial_relation: '상세조회', similarity, response_comparison: [], conditions: (r.conditions ?? {}), damage: (r.damage ?? {}), response: asRecords(r.response), recovery: asRecords(r.recovery), evidence: ev, data_status: (r.data_status ?? 'synthetic_demo'), source_type: text(r.source_type) || undefined, provider_id: text(r.provider_id) || undefined, official_data: Boolean(r.official_data), is_prediction: false, display_badges: strings(r.display_badges) }; }
