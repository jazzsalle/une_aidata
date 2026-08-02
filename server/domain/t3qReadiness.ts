import type { T3qCqCoverage, T3qIntegrationReadiness } from '../contracts.js';
import { seed } from '../seeds.js';

export function getT3qIntegrationReadiness():T3qIntegrationReadiness{
  return seed.t3qReadiness as unknown as T3qIntegrationReadiness;
}
export function getT3qCqCoverage(adminCode?:string|null):T3qCqCoverage{
  const base=seed.t3qCqCoverage as unknown as T3qCqCoverage;
  if(!adminCode) return base;
  return {...base,coverage_basis:`${base.coverage_basis??''} · 대상 행정코드 ${adminCode}`};
}
export function readinessCounts(readiness:T3qIntegrationReadiness){
  const counts:Record<string,number>={};
  readiness.dimensions.forEach(row=>{counts[row.state]=(counts[row.state]??0)+1;});
  return counts;
}
