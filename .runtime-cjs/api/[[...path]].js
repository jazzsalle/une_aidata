"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.PUT = PUT;
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const http_1 = require("../server/http");
const health = __importStar(require("../server/routes/health"));
const agentMessages = __importStar(require("../server/routes/v1/agent/messages"));
const contractsProviderConformance = __importStar(require("../server/routes/v1/contracts/provider-conformance"));
const contractsProviders = __importStar(require("../server/routes/v1/contracts/providers"));
const floodTraces = __importStar(require("../server/routes/v1/flood-traces"));
const integrationsStatus = __importStar(require("../server/routes/v1/integrations/status"));
const integrationsUneRagProbe = __importStar(require("../server/routes/v1/integrations/une-rag-probe"));
const mapLayers = __importStar(require("../server/routes/v1/map/layers"));
const mockCatalog = __importStar(require("../server/routes/v1/mock/catalog"));
const mockScenarios = __importStar(require("../server/routes/v1/mock/scenarios"));
const mockSpatial = __importStar(require("../server/routes/v1/mock/spatial"));
const observationsHydrology = __importStar(require("../server/routes/v1/observations/hydrology"));
const observationsKmaNowcast = __importStar(require("../server/routes/v1/observations/kma-nowcast"));
const observationsQuery = __importStar(require("../server/routes/v1/observations/query"));
const priorityAreasQuery = __importStar(require("../server/routes/v1/priority-areas/query"));
const procedures = __importStar(require("../server/routes/v1/procedures"));
const reportsDrafts = __importStar(require("../server/routes/v1/reports/drafts"));
const riskKnowledgeSearch = __importStar(require("../server/routes/v1/risk-knowledge/search"));
const satelliteAssets = __importStar(require("../server/routes/v1/satellite-assets"));
const satelliteAssetsMetrics = __importStar(require("../server/routes/v1/satellite-assets/metrics"));
const satelliteAssetsSelect = __importStar(require("../server/routes/v1/satellite-assets/select"));
const satelliteEvidenceSets = __importStar(require("../server/routes/v1/satellite-evidence-sets"));
const scenarios = __importStar(require("../server/routes/v1/scenarios"));
const similarEventsDetail = __importStar(require("../server/routes/v1/similar-events/detail"));
const similarEventsSearch = __importStar(require("../server/routes/v1/similar-events/search"));
const similarityWeightProfiles = __importStar(require("../server/routes/v1/similarity/weight-profiles"));
const situations = __importStar(require("../server/routes/v1/situations"));
const t3qAlignment = __importStar(require("../server/routes/v1/t3q/alignment"));
const t3qCqCoverage = __importStar(require("../server/routes/v1/t3q/cq-coverage"));
const t3qReadiness = __importStar(require("../server/routes/v1/t3q/readiness"));
const t3qSearchPreview = __importStar(require("../server/routes/v1/t3q/search-preview"));
const routes = {
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
function dispatch(method, request) {
    let pathname = new URL(request.url).pathname;
    if (pathname.length > 1 && pathname.endsWith('/'))
        pathname = pathname.slice(0, -1);
    const handler = routes[`${method} ${pathname}`];
    if (handler)
        return handler(request);
    const pathExists = Object.keys(routes).some((key) => key.endsWith(` ${pathname}`));
    if (pathExists) {
        return (0, http_1.envelope)(null, { status: 405, errors: [`${pathname} 경로는 ${method} 메서드를 지원하지 않습니다.`] });
    }
    return (0, http_1.envelope)(null, { status: 404, errors: [`요청 경로를 찾을 수 없습니다: ${pathname}`] });
}
function GET(request) { return dispatch('GET', request); }
function POST(request) { return dispatch('POST', request); }
function PUT(request) { return dispatch('PUT', request); }
function PATCH(request) { return dispatch('PATCH', request); }
function DELETE(request) { return dispatch('DELETE', request); }
