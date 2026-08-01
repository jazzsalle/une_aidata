import { badRequest, body, envelope } from '../../../server/http';
import type { CurrentSituation } from '../../../server/contracts';
import { searchSimilarEvents } from '../../../server/domain/similarEvents';
import { findSeedSituation } from '../../../server/domain/situations';
export async function POST(request:Request){try{const input=await body<{situation?:CurrentSituation;situation_id?:string;top_k?:number}>(request);const situation=input.situation??(input.situation_id?findSeedSituation(input.situation_id):undefined);if(!situation)return badRequest('situation 또는 유효한 situation_id가 필요합니다.');const result=await searchSimilarEvents(situation,input.top_k??5);return envelope(result.events,{provider:'SimilarEventCompositeProvider',dataStatus:'derived',warnings:['과거 피해·복구 참고 Seed이며 현재 피해예측 결과가 아닙니다.',...result.warnings]});}catch(error){return badRequest(error instanceof Error?error.message:'유사사례 검색 실패');}}
