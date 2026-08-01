import { badRequest, body, envelope } from '../../../server/http';
import { seed } from '../../../server/seeds';
import { selectFloodPhaseAssets, type FloodEventWindow, type SatelliteCandidate } from '../../../server/domain/satellitePhaseSelection';

export async function POST(request: Request) {
  try {
    const input = await body<{ event?: FloodEventWindow; candidates?: SatelliteCandidate[] }>(request);
    const basis = (seed.satellites.phase_selection_policy as any)?.event_time_basis;
    const event: FloodEventWindow = input.event ?? {
      event_id: 'POC-FLOOD-IMAGE-SAMPLE-001',
      event_start_at: String(basis?.event_start_at),
      event_end_at: String(basis?.event_end_at),
    };
    const candidates = input.candidates ?? (seed.satellites.assets as SatelliteCandidate[]).filter((item) => item.event_id === event.event_id);
    const results = selectFloodPhaseAssets(event, candidates);
    return envelope({ event, results }, {
      provider: 'FloodImageryPhaseSelectionEngine',
      dataStatus: 'derived',
      warnings: ['선정 결과는 촬영 후보 선택을 위한 메타데이터이며 피해예측 결과가 아닙니다.'],
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : '위성영상 단계선정 실패');
  }
}
