import { badRequest, body, envelope } from '../../../http.js';
import { seed } from '../../../seeds.js';
import { searchUneRag } from '../../../providers/uneRag.js';
export async function POST(request: Request){
  try{ const input=await body<{admin_code?:string;query?:string}>(request); const structured=(seed.districts.districts as Array<any>).filter((item)=>!input.admin_code||item.admin_code===input.admin_code);
    const rag=await searchUneRag(input.query??''); return envelope({structured,rag_results:rag.results},{provider:'RiskKnowledgeCompositeProvider',dataStatus:'provisional',warnings:rag.warning?[rag.warning]:[]});
  }catch(error){return badRequest(error instanceof Error?error.message:'위험지식 검색 실패');}
}
