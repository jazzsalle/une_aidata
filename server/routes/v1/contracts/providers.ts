import { envelope } from '../../../http';
import { seed } from '../../../seeds';
import { providerSelections } from '../../../providers/domainProviders';
export function GET(){return envelope({contract:seed.providerContracts,selections:providerSelections()},{provider:'ProviderContractRegistry',dataStatus:'mock'});}
