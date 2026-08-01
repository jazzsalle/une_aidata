"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSeedSituation = findSeedSituation;
exports.createSituation = createSituation;
const seeds_1 = require("../seeds");
function findSeedSituation(id) {
    return seeds_1.seed.currentSituations.situations.find((item) => item.situation_id === id);
}
function createSituation(input) {
    const base = seeds_1.seed.currentSituations.situations.find((item) => item.admin_code === input.admin_code);
    if (!base)
        throw new Error('지원하지 않는 POC 지역입니다.');
    if (!Array.isArray(input.hazards) || input.hazards.length === 0)
        throw new Error('재난유형은 1개 이상 필요합니다.');
    const observations = input.observations?.length ? input.observations : base.observations;
    const latest = observations.map((item) => item.observed_at).sort().at(-1) ?? input.reference_time ?? new Date().toISOString();
    return {
        ...base,
        situation_id: `SIT-${input.admin_code}-${crypto.randomUUID()}`,
        reference_time: input.reference_time ?? new Date().toISOString(),
        mode: input.mode ?? 'hybrid',
        hazards: input.hazards,
        observations,
        user_input: input.user_input ?? {},
        data_quality: { latest_at: latest, missing: [], delayed: [], fallback_used: observations.every((item) => !item.official_data) },
        warnings: observations.every((item) => !item.official_data) ? ['사용자 입력 또는 시나리오 관측값을 사용했습니다.'] : [],
    };
}
