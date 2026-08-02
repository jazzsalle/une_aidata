import { envelope } from '../../../http';
import { seed } from '../../../seeds';
import { t3qConfigured, t3qMcpConfigured, T3Q_PENDING_MESSAGE } from '../../../providers/t3qMetadata';
export function GET(){
  return envelope({alignment:seed.t3qAlignment,integration:{api_configured:t3qConfigured(),mcp_configured:t3qMcpConfigured(),message:T3Q_PENDING_MESSAGE}},
    {provider:'T3qAlignmentSeedProvider',dataStatus:'provisional'});
}
