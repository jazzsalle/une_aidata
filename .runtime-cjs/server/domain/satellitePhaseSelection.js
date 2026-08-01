"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phaseTargets = phaseTargets;
exports.selectFloodPhaseAssets = selectFloodPhaseAssets;
const DAY_MS = 86_400_000;
function ms(value) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed))
        throw new Error(`유효하지 않은 날짜: ${value}`);
    return parsed;
}
function iso(value) { return new Date(value).toISOString(); }
function offsetDays(acquired, target) {
    return Math.round(((acquired - target) / DAY_MS) * 1000) / 1000;
}
function quality(candidate) {
    if (typeof candidate.quality_score === 'number')
        return candidate.quality_score;
    if (typeof candidate.cloud_cover_pct === 'number')
        return 100 - candidate.cloud_cover_pct;
    return candidate.official_data ? 60 : 40;
}
function phaseTargets(event) {
    const start = ms(event.event_start_at);
    const end = ms(event.event_end_at);
    if (end < start)
        throw new Error('event_end_at은 event_start_at보다 빠를 수 없습니다.');
    return {
        PRE: start - 12 * DAY_MS,
        EVENT: start + (end - start) / 2,
        POST: end + 12 * DAY_MS,
        EVENT_START: start,
        EVENT_END_PLUS_2: end + 2 * DAY_MS,
    };
}
function selectOne(event, candidates, phase, kind) {
    const target = phaseTargets(event);
    const subset = candidates.filter((item) => item.asset_kind === kind && (!item.event_id || item.event_id === event.event_id));
    let eligible = [];
    let windowStart = null;
    let windowEnd = null;
    let targetAt = target[phase];
    if (phase === 'PRE') {
        windowEnd = target.EVENT_START - 1;
        eligible = subset.filter((item) => ms(item.acquired_at) < target.EVENT_START);
    }
    else if (phase === 'EVENT') {
        windowStart = target.EVENT_START;
        windowEnd = target.EVENT_END_PLUS_2;
        eligible = subset.filter((item) => {
            const acquired = ms(item.acquired_at);
            return acquired >= target.EVENT_START && acquired <= target.EVENT_END_PLUS_2;
        });
    }
    else {
        windowStart = target.EVENT_END_PLUS_2 + 1;
        eligible = subset.filter((item) => ms(item.acquired_at) > target.EVENT_END_PLUS_2);
    }
    eligible.sort((a, b) => {
        if (phase === 'EVENT') {
            const q = quality(b) - quality(a);
            if (q !== 0)
                return q;
        }
        return Math.abs(ms(a.acquired_at) - targetAt) - Math.abs(ms(b.acquired_at) - targetAt);
    });
    const selected = eligible[0] ?? null;
    return {
        phase,
        asset_kind: kind,
        selected_asset_id: selected?.asset_id ?? null,
        target_at: iso(targetAt),
        window_start_at: windowStart == null ? null : iso(windowStart),
        window_end_at: windowEnd == null ? null : iso(windowEnd),
        acquired_at: selected?.acquired_at ?? null,
        offset_days_from_target: selected ? offsetDays(ms(selected.acquired_at), targetAt) : null,
        eligible_count: eligible.length,
        selection_reason: selected
            ? phase === 'EVENT'
                ? 'EVENT 유효구간 내 후보 중 품질과 사건 중간시각 근접성을 우선하여 선택'
                : `${phase} 목표일과 가장 가까운 유효 후보를 선택`
            : '유효한 후보가 없어 선택하지 못함',
    };
}
function selectFloodPhaseAssets(event, candidates) {
    const results = [];
    for (const phase of ['PRE', 'EVENT', 'POST']) {
        for (const kind of ['SATELLITE', 'WATER_MASK'])
            results.push(selectOne(event, candidates, phase, kind));
    }
    return results;
}
