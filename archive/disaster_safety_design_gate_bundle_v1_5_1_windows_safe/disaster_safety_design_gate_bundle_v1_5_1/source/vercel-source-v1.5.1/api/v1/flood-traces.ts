import { envelope } from '../../server/http';
import { seed } from '../../server/seeds';
export function GET(request:Request){const admin=new URL(request.url).searchParams.get('admin_code');const collection={...seed.floodTraces,features:(seed.floodTraces.features as Array<any>).filter(f=>!admin||f.properties?.admin_code===admin)};return envelope(collection,{provider:'StaticSeedFloodTraceProvider',dataStatus:'mock',warnings:['POC 임의 Seed이며 실제 침수흔적도 또는 피해예측 결과가 아닙니다.']});}
