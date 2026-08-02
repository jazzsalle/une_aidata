import { envelope } from '../server/http';
import * as health from '../server/routes/health';
import * as agentMessages from '../server/routes/v1/agent/messages';
import * as contractsProviderConformance from '../server/routes/v1/contracts/provider-conformance';
import * as contractsProviders from '../server/routes/v1/contracts/providers';
import * as floodTraces from '../server/routes/v1/flood-traces';
import * as integrationsStatus from '../server/routes/v1/integrations/status';
import * as integrationsUneRagProbe from '../server/routes/v1/integrations/une-rag-probe';
import * as mapLayers from '../server/routes/v1/map/layers';
import * as mockCatalog from '../server/routes/v1/mock/catalog';
import * as mockScenarios from '../server/routes/v1/mock/scenarios';
import * as mockSpatial from '../server/routes/v1/mock/spatial';
import * as observationsHydrology from '../server/routes/v1/observations/hydrology';
import * as observationsKmaNowcast from '../server/routes/v1/observations/kma-nowcast';
import * as observationsQuery from '../server/routes/v1/observations/query';
import * as priorityAreasQuery from '../server/routes/v1/priority-areas/query';
import * as procedures from '../server/routes/v1/procedures';
import * as reportsDrafts from '../server/routes/v1/reports/drafts';
import * as riskKnowledgeSearch from '../server/routes/v1/risk-knowledge/search';
import * as satelliteAssets from '../server/routes/v1/satellite-assets';
import * as satelliteAssetsMetrics from '../server/routes/v1/satellite-assets/metrics';
import * as satelliteAssetsSelect from '../server/routes/v1/satellite-assets/select';
import * as satelliteEvidenceSets from '../server/routes/v1/satellite-evidence-sets';
import * as scenarios from '../server/routes/v1/scenarios';
import * as similarEventsDetail from '../server/routes/v1/similar-events/detail';
import * as similarEventsSearch from '../server/routes/v1/similar-events/search';
import * as similarityWeightProfiles from '../server/routes/v1/similarity/weight-profiles';
import * as situations from '../server/routes/v1/situations';
import * as t3qAlignment from '../server/routes/v1/t3q/alignment';
import * as t3qCqCoverage from '../server/routes/v1/t3q/cq-coverage';
import * as t3qReadiness from '../server/routes/v1/t3q/readiness';
import * as t3qSearchPreview from '../server/routes/v1/t3q/search-preview';

type RouteHandler = (request: Request) => Response | Promise<Response>;

const routes: Record<string, RouteHandler> = {
  'GET /api/health': health.GET,
  'POST /api/v1/agent/messages': agentMessages.POST,
  'GET /api/v1/contracts/provider-conformance': contractsProviderConformance.GET,
  'GET /api/v1/contracts/providers': contractsProviders.GET,
  'GET /api/v1/flood-traces': floodTraces.GET,
  'GET /api/v1/integrations/status': integrationsStatus.GET,
  'GET /api/v1/integrations/une-rag-probe': integrationsUneRagProbe.GET,
  'GET /api/v1/map/layers': mapLayers.GET,
  'GET /api/v1/mock/catalog': mockCatalog.GET,
  'GET /api/v1/mock/scenarios': mockScenarios.GET,
  'GET /api/v1/mock/spatial': mockSpatial.GET,
  'GET /api/v1/observations/hydrology': observationsHydrology.GET,
  'GET /api/v1/observations/kma-nowcast': observationsKmaNowcast.GET,
  'POST /api/v1/observations/query': observationsQuery.POST,
  'POST /api/v1/priority-areas/query': priorityAreasQuery.POST,
  'GET /api/v1/procedures': procedures.GET,
  'POST /api/v1/reports/drafts': reportsDrafts.POST,
  'POST /api/v1/risk-knowledge/search': riskKnowledgeSearch.POST,
  'GET /api/v1/satellite-assets': satelliteAssets.GET,
  'GET /api/v1/satellite-assets/metrics': satelliteAssetsMetrics.GET,
  'POST /api/v1/satellite-assets/select': satelliteAssetsSelect.POST,
  'GET /api/v1/satellite-evidence-sets': satelliteEvidenceSets.GET,
  'GET /api/v1/scenarios': scenarios.GET,
  'GET /api/v1/similar-events/detail': similarEventsDetail.GET,
  'POST /api/v1/similar-events/search': similarEventsSearch.POST,
  'GET /api/v1/similarity/weight-profiles': similarityWeightProfiles.GET,
  'POST /api/v1/situations': situations.POST,
  'GET /api/v1/t3q/alignment': t3qAlignment.GET,
  'GET /api/v1/t3q/cq-coverage': t3qCqCoverage.GET,
  'GET /api/v1/t3q/readiness': t3qReadiness.GET,
  'POST /api/v1/t3q/search-preview': t3qSearchPreview.POST,
};

function dispatch(method: string, request: Request): Response | Promise<Response> {
  let pathname = new URL(request.url).pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  const handler = routes[`${method} ${pathname}`];
  if (handler) return handler(request);
  const pathExists = Object.keys(routes).some((key) => key.endsWith(` ${pathname}`));
  if (pathExists) {
    return envelope(null, { status: 405, errors: [`${pathname} 경로는 ${method} 메서드를 지원하지 않습니다.`] });
  }
  return envelope(null, { status: 404, errors: [`요청 경로를 찾을 수 없습니다: ${pathname}`] });
}

export function GET(request: Request) { return dispatch('GET', request); }
export function POST(request: Request) { return dispatch('POST', request); }
export function PUT(request: Request) { return dispatch('PUT', request); }
export function PATCH(request: Request) { return dispatch('PATCH', request); }
export function DELETE(request: Request) { return dispatch('DELETE', request); }
