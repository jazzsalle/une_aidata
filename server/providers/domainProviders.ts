import { env } from '../env.js';
import { seed } from '../seeds.js';
import type { CurrentSituation, SimilarEvent, SimilarityWeightProfile } from '../contracts.js';

export type ProviderDomain='event'|'risk'|'observation'|'spatial';
export type ProviderMode='mock'|'t3q'|'openapi'|'local';
export interface ProviderSelection { domain:ProviderDomain; env_key:string; selected:ProviderMode; fallback:ProviderMode; configured:boolean; message:string; }
export interface EventProvider { id:string; mode:ProviderMode; listRecords():Array<Record<string,unknown>>; }
class MockEventProvider implements EventProvider { id='mock_event_provider'; mode:ProviderMode='mock'; listRecords(){ return seed.damageRecovery.records as Array<Record<string,unknown>>; } }
class T3qEventProviderStub implements EventProvider { id='t3q_event_provider_stub'; mode:ProviderMode='t3q'; listRecords():Array<Record<string,unknown>>{ throw new Error('T3Q Event API 미연계: Mock Provider로 전환해야 합니다.'); } }
export function providerMode(domain:ProviderDomain):ProviderMode {
 const key=`${domain.toUpperCase()}_PROVIDER`; const v=(env(key)??'mock').toLowerCase(); return (['mock','t3q','openapi','local'] as string[]).includes(v)?v as ProviderMode:'mock';
}
export function eventProvider():EventProvider { return providerMode('event')==='t3q'?new T3qEventProviderStub():new MockEventProvider(); }
export function providerSelections():ProviderSelection[]{
 const rows=seed.providerContracts.providers as Array<Record<string,unknown>>;
 return rows.map(row=>{const domain=String(row.domain) as ProviderDomain;const selected=providerMode(domain);return{domain,env_key:String(row.env_key),selected,fallback:String(row.fallback).includes('mock')?'mock':'local',configured:selected==='mock'||selected==='local',message:selected==='mock'?'Mock/Seed 계약으로 동작':`${selected} Adapter Stub - 외부연계 전`};});
}
export function similarityProfiles():SimilarityWeightProfile[]{return seed.similarityWeightProfiles.profiles as SimilarityWeightProfile[];}
export function selectSimilarityProfile(hazards:string[]):SimilarityWeightProfile {
 const profiles=similarityProfiles(); const taxonomy=new Set(hazards);
 return profiles.find(p=>p.hazard_codes.some(c=>taxonomy.has(c)||hazardAlias(hazards).has(c)))??profiles[0]!;
}
function hazardAlias(hazards:string[]):Set<string>{const out=new Set<string>();for(const h of hazards){if(h==='HEAVY_RAIN')out.add('T10107');if(h==='FLOOD')out.add('T10206');if(h==='INUNDATION')out.add('T10106');if(h==='TYPHOON')out.add('T10105');if(h==='LANDSLIDE')out.add('T10401');}return out;}
