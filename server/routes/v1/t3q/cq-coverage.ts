import { envelope } from '../../../http.js';
import { getT3qCqCoverage } from '../../../domain/t3qReadiness.js';
export function GET(request:Request){const url=new URL(request.url);const adminCode=url.searchParams.get('admin_code');return envelope(getT3qCqCoverage(adminCode),{provider:'T3qCqCoverageProvider',dataStatus:'provisional'});}
