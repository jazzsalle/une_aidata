import { envelope } from '../../http';
import { seed } from '../../seeds';
export function GET(request: Request) {
  const url=new URL(request.url); const admin=url.searchParams.get('admin_code');
  const rows=(seed.procedures.procedures as Array<any>).filter((item)=>!admin || item.target_admin_codes?.includes(admin));
  return envelope(rows,{provider:'ProvisionalManualProvider',dataStatus:'provisional',warnings:['부산 북구청 풍수해 매뉴얼 참고 잠정절차이며 대상지 공식절차가 아닙니다.']});
}
