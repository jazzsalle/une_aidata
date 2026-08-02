import { envelope } from '../../../http';
import { seed } from '../../../seeds';
export function GET(){
  return envelope(seed.providerConformanceCases,{provider:'ProviderConformanceRegistry',dataStatus:'mock'});
}
