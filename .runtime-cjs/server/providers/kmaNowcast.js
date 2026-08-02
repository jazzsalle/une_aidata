"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kmaGrid = kmaGrid;
exports.kmaConfigured = kmaConfigured;
exports.fetchKmaNowcast = fetchKmaNowcast;
const env_js_1 = require("../env.js");
const GRID_BY_ADMIN = {
    '41430': { adminCode: '41430', adminName: '경기도 의왕시', nx: 60, ny: 122 },
    '47190': { adminCode: '47190', adminName: '경상북도 구미시', nx: 84, ny: 97 },
    '45190': { adminCode: '45190', adminName: '전북특별자치도 남원시', nx: 68, ny: 81 },
};
const CATEGORY = {
    RN1: { type: 'RAINFALL_1H', name: '1시간 강수량', unit: 'mm' },
    T1H: { type: 'TEMPERATURE', name: '기온', unit: '℃' },
    REH: { type: 'HUMIDITY', name: '습도', unit: '%' },
    WSD: { type: 'WIND_SPEED', name: '풍속', unit: 'm/s' },
    VEC: { type: 'WIND_DIRECTION', name: '풍향', unit: 'deg' },
    PTY: { type: 'PRECIPITATION_TYPE', name: '강수형태', unit: null },
    UUU: { type: 'WIND_EAST_WEST', name: '동서바람성분', unit: 'm/s' },
    VVV: { type: 'WIND_NORTH_SOUTH', name: '남북바람성분', unit: 'm/s' },
};
function kstParts(referenceTime = new Date()) {
    const lag = Number((0, env_js_1.env)('KMA_REQUEST_LAG_MINUTES') ?? '45');
    const safeLag = Number.isFinite(lag) ? Math.max(10, lag) : 45;
    const kstMs = referenceTime.getTime() + 9 * 60 * 60 * 1000 - safeLag * 60 * 1000;
    const kst = new Date(kstMs);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    const h = String(kst.getUTCHours()).padStart(2, '0');
    return { baseDate: `${y}${m}${d}`, baseTime: `${h}00`, observedAt: `${y}-${m}-${d}T${h}:00:00+09:00` };
}
function rows(payload) {
    if (!payload || typeof payload !== 'object')
        return [];
    const root = payload;
    const response = root.response;
    const body = response?.body;
    const items = body?.items;
    const item = items?.item;
    return Array.isArray(item) ? item : [];
}
function header(payload) {
    if (!payload || typeof payload !== 'object')
        return {};
    const response = payload.response;
    const value = response?.header;
    return { resultCode: typeof value?.resultCode === 'string' ? value.resultCode : undefined, resultMsg: typeof value?.resultMsg === 'string' ? value.resultMsg : undefined };
}
function kmaGrid(adminCode) { return GRID_BY_ADMIN[adminCode]; }
function kmaConfigured() { return Boolean((0, env_js_1.env)('DATA_GO_KR_SERVICE_KEY')); }
async function fetchKmaNowcast(adminCode, referenceTime = new Date()) {
    const key = (0, env_js_1.env)('DATA_GO_KR_SERVICE_KEY');
    if (!key)
        return { observations: [], warning: 'DATA_GO_KR_SERVICE_KEY 미설정' };
    const grid = kmaGrid(adminCode);
    if (!grid)
        return { observations: [], warning: `기상청 격자좌표 미정의: ${adminCode}` };
    const { baseDate, baseTime, observedAt } = kstParts(referenceTime);
    const endpoint = (0, env_js_1.env)('KMA_ULTRA_SRT_NCST_URL') ?? 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';
    const url = new URL(endpoint);
    url.searchParams.set('serviceKey', key);
    url.searchParams.set('pageNo', '1');
    url.searchParams.set('numOfRows', '1000');
    url.searchParams.set('dataType', 'JSON');
    url.searchParams.set('base_date', baseDate);
    url.searchParams.set('base_time', baseTime);
    url.searchParams.set('nx', String(grid.nx));
    url.searchParams.set('ny', String(grid.ny));
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!response.ok)
        throw new Error(`기상청 초단기실황 HTTP ${response.status}`);
    const payload = await response.json();
    const h = header(payload);
    if (h.resultCode && h.resultCode !== '00')
        throw new Error(`기상청 API ${h.resultCode}: ${h.resultMsg ?? 'unknown'}`);
    const observations = rows(payload).flatMap((item, index) => {
        const category = typeof item.category === 'string' ? CATEGORY[item.category] : undefined;
        if (!category)
            return [];
        const raw = item.obsrValue;
        const numeric = typeof raw === 'number' ? raw : Number(raw);
        const value = Number.isFinite(numeric) ? numeric : raw ?? null;
        return [{
                observation_id: `KMA-${adminCode}-${item.category ?? index}-${baseDate}${baseTime}`,
                type: category.type,
                station_id: `KMA-GRID-${grid.nx}-${grid.ny}`,
                name: category.name,
                value,
                unit: category.unit,
                observed_at: observedAt,
                source_provider: 'KMA_ULTRA_SRT_NCST',
                value_status: 'actual',
                official_data: true,
            }];
    });
    return { observations, request: { admin_code: adminCode, nx: grid.nx, ny: grid.ny, base_date: baseDate, base_time: baseTime } };
}
