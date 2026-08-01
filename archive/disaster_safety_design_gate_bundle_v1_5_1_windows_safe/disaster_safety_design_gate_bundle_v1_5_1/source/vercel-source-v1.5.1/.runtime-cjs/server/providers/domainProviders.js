"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerMode = providerMode;
exports.eventProvider = eventProvider;
exports.providerSelections = providerSelections;
exports.similarityProfiles = similarityProfiles;
exports.selectSimilarityProfile = selectSimilarityProfile;
const env_1 = require("../env");
const seeds_1 = require("../seeds");
class MockEventProvider {
    id = 'mock_event_provider';
    mode = 'mock';
    listRecords() { return seeds_1.seed.damageRecovery.records; }
}
class T3qEventProviderStub {
    id = 't3q_event_provider_stub';
    mode = 't3q';
    listRecords() { throw new Error('T3Q Event API 미연계: Mock Provider로 전환해야 합니다.'); }
}
function providerMode(domain) {
    const key = `${domain.toUpperCase()}_PROVIDER`;
    const v = ((0, env_1.env)(key) ?? 'mock').toLowerCase();
    return ['mock', 't3q', 'openapi', 'local'].includes(v) ? v : 'mock';
}
function eventProvider() { return providerMode('event') === 't3q' ? new T3qEventProviderStub() : new MockEventProvider(); }
function providerSelections() {
    const rows = seeds_1.seed.providerContracts.providers;
    return rows.map(row => { const domain = String(row.domain); const selected = providerMode(domain); return { domain, env_key: String(row.env_key), selected, fallback: String(row.fallback).includes('mock') ? 'mock' : 'local', configured: selected === 'mock' || selected === 'local', message: selected === 'mock' ? 'Mock/Seed 계약으로 동작' : `${selected} Adapter Stub - 외부연계 전` }; });
}
function similarityProfiles() { return seeds_1.seed.similarityWeightProfiles.profiles; }
function selectSimilarityProfile(hazards) {
    const profiles = similarityProfiles();
    const taxonomy = new Set(hazards);
    return profiles.find(p => p.hazard_codes.some(c => taxonomy.has(c) || hazardAlias(hazards).has(c))) ?? profiles[0];
}
function hazardAlias(hazards) { const out = new Set(); for (const h of hazards) {
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
