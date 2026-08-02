import { env } from '../env.js';
import type { EvidenceItem } from '../contracts.js';

export interface UneRagResult extends EvidenceItem { content: string; rag_score?: number; metadata?: Record<string, unknown>; }
export interface UneRagSearchInput { query: string; topK?: number; filters?: Record<string, unknown>; }

type Json = Record<string, unknown>;
let cachedToken: { value: string; expiresAt: number } | null = null;

function join(base: string, path: string): string { return `${base.replace(/\/$/,'')}/${path.replace(/^\//,'')}`; }
function timeoutMs(): number { const n=Number(env('UNE_RAG_TIMEOUT_MS') ?? '15000'); return Number.isFinite(n) ? n : 15000; }
function authMode(): string { return (env('UNE_RAG_AUTH_MODE') ?? 'login').toLowerCase(); }
function tokenFromJson(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row=value as Json; const candidates=[row.access_token,row.token,row.jwt,(row.data as Json|undefined)?.access_token,(row.data as Json|undefined)?.token];
  return candidates.find((v):v is string=>typeof v==='string'&&v.length>8);
}
async function login(baseUrl: string): Promise<string | undefined> {
  if (authMode()==='apikey') return env('UNE_RAG_API_KEY');
  if (authMode()==='basic') return undefined;
  if (cachedToken && cachedToken.expiresAt>Date.now()+30_000) return cachedToken.value;
  const username=env('UNE_RAG_USERNAME'), password=env('UNE_RAG_PASSWORD'), path=env('UNE_RAG_LOGIN_PATH');
  if (!username || !password || !path) return undefined;
  const accountField=env('UNE_RAG_LOGIN_ACCOUNT_FIELD') ?? 'username';
  const response=await fetch(join(baseUrl,path),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({[accountField]:username,password}),signal:AbortSignal.timeout(timeoutMs())});
  if(!response.ok) throw new Error(`UNE RAG 로그인 실패: HTTP ${response.status}`);
  const payload=await response.json() as unknown; const token=tokenFromJson(payload);
  if(!token) throw new Error('UNE RAG 로그인 응답에서 token을 찾지 못했습니다.');
  cachedToken={value:token,expiresAt:Date.now()+45*60*1000}; return token;
}
function valueAtPath(payload: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split('.').filter(Boolean).reduce<unknown>((current, segment) => current && typeof current === 'object' ? (current as Json)[segment] : undefined, payload);
}
function arrayFromPayload(payload: unknown): unknown[] {
  const configured = valueAtPath(payload, env('UNE_RAG_RESPONSE_ARRAY_PATH'));
  if (Array.isArray(configured)) return configured;
  if(Array.isArray(payload)) return payload;
  if(!payload||typeof payload!=='object') return [];
  const row=payload as Json;
  for(const key of ['results','items','documents','hits','chunks','data']){
    const v=row[key]; if(Array.isArray(v)) return v;
    if(v&&typeof v==='object') { const nested=arrayFromPayload(v); if(nested.length) return nested; }
  }
  return [];
}
function text(row: Json, keys: string[]): string | undefined { for(const k of keys){const v=row[k];if(typeof v==='string'&&v.trim())return v;} }
function number(row: Json, keys: string[]): number | undefined { for(const k of keys){const v=row[k];if(typeof v==='number'&&Number.isFinite(v))return v;if(typeof v==='string'&&!Number.isNaN(Number(v)))return Number(v);} }
function normalize(item: unknown,index:number): UneRagResult {
  const row=(item&&typeof item==='object'?item:{}) as Json; const metadata=(row.metadata&&typeof row.metadata==='object'?row.metadata:{}) as Json;
  const content=text(row,['content','text','chunk','passage','answer','body']) ?? text(metadata,['content','text']) ?? '';
  const score=number(row,['score','similarity','distance','rag_score','relevance_score']) ?? number(metadata,['score','similarity']);
  const page=number(row,['page','page_no','page_number']) ?? number(metadata,['page','page_no','page_number']);
  const passage=text(row,['passage_id','chunk_id','id','doc_id']) ?? text(metadata,['passage_id','chunk_id','doc_id']);
  const title=text(row,['title','document_title','source_title','filename']) ?? text(metadata,['title','document_title','source_title','filename']) ?? `UNE RAG 검색결과 ${index+1}`;
  return {evidence_id:`UNE-RAG-${passage??index+1}`,source_type:'UNE_RAG_PASSAGE',title,content,excerpt:content.slice(0,360),page,passage_id:passage,score,rag_score:score,data_status:'actual',metadata};
}
export function uneRagConfigured(): boolean { return Boolean(env('UNE_RAG_BASE_URL')&&(env('UNE_RAG_API_KEY')||(env('UNE_RAG_USERNAME')&&env('UNE_RAG_PASSWORD')))); }
export async function searchUneRag(input: string|UneRagSearchInput): Promise<{ results: UneRagResult[]; warning?: string }> {
  const request=typeof input==='string'?{query:input}:input; const baseUrl=env('UNE_RAG_BASE_URL');
  if(!baseUrl) return {results:[],warning:'UNE_RAG_BASE_URL 미설정으로 Seed 근거를 사용합니다.'};
  const path=env('UNE_RAG_SEARCH_PATH'); if(!path) return {results:[],warning:'UNE_RAG_SEARCH_PATH 미설정으로 Seed 근거를 사용합니다.'};
  try{
    const mode=authMode(); const token=await login(baseUrl); const headers:Record<string,string>={'content-type':'application/json','accept':'application/json'};
    if(mode==='basic') headers.authorization=`Basic ${btoa(`${env('UNE_RAG_USERNAME')??''}:${env('UNE_RAG_PASSWORD')??''}`)}`;
    else if(token) headers.authorization=mode==='apikey'?`Bearer ${token}`:`Bearer ${token}`;
    const topK=request.topK??Number(env('UNE_RAG_DEFAULT_TOP_K')??'5');
    const body:Json={};
    body[env('UNE_RAG_QUERY_FIELD') ?? 'query']=request.query;
    body[env('UNE_RAG_TOPK_FIELD') ?? 'top_k']=topK;
    body[env('UNE_RAG_FILTERS_FIELD') ?? 'filters']=request.filters??{};
    const dataset=env('UNE_RAG_DEFAULT_DATASET'); if(dataset) body[env('UNE_RAG_DATASET_FIELD') ?? 'dataset']=dataset;
    const response=await fetch(join(baseUrl,path),{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs())});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload=await response.json() as unknown; const rows=arrayFromPayload(payload).map(normalize).filter(i=>i.content||i.title);
    return {results:rows,warning:rows.length?undefined:'UNE RAG 응답은 성공했으나 검색결과 배열을 찾지 못했습니다.'};
  }catch(error){return {results:[],warning:`UNE RAG 호출 실패: ${error instanceof Error?error.message:'unknown error'}`};}
}

