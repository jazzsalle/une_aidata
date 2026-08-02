import { badRequest, envelope } from '../../../http.js';
import { seed } from '../../../seeds.js';
const DATASETS:Record<string,unknown>={
  'L-FLOOD-RISK-AREA':seed.mockFloodRiskAreas,
  'L-DANGEROUS-RESERVOIR':seed.mockDangerousReservoirs,
  'L-STORM-FLOOD-IMPROVEMENT':seed.mockStormFloodImprovementDistricts,
};
export async function GET(request:Request){const layerId=new URL(request.url).searchParams.get('layer_id');if(!layerId||!DATASETS[layerId])return badRequest('지원하는 layer_id가 필요합니다.');return envelope(DATASETS[layerId],{provider:'MockSpatialProvider',dataStatus:'mock',warnings:['형상·속성은 시연용 가상값입니다.']});}
