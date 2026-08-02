import { envelope } from '../http';
export function GET() { return envelope({ status:'ok', service:'UNE Disaster Safety POC Vercel API', version:'1.5.1' }, { provider:'VercelNodeFunction', dataStatus:'actual' }); }
