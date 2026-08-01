import { envelope } from '../../../server/http';
import { seed } from '../../../server/seeds';
import { providerSelections } from '../../../server/providers/domainProviders';
export function GET(){return envelope({contract:seed.providerContracts,selections:providerSelections()},{provider:'ProviderContractRegistry',dataStatus:'mock'});}
