import { envelope } from '../../../http';
import { findSimilarEvent } from '../../../domain/similarEvents';
export function GET(request:Request){const eventId=new URL(request.url).searchParams.get('event_id');if(!eventId)return envelope(null,{status:400,errors:['event_id는 필수입니다.']});const event=findSimilarEvent(eventId);if(!event)return envelope(null,{status:404,errors:['유사사례를 찾지 못했습니다.']});return envelope(event,{provider:'StaticDamageRecoveryProvider',dataStatus:'mock',warnings:['현재 피해예측이 아닌 POC 참고 Seed입니다.']});}
