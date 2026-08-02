import { envelope } from '../../http';
import { seed } from '../../seeds';
export function GET(request: Request) {
  const url=new URL(request.url); const admin=url.searchParams.get('admin_code'); const area=url.searchParams.get('area_id');
  const rows=(seed.satellites.assets as Array<any>).filter((item)=>(!admin||item.admin_code===admin||item.shared_demo===true)&&(!area||item.area_id===area||item.shared_demo===true));
  return envelope(rows,{provider:'StaticSeedSatelliteProvider',dataStatus:'mock',warnings:['POC 예시영상이며 256×256 독립 타일로 표시합니다. 대상지역 외 표본 및 EVENT 생성자료는 쓰리디랩스 실제자료로 교체 예정입니다.']});
}
