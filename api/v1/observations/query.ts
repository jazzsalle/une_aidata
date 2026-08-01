import { badRequest, body, envelope } from '../../../server/http';
import { fetchPublicObservations } from '../../../server/providers/publicObservation';
import { seed } from '../../../server/seeds';
export async function POST(request: Request) {
  try {
    const input=await body<{admin_code:string;reference_time?:string}>(request); if(!input.admin_code) return badRequest('admin_code는 필수입니다.');
    const live=await fetchPublicObservations(input.admin_code, input.reference_time);
    if(live.observations.length) return envelope(live.observations,{provider:'PublicObservationProvider',dataStatus:'actual',warnings:live.warnings});
    const scenario=(seed.currentSituations.situations as Array<any>).find((item)=>item.admin_code===input.admin_code)?.observations ?? [];
    return envelope(scenario,{provider:'ScenarioObservationProvider',dataStatus:'scenario',fallbackUsed:true,warnings:live.warnings});
  } catch(error) { return badRequest(error instanceof Error?error.message:'관측조회 실패'); }
}
