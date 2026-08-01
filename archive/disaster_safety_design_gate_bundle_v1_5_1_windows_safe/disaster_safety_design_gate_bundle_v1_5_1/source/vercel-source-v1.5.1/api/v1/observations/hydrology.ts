import { badRequest, envelope } from '../../../server/http';
import { fetchHrfcoHydrology, hydrologyStationStatus } from '../../../server/providers/hrfcoHydrology';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const adminCode = url.searchParams.get('admin_code');
    if (!adminCode) return badRequest('admin_code는 필수입니다.');
    const status = hydrologyStationStatus(adminCode);
    const result = await fetchHrfcoHydrology(adminCode);
    return envelope({ observations: result.observations, station: result.station ?? status.station }, {
      provider: 'HRFCO_STANDARD_HYDROLOGY_DB',
      dataStatus: result.observations.length ? 'actual' : 'provisional',
      warnings: result.warning ? [result.warning] : [],
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : '홍수통제소 수위·유량 조회 실패');
  }
}
