import { envelope } from '../../http';
import { seed } from '../../seeds';
export function GET() { return envelope(seed.currentSituations.situations, { provider:'StaticSeedProvider', dataStatus:'scenario' }); }
