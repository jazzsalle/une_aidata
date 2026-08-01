"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const http_1 = require("../../../server/http");
const seeds_1 = require("../../../server/seeds");
const satellitePhaseSelection_1 = require("../../../server/domain/satellitePhaseSelection");
async function POST(request) {
    try {
        const input = await (0, http_1.body)(request);
        const basis = seeds_1.seed.satellites.phase_selection_policy?.event_time_basis;
        const event = input.event ?? {
            event_id: 'POC-FLOOD-IMAGE-SAMPLE-001',
            event_start_at: String(basis?.event_start_at),
            event_end_at: String(basis?.event_end_at),
        };
        const candidates = input.candidates ?? seeds_1.seed.satellites.assets.filter((item) => item.event_id === event.event_id);
        const results = (0, satellitePhaseSelection_1.selectFloodPhaseAssets)(event, candidates);
        return (0, http_1.envelope)({ event, results }, {
            provider: 'FloodImageryPhaseSelectionEngine',
            dataStatus: 'derived',
            warnings: ['선정 결과는 촬영 후보 선택을 위한 메타데이터이며 피해예측 결과가 아닙니다.'],
        });
    }
    catch (error) {
        return (0, http_1.badRequest)(error instanceof Error ? error.message : '위성영상 단계선정 실패');
    }
}
