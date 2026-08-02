import { envelope } from '../../../http.js';
import { seed } from '../../../seeds.js';
export function GET(){ return envelope(seed.layers.layers,{provider:'LayerCatalogSeedProvider',dataStatus:'provisional'}); }
