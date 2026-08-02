import { envelope } from '../../http';
import { StaticSeedSatelliteEvidenceSetProvider } from '../../providers/satelliteEvidenceSets';
const provider=new StaticSeedSatelliteEvidenceSetProvider();
export async function GET(request:Request){
  const url=new URL(request.url); const id=url.searchParams.get('evidence_set_id');
  const data=id?await provider.get(id):await provider.list();
  if(id&&!data) return envelope(null,{provider:'StaticSeedSatelliteEvidenceSetProvider',dataStatus:'mock',warnings:['요청한 증거세트를 찾지 못했습니다.']});
  return envelope(data,{provider:'StaticSeedSatelliteEvidenceSetProvider',dataStatus:'mock',warnings:['현재 증거세트는 대상지역 외 POC Seed이며 쓰리디랩스 정식자료로 교체 예정입니다.']});
}
