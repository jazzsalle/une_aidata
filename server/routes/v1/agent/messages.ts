import { badRequest, body, envelope } from '../../../http.js';
import type { CurrentSituation } from '../../../contracts.js';
import { buildAgentResponse, normalizeAgentContext } from '../../../domain/agent.js';
import { findSeedSituation } from '../../../domain/situations.js';
export async function POST(request:Request){try{const input=await body<{situation?:CurrentSituation;situation_id?:string;message:string;context?:unknown}>(request);if(!input.message?.trim())return badRequest('message는 필수입니다.');const situation=input.situation??(input.situation_id?findSeedSituation(input.situation_id):undefined);if(!situation)return badRequest('situation이 필요합니다.');return envelope(await buildAgentResponse(situation,input.message.trim(),normalizeAgentContext(input.context)),{provider:'AgentToolRouterFunction',dataStatus:'provisional'});}catch(error){return badRequest(error instanceof Error?error.message:'Agent 처리 실패');}}
