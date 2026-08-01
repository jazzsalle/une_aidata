import { badRequest, body, envelope } from '../../server/http';
import { createSituation, type CreateSituationInput } from '../../server/domain/situations';
export async function POST(request: Request) {
  try { return envelope(createSituation(await body<CreateSituationInput>(request)), { provider:'SituationFunction', dataStatus:'provisional' }); }
  catch (error) { return badRequest(error instanceof Error ? error.message : '현재상황 생성 실패'); }
}
