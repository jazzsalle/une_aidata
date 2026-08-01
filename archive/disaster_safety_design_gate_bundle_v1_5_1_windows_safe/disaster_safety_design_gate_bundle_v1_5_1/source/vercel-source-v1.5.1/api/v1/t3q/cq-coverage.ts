import { envelope } from '../../../server/http';
import { getT3qCqCoverage } from '../../../server/domain/t3qReadiness';
export function GET(request:Request){const url=new URL(request.url);const adminCode=url.searchParams.get('admin_code');return envelope(getT3qCqCoverage(adminCode),{provider:'T3qCqCoverageProvider',dataStatus:'provisional'});}
