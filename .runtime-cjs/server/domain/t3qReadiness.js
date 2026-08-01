"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getT3qIntegrationReadiness = getT3qIntegrationReadiness;
exports.getT3qCqCoverage = getT3qCqCoverage;
exports.readinessCounts = readinessCounts;
const seeds_1 = require("../seeds");
function getT3qIntegrationReadiness() {
    return seeds_1.seed.t3qReadiness;
}
function getT3qCqCoverage(adminCode) {
    const base = seeds_1.seed.t3qCqCoverage;
    if (!adminCode)
        return base;
    return { ...base, coverage_basis: `${base.coverage_basis ?? ''} · 대상 행정코드 ${adminCode}` };
}
function readinessCounts(readiness) {
    const counts = {};
    readiness.dimensions.forEach(row => { counts[row.state] = (counts[row.state] ?? 0) + 1; });
    return counts;
}
