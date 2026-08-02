import { envelope } from '../../../http.js';
import { probeUneRagOpenApi } from '../../../providers/uneRag.js';

export async function GET() {
  const result = await probeUneRagOpenApi();
  return envelope(result, {
    provider: 'UNE_RAG_OPENAPI_PROBE',
    dataStatus: result.reachable ? 'actual' : 'provisional',
    warnings: result.warning ? [result.warning] : [],
  });
}
