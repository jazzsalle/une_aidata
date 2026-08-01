import { envelope } from '../../../server/http';
import { probeUneRagOpenApi } from '../../../server/providers/uneRag';

export async function GET() {
  const result = await probeUneRagOpenApi();
  return envelope(result, {
    provider: 'UNE_RAG_OPENAPI_PROBE',
    dataStatus: result.reachable ? 'actual' : 'provisional',
    warnings: result.warning ? [result.warning] : [],
  });
}
