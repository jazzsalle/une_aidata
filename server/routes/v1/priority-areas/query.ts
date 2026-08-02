import { badRequest, body, envelope } from '../../../http.js';
import type { CurrentSituation } from '../../../contracts.js';
import { calculatePriorityAreas } from '../../../domain/priorityAreas.js';
import { findSeedSituation } from '../../../domain/situations.js';
export async function POST(request: Request) {
  try {
    const input=await body<{situation?:CurrentSituation;situation_id?:string}>(request);
    const situation=input.situation ?? (input.situation_id?findSeedSituation(input.situation_id):undefined);
    if(!situation) return badRequest('situation 또는 유효한 situation_id가 필요합니다.');
    return envelope(calculatePriorityAreas(situation),{provider:'PriorityAreaRuleService',dataStatus:'derived',warnings:['공식 위험도·피해예측이 아닌 현재조건 기반 POC 상대순위입니다.']});
  } catch(error) { return badRequest(error instanceof Error?error.message:'우선 확인지역 산정 실패'); }
}
