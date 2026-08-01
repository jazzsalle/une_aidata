import { envelope } from '../../../server/http';
import { seed } from '../../../server/seeds';
export function GET(){ return envelope(seed.layers.layers,{provider:'LayerCatalogSeedProvider',dataStatus:'provisional'}); }
