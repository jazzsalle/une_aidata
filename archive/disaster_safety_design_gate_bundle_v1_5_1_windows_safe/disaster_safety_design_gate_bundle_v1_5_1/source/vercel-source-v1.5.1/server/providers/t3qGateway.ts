import type { T3qEventMaster, T3qPassage, T3qSearchPreview, T3qSearchRequest } from '../contracts';
import { seed } from '../seeds';
import { taxonomyPrefixMatch } from '../domain/t3qCompatibility';

function normalize(text:string|undefined|null){return (text??'').toLocaleLowerCase('ko-KR').replace(/[^0-9a-zA-Z가-힣]+/g,' ').replace(/\s+/g,' ').trim();}
const QUERY_STOPWORDS=new Set(['관내','어떤','어디','어디인가','무엇','해야','하는가','확인']);
function queryTokens(query:string){
  return normalize(query).split(' ').filter(Boolean).map(token=>token
    .replace(/(어디인가|해야하는가|하는가|인가)$/,'')
    .replace(/(에서|으로|에게|부터|까지|보다|처럼)$/,'')
    .replace(/(은|는|이|가|을|를|의)$/,'')
  ).filter(token=>token.length>=2&&!QUERY_STOPWORDS.has(token));
}
function containsQuery(passage:T3qPassage,query:string){
  const tokens=queryTokens(query);
  if(!tokens.length)return true;
  const hay=normalize(`${passage.title??''} ${passage.content??''} ${passage.schema_type}`);
  return tokens.some(token=>hay.includes(token));
}
function taxonomyMatches(selected:string[],candidates:string[]){return selected.length===0||selected.some(code=>candidates.some(candidate=>taxonomyPrefixMatch(code,candidate)||taxonomyPrefixMatch(candidate,code)));}

export function t3qSearchConfigured(){return false;}
export function t3qRuntimeMode(){return 'mock_only' as const;}

export async function searchT3qPreview(request:T3qSearchRequest):Promise<T3qSearchPreview>{
  const allEvents=(seed.t3qMockEvents as unknown as {events:T3qEventMaster[]}).events;
  const allPassages=(seed.t3qMockPassages as unknown as {passages:T3qPassage[]}).passages;
  let structural=allPassages.filter(row=>(!request.admin_code||row.admin_code===request.admin_code)&&taxonomyMatches(request.taxonomy_codes,row.taxonomy_codes));
  if(request.schema_types?.length) structural=structural.filter(row=>request.schema_types!.includes(row.schema_type));
  const lexical=structural.filter(row=>containsQuery(row,request.query));
  const usedStructuralFallback=lexical.length===0&&structural.length>0;
  const passages=usedStructuralFallback?structural:lexical;
  const eventIds=new Set(passages.map(row=>row.ref_disaster_event_id).filter(Boolean));
  let events=allEvents.filter(row=>(!request.admin_code||row.region_code_5===request.admin_code)&&taxonomyMatches(request.taxonomy_codes,row.taxonomy_codes));
  if(eventIds.size) events=events.filter(row=>eventIds.has(row.event_id));
  const warnings=['현재 단계는 T3Q 외부 기술연계 없이 UNE Mock 계약으로만 동작합니다.','결과는 실제 T3Q 데이터·공식 위험정보·피해예측이 아닙니다.'];
  if(usedStructuralFallback)warnings.push('질의어 직접일치 결과가 없어 행정구역·T코드·SchemaType 구조필터 결과를 사용했습니다.');
  if(!events.length&&!passages.length) warnings.push('조건에 맞는 Mock 데이터가 없습니다. 데이터 미확보 상태를 정상 결과로 처리합니다.');
  return{request,mode:'mock_contract',events:events.slice(0,request.top_k),passages:passages.slice(0,request.top_k),warnings};
}
