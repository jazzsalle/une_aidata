"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const env_js_1 = require("../../../env.js");
const uneRag_js_1 = require("../../../providers/uneRag.js");
const kmaNowcast_js_1 = require("../../../providers/kmaNowcast.js");
const hrfcoHydrology_js_1 = require("../../../providers/hrfcoHydrology.js");
const t3qMetadata_js_1 = require("../../../providers/t3qMetadata.js");
function status(id, name, configured, message, required, validationState, nextAction) {
    return {
        integration_id: id,
        name,
        configured,
        runtime_mode: (0, env_js_1.dataMode)(),
        message,
        required_env: required,
        checked_at: new Date().toISOString(),
        validation_state: validationState,
        next_action: nextAction,
    };
}
function GET() {
    const vworldConfigured = Boolean((0, env_js_1.env)('VWORLD_SERVER_API_KEY'));
    const kma = (0, kmaNowcast_js_1.kmaConfigured)();
    const hrfco = (0, hrfcoHydrology_js_1.hrfcoConfigured)();
    const rag = (0, uneRag_js_1.uneRagConfigured)();
    const t3qApi = false;
    const t3qMcp = false;
    const rows = [
        status('VWORLD', 'VWorld 배경지도', vworldConfigured, vworldConfigured ? '서버 환경변수는 설정되었습니다. 브라우저 타일 성공 여부와 등록 도메인을 별도로 확인해야 합니다.' : '브라우저 키가 없으면 공간 Seed만 표시합니다.', ['VITE_VWORLD_MAP_KEY'], vworldConfigured ? 'configured' : 'fallback', 'Vercel Preview 도메인을 VWorld 허용 도메인에 등록한 후 Base·Satellite 타일을 확인합니다.'),
        status('KMA_NOWCAST', '기상청 초단기실황', kma, kma ? '의왕·구미·남원 격자좌표로 공식 초단기실황 호출을 시도합니다.' : '공공데이터포털 서비스키가 미설정이며 Scenario 값으로 대체합니다.', ['DATA_GO_KR_SERVICE_KEY'], kma ? 'configured' : 'fallback', '공공데이터포털 활용신청 키로 RN1·T1H·REH·WSD 실응답을 검증합니다.'),
        status('HRFCO_HYDRO', '홍수통제소 수위·유량', hrfco, hrfco ? 'Endpoint·인증키·공식 관측소 매핑이 설정되었습니다.' : '하천기본계획 내부 지점코드와 홍수통제소 공식 관측소 코드를 분리하여 관리합니다. 공식 코드 미확정 시 사용자 입력·Scenario를 유지합니다.', ['HRFCO_API_BASE_URL', 'HRFCO_WATERLEVEL_PATH', 'HRFCO_SERVICE_KEY', 'HRFCO_STATION_MAP_JSON'], hrfco ? 'configured' : 'pending', '의왕·구미·남원 인접 공식 관측소 코드와 응답 필드명을 확인한 뒤 실호출을 활성화합니다.'),
        status('T3Q_META_ONTOLOGY', 'T3Q 구조 기반 Mock 계약', true, `현재 정책은 ${t3qMetadata_js_1.T3Q_RUNTIME_POLICY}이며 Event·Passage·RefDisasterEventID·T코드·lineage 구조를 UNE Mock 데이터로 구현합니다.`, [], 'fallback', '외부 API를 요청하지 않고 Mock Contract Test와 화면·검색 시나리오를 수행합니다.'),
        status('T3Q_MCP', 'T3Q MCP 교체경계', false, '현재 MCP 기술연계는 범위에 포함하지 않으며 논리 Tool 계약과 Adapter 경계만 유지합니다.', [], 'pending', '향후 공식 Tool 규격이 제공되는 별도 단계에서 Provider를 교체합니다.'),
        status('UNE_RAG', '유니 RAG API', rag, rag ? '로그인·검색 설정은 완료되었으나 OpenAPI 접근과 실제 응답 매핑 검증이 필요합니다.' : 'URL·인증정보 또는 검색경로가 미설정되어 Seed 근거로 대체합니다.', ['UNE_RAG_BASE_URL', 'UNE_RAG_SEARCH_PATH', 'UNE_RAG_USERNAME/UNE_RAG_PASSWORD 또는 UNE_RAG_API_KEY'], rag ? 'configured' : 'fallback', 'UNE_RAG_OPENAPI_PATH를 설정하고 /api/v1/integrations/une-rag-probe로 Swagger 경로를 확인합니다.'),
    ];
    return (0, http_js_1.envelope)(rows, { provider: 'IntegrationDiagnostics', dataStatus: 'provisional' });
}
