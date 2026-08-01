import { envelope } from '../../../server/http';
import { seed } from '../../../server/seeds';
export async function GET(){return envelope(seed.mockContractCatalog,{provider:'MockContractCatalogProvider',dataStatus:'mock',warnings:['실제 T3Q 데이터가 아닌 Mock 계약 카탈로그입니다.']});}
