import { envelope } from '../../http.js';
import { seed } from '../../seeds.js';
export function GET() { return envelope(seed.currentSituations.situations, { provider:'StaticSeedProvider', dataStatus:'scenario' }); }
