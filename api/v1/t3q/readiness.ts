import { envelope } from '../../../server/http';
import { getT3qIntegrationReadiness, readinessCounts } from '../../../server/domain/t3qReadiness';
export function GET(){const readiness=getT3qIntegrationReadiness();return envelope({readiness,summary:readinessCounts(readiness)},{provider:'T3qReadinessProvider',dataStatus:'provisional'});}
