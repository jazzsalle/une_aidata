import { envelope } from '../../../http';
import { seed } from '../../../seeds';
export function GET(){ return envelope(seed.layers.layers,{provider:'LayerCatalogSeedProvider',dataStatus:'provisional'}); }
