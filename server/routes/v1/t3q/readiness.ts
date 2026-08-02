import { envelope } from '../../../http.js';
import { getT3qIntegrationReadiness, readinessCounts } from '../../../domain/t3qReadiness.js';
export function GET(){const readiness=getT3qIntegrationReadiness();return envelope({readiness,summary:readinessCounts(readiness)},{provider:'T3qReadinessProvider',dataStatus:'provisional'});}
