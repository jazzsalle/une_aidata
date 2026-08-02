import { envelope } from '../../../http.js';
import { seed } from '../../../seeds.js';
export async function GET(){return envelope(seed.t3qMockSearchScenarios,{provider:'MockSearchScenarioProvider',dataStatus:'mock',warnings:['CQ 5문 화면·검색 흐름 검증용 시나리오입니다.']});}
