"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../http");
const satelliteEvidenceSets_1 = require("../../providers/satelliteEvidenceSets");
const provider = new satelliteEvidenceSets_1.StaticSeedSatelliteEvidenceSetProvider();
async function GET(request) {
    const url = new URL(request.url);
    const id = url.searchParams.get('evidence_set_id');
    const data = id ? await provider.get(id) : await provider.list();
    if (id && !data)
        return (0, http_1.envelope)(null, { provider: 'StaticSeedSatelliteEvidenceSetProvider', dataStatus: 'mock', warnings: ['요청한 증거세트를 찾지 못했습니다.'] });
    return (0, http_1.envelope)(data, { provider: 'StaticSeedSatelliteEvidenceSetProvider', dataStatus: 'mock', warnings: ['현재 증거세트는 대상지역 외 POC Seed이며 쓰리디랩스 정식자료로 교체 예정입니다.'] });
}
