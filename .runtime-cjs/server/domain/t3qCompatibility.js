"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNE_TO_T3Q_TYPE = void 0;
exports.toT3qEventId = toT3qEventId;
exports.taxonomyPrefixMatch = taxonomyPrefixMatch;
exports.UNE_TO_T3Q_TYPE = {
    HEAVY_RAIN: { disasterType: 'TYPH', taxonomyCodes: ['T10107'] },
    TYPHOON: { disasterType: 'TYPH', taxonomyCodes: ['T10105'] },
    FLOOD: { disasterType: 'FLOOD', taxonomyCodes: ['T10206'] },
    INUNDATION: { disasterType: 'FLOOD', taxonomyCodes: ['T10106'] },
    LANDSLIDE: { disasterType: 'SLOPE', taxonomyCodes: ['T10401'] },
};
function toT3qEventId(input) {
    const compactDate = input.date.replace(/[^0-9]/g, '').slice(0, 8);
    const mapping = exports.UNE_TO_T3Q_TYPE[input.uneEventCode];
    if (!mapping)
        throw new Error(`Unsupported UNE event code: ${input.uneEventCode}`);
    if (!/^\d{8}$/.test(compactDate))
        throw new Error('date must resolve to YYYYMMDD');
    if (!/^\d{5}$/.test(input.adminCode))
        throw new Error('adminCode must be 5 digits');
    if (!Number.isInteger(input.sequence) || input.sequence < 1 || input.sequence > 999)
        throw new Error('sequence must be 1..999');
    return `EVT::${compactDate}-${mapping.disasterType}-${input.adminCode}-${String(input.sequence).padStart(3, '0')}`;
}
function taxonomyPrefixMatch(selected, candidate) {
    return candidate === selected || candidate.startsWith(selected);
}
