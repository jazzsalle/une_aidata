"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreeDLabsSatelliteEvidenceSetProvider = exports.StaticSeedSatelliteEvidenceSetProvider = void 0;
const seeds_js_1 = require("../seeds.js");
class StaticSeedSatelliteEvidenceSetProvider {
    async list() { return seeds_js_1.seed.satelliteEvidenceSets.sets; }
    async get(evidenceSetId) { return seeds_js_1.seed.satelliteEvidenceSets.sets.find(item => item.evidence_set_id === evidenceSetId) ?? null; }
}
exports.StaticSeedSatelliteEvidenceSetProvider = StaticSeedSatelliteEvidenceSetProvider;
class ThreeDLabsSatelliteEvidenceSetProvider {
    async list() { throw new Error('THREEDLABS_PROVIDER_NOT_CONFIGURED'); }
    async get(_evidenceSetId) { throw new Error('THREEDLABS_PROVIDER_NOT_CONFIGURED'); }
}
exports.ThreeDLabsSatelliteEvidenceSetProvider = ThreeDLabsSatelliteEvidenceSetProvider;
