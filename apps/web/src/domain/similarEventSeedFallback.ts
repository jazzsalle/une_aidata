// server/domain/similarEvents.ts compareResponses의 seed 전용 최소 미러링 — 유사도 점수 산정은 복제하지 않음.
// FORCE_SEED(로컬 Seed Fallback) 전용 순수함수 모듈이며 server/providers를 참조하지 않는다.
// 과거 참고정보 프레이밍만 사용: 피해예측·공식 위험도·자동 조치결정 표현을 생성하지 않는다.
import type{CurrentSituation,EvidenceItem,ResponseComparisonItem}from'../types/contracts';

type SeedRecord=Record<string,unknown>;
function asRecords(value:unknown):Array<Record<string,unknown>>{return Array.isArray(value)?value.filter(v=>v&&typeof v==='object') as Array<Record<string,unknown>>:[];}
function strings(value:unknown):string[]{return Array.isArray(value)?value.map(String).filter(Boolean):[];}
function tokens(values:unknown):Set<string>{const raw=Array.isArray(values)?values.map(String).join(' '):JSON.stringify(values??'');return new Set(raw.toLowerCase().split(/[\s,·/()\[\]{}:'"-]+/).filter(v=>v.length>=2));}
function tokenSimilarity(a:unknown,b:unknown):number|null{const ta=tokens(a),tb=tokens(b);if(!ta.size||!tb.size)return null;let n=0;for(const v of ta)if(tb.has(v))n++;return n/(ta.size+tb.size-n);}

/** Seed record의 evidence를 EvidenceItem으로 정규화한다(passage_id 보존). server/domain/similarEvents.ts seedEvidence 미러링. */
export function seedRecordEvidence(record:SeedRecord):EvidenceItem[]{
 return asRecords(record.evidence).map((e,i)=>({
  evidence_id:String(e.evidence_id??`EVD-${i+1}`),
  source_type:String(e.source_type??'SEED'),
  title:String(e.title??'근거자료'),
  excerpt:typeof e.excerpt==='string'?e.excerpt:null,
  page:typeof e.page==='number'?e.page:null,
  passage_id:typeof e.passage_id==='string'?e.passage_id:null,
  data_status:(e.data_status??record.data_status??'provisional') as EvidenceItem['data_status']
 }));
}

/**
 * 현재상황 user_input.required_checks × Seed record response를 매칭해 대응비교 목록을 만든다.
 * server/domain/similarEvents.ts compareResponses의 seed 전용 최소 미러링이며,
 * 유사도 점수·가중치 산정은 복제하지 않는다. 결과는 과거 조치 참고정보이고 담당자 확인이 필요하다.
 */
export function buildSeedResponseComparison(situation:CurrentSituation,record:SeedRecord,evidenceIds:string[]):ResponseComparisonItem[]{
 const checks=strings(situation.user_input?.['required_checks']);
 const past=asRecords(record.response);
 return(checks.length?checks:['현재 확인사항 미입력']).map((check,i)=>{
  const action=past[i]??past.find(p=>(tokenSimilarity(check,p.action)??0)>0)??null;
  return{
   action_category:`CHECK-${i+1}`,
   current_required_check:check,
   past_event_action:action?String(action.action??''):null,
   responsible_agency:action&&typeof action.responsible_agency==='string'?action.responsible_agency:null,
   past_outcome:action&&typeof action.status==='string'?action.status:null,
   difference:action?'과거 조치와 현재 확인사항을 비교하여 담당자가 적용 여부를 판단':'대응조치 근거 미확보 - 현재 매뉴얼·현장 확인 필요',
   evidence_ids:evidenceIds,
   operator_confirmation_required:true
  };
 });
}
