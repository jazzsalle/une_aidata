import { envelope } from '../../../http.js';
import { seed } from '../../../seeds.js';
import { providerSelections } from '../../../providers/domainProviders.js';
export function GET(){return envelope({contract:seed.providerContracts,selections:providerSelections()},{provider:'ProviderContractRegistry',dataStatus:'mock'});}
