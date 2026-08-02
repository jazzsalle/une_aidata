import { badRequest, envelope } from '../../../http.js';
import { fetchKmaNowcast, kmaGrid } from '../../../providers/kmaNowcast.js';
export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const adminCode = url.searchParams.get('admin_code');
    if (!adminCode) return badRequest('admin_code는 필수입니다.');
    const result = await fetchKmaNowcast(adminCode);
    return envelope({ observations: result.observations, grid: kmaGrid(adminCode), request: result.request }, { provider: 'KMA_ULTRA_SRT_NCST', dataStatus: result.observations.length ? 'actual' : 'provisional', warnings: result.warning ? [result.warning] : [] });
  } catch (error) { return badRequest(error instanceof Error ? error.message : '기상청 실황 조회 실패'); }
}