// Fixture 검증 전용 매퍼: 실제 fetch 없이 저장된 payload를 기존 arrayFromPayload/normalize 경로로 통과시킨다.
// fixture 유래 결과는 실검색 결과로 보이면 안 되므로 data_status='mock'을 강제하고 provider를 metadata에 명시한다(v0.7 규칙).
export function mapUneRagFixturePayload(payload: unknown): { results: UneRagResult[]; warning?: string } {
  const rows = arrayFromPayload(payload).map(normalize).filter((item) => item.content || item.title);
  const results = rows.map((item): UneRagResult => ({
    ...item,
    data_status: 'mock',
    metadata: { ...(item.metadata ?? {}), fixture_validation: true, provider: 'UNE_RAG_FixtureValidation' },
  }));
  return { results, warning: results.length ? undefined : 'UNE RAG 응답은 성공했으나 검색결과 배열을 찾지 못했습니다.' };
}

// Timeout·오류 payload 검증용: 실경로 catch 분기와 동일한 Fallback 형태를 산출한다.
export function mapUneRagFixtureError(error: unknown): { results: UneRagResult[]; warning: string } {
  return { results: [], warning: `UNE RAG 호출 실패: ${error instanceof Error ? error.message : 'unknown error'}` };
}


export interface UneRagOpenApiProbe {
  reachable: boolean;
  openapi_path: string;
  title?: string;
  version?: string;
  candidate_paths: Array<{ path: string; methods: string[] }>;
  warning?: string;
}
export async function probeUneRagOpenApi(): Promise<UneRagOpenApiProbe> {
  const baseUrl=env('UNE_RAG_BASE_URL');
  const openapiPath=env('UNE_RAG_OPENAPI_PATH') ?? '/openapi.json';
  if(!baseUrl) return {reachable:false,openapi_path:openapiPath,candidate_paths:[],warning:'UNE_RAG_BASE_URL 미설정'};
  try {
    const response=await fetch(join(baseUrl,openapiPath),{headers:{accept:'application/json'},signal:AbortSignal.timeout(Math.min(timeoutMs(),8000))});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload=await response.json() as Json;
    const info=(payload.info&&typeof payload.info==='object'?payload.info:{}) as Json;
    const paths=(payload.paths&&typeof payload.paths==='object'?payload.paths:{}) as Json;
    const candidatePaths=Object.entries(paths).map(([path,value])=>({path,methods:value&&typeof value==='object'?Object.keys(value as Json).filter(method=>['get','post','put','patch','delete'].includes(method.toLowerCase())):[]})).filter(item=>item.methods.length);
    return {reachable:true,openapi_path:openapiPath,title:typeof info.title==='string'?info.title:undefined,version:typeof info.version==='string'?info.version:undefined,candidate_paths:candidatePaths};
  } catch(error) {
    return {reachable:false,openapi_path:openapiPath,candidate_paths:[],warning:`UNE RAG OpenAPI 접근 실패: ${error instanceof Error?error.message:'unknown error'}`};
  }
}
