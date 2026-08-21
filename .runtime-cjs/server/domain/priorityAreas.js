"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePriorityAreas = calculatePriorityAreas;
const seeds_js_1 = require("../seeds.js");
const HAZARD_CODES = {
    HEAVY_RAIN: ['T10107'], FLOOD: ['T10206'], INUNDATION: ['T10106', 'T10107'],
    TYPHOON: ['T10105'], LANDSLIDE: ['T10401'],
};
function numeric(observations, type) {
    const value = observations.find((item) => item.type === type)?.value;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function trendScore(observations) {
    const trends = observations.map((item) => item.trend).filter(Boolean);
    if (trends.includes('rapid_rise'))
        return 10;
    if (trends.includes('rising'))
        return 6;
    return 0;
}
function currentConditionScore(situation) {
    const obs = situation.observations;
    const reasons = [];
    let score = 0;
    const r1 = numeric(obs, 'RAINFALL_1H');
    const r3 = numeric(obs, 'RAINFALL_3H');
    const r12 = numeric(obs, 'RAINFALL_12H');
    if ((r1 ?? 0) >= 72) {
        score += 18;
        reasons.push(`1시간 강우 ${r1}mm`);
    }
    else if ((r1 ?? 0) >= 50) {
        score += 12;
        reasons.push(`1시간 강우 ${r1}mm`);
    }
    if ((r3 ?? 0) >= 90) {
        score += 18;
        reasons.push(`3시간 강우 ${r3}mm`);
    }
    else if ((r3 ?? 0) >= 60) {
        score += 12;
        reasons.push(`3시간 강우 ${r3}mm`);
    }
    if ((r12 ?? 0) >= 180) {
        score += 18;
        reasons.push(`12시간 강우 ${r12}mm`);
    }
    else if ((r12 ?? 0) >= 110) {
        score += 12;
        reasons.push(`12시간 강우 ${r12}mm`);
    }
    const alert = obs.find((item) => item.type === 'WEATHER_ALERT');
    if (String(alert?.value ?? '').includes('경보')) {
        score += 12;
        reasons.push(String(alert?.name ?? '기상 경보'));
    }
    else if (alert) {
        score += 7;
        reasons.push(String(alert.name ?? '기상 특보'));
    }
    const trend = trendScore(obs);
    score += trend;
    if (trend)
        reasons.push(trend === 10 ? '수위 급상승 징후' : '수위·유량 상승 징후');
    return { score: Math.min(score, 45), reasons };
}
function gradeScore(grade) {
    const text = String(grade ?? '');
    if (text.includes('고위험') || text.includes('초고위험'))
        return 20;
    if (text.includes('중위험'))
        return 14;
    return 8;
}
function requiredChecks(district) {
    const type = String(district.disaster_type ?? '');
    const checks = ['현장 접근 가능 여부와 최신 상황 확인', '관측정보의 시각·출처·결측 여부 확인'];
    if (type.includes('하천'))
        checks.unshift('제방·교량·하천변 도로의 월류·통제 상태 확인', '관련 수위·유량 관측소 확인');
    if (type.includes('내수'))
        checks.unshift('저지대·배수시설·도로 침수 및 하수 역류 확인');
    if (type.includes('사면') || type.includes('토사'))
        checks.unshift('급경사지 균열·토사유출·접근통제 여부 확인');
    return checks.slice(0, 4);
}
function calculatePriorityAreas(situation) {
    const districtRows = seeds_js_1.seed.districts.districts.filter((item) => item.admin_code === situation.admin_code);
    // 메타 표본 지역(-META-)은 **산정하지 않는다** — 점수·사유 같은 우리 로직 산출값이 표본과 섞이면
    // T3Q에서 온 데이터로 오인된다(2026-08-21 지시). 지구를 전달분 파일 순서 그대로 나열만 하고,
    // 계약(JSON Schema)이 요구하는 rank(≥1)·score(number)는 형식상 채우되 화면은 그리지 않는다.
    // reasons·required_checks 는 빈 배열(계약상 적법) — 보고서 초안·Agent 반환에도 우리 문장이 안 실린다.
    if (situation.situation_id.includes('-META-')) {
        return {
            situation_id: situation.situation_id,
            generated_at: new Date().toISOString(),
            method: 'META_DEMO_LISTING_NO_SCORING',
            official_risk_score: false,
            areas: districtRows.map((district, index) => ({
                rank: index + 1,
                spatial_object_id: district.district_code,
                name: district.district_name,
                score: 0,
                component_scores: {},
                reasons: [],
                required_checks: [],
                operator_confirmation_required: true,
            })),
        };
    }
    const current = currentConditionScore(situation);
    const targetCodes = new Set(situation.hazards.flatMap((code) => HAZARD_CODES[code] ?? [code]));
    const locationText = JSON.stringify(situation.user_input ?? {}).toLowerCase();
    const areas = districtRows.map((district) => {
        let score = current.score;
        const reasons = [...current.reasons];
        const hazardMatch = (district.hazard_codes ?? []).some((code) => targetCodes.has(code));
        const hazardScore = hazardMatch ? 20 : 5;
        score += hazardScore;
        if (hazardMatch)
            reasons.push(`현재 재난유형과 ${district.disaster_type} 위험요인 일치`);
        const riskScore = gradeScore(district.grade);
        score += riskScore;
        reasons.push(`계획자료 위험도: ${String(district.grade ?? '등급 미기재')}`);
        const historyScore = (district.damage_events?.length ?? 0) > 0 ? 10 : 0;
        score += historyScore;
        if (historyScore)
            reasons.push(`과거 피해·홍수 이력 ${district.damage_events?.length}건`);
        const locationMatch = [district.district_name, district.river_name, district.location]
            .filter(Boolean).some((value) => locationText.includes(String(value).toLowerCase()));
        const locationScore = locationMatch ? 10 : 0;
        score += locationScore;
        if (locationMatch)
            reasons.push('사용자 입력 위치·대상과 직접 연관');
        const mitigationScore = (district.risk_factors?.length ?? 0) > 0 ? 8 : 0;
        score += mitigationScore;
        if (mitigationScore)
            reasons.push(String(district.risk_factors?.[0] ?? '계획자료 위험요인 존재'));
        return {
            rank: 0,
            spatial_object_id: district.district_code,
            name: district.district_name,
            score: Math.min(Math.round(score), 100),
            component_scores: { current_condition: current.score, hazard_match: hazardScore, plan_risk: riskScore, history: historyScore, location: locationScore, evidence: mitigationScore },
            reasons: reasons.slice(0, 6),
            required_checks: requiredChecks(district),
            operator_confirmation_required: true,
        };
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ko'))
        .slice(0, 5).map((item, index) => ({ ...item, rank: index + 1 }));
    return { situation_id: situation.situation_id, generated_at: new Date().toISOString(), method: 'POC_RULE_V0.2_CURRENT_CONTEXT_PLUS_PLAN_EVENT', official_risk_score: false, areas };
}
