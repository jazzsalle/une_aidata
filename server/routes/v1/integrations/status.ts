import { envelope } from '../../../http.js';
import { dataMode, env } from '../../../env.js';
import { uneRagConfigured } from '../../../providers/uneRag.js';
import { kmaConfigured } from '../../../providers/kmaNowcast.js';
import { hrfcoConfigured } from '../../../providers/hrfcoHydrology.js';
import { T3Q_RUNTIME_POLICY } from '../../../providers/t3qMetadata.js';
import type { IntegrationStatus } from '../../../contracts.js';

/** Provider별 승격 단계 문구.
 *
 *  이전에는 FIXTURE_VALIDATED 한 문장을 4개 Provider 전부에 무조건 덧붙였다. 그래서 원장상
 *  이미 SHADOW_TESTED 인 une_rag 까지 화면에는 FIXTURE_VALIDATED 로 나왔다.
 *
 *  정본은 `tests/provider/provider_promotion_status.json` 이며, 여기 값이 그 원장과 어긋나면
 *  `scripts/smoke_provider_promotion_status.py` 가 실패한다. 원장을 고치면 여기도 같이 고칠 것.
 *  `validation_state` enum(`server/contracts.ts`)은 건드리지 않는다 — 계약 무변경이다. */
export const PROVIDER_LIFECYCLE:Record<string,string>={
  kma_nowcast:'SHADOW_TESTED',
  hrfco_hydrology:'FIXTURE_VALIDATED',
  une_rag:'SHADOW_TESTED',
  t3q_event:'FIXTURE_VALIDATED',
};

const LIFECYCLE_NOTE:Record<string,string>={
  FIXTURE_VALIDATED:' Fixture 검증 상태: FIXTURE_VALIDATED — 대표응답·오류·Timeout 매핑을 저장된 표본으로 검증했으며 실호출·DEFAULT 전환 아님.',
  SHADOW_TESTED:' Fixture 검증 상태: SHADOW_TESTED — 실 Endpoint 대상 Shadow Test 를 통과하고 승인 1 이 기록되었습니다. 다만 SELECTABLE 승격은 보류 중이라 화면은 Seed 로 동작하며 DEFAULT 전환도 아닙니다.',
};

/** 원장 단계에 해당하는 문구. 단계를 모르면 아무 말도 덧붙이지 않는다 — 틀린 단계를 적는 것보다 낫다. */
function lifecycleNote(providerId:string):string {
  const stage=PROVIDER_LIFECYCLE[providerId];
  return stage?(LIFECYCLE_NOTE[stage] ?? ''):'';
}

function status(
  id:string,
  name:string,
  configured:boolean,
  message:string,
  required:string[],
  validationState:IntegrationStatus['validation_state'],
  nextAction:string,
):IntegrationStatus {
  return {
    integration_id:id,
    name,
    configured,
    runtime_mode:dataMode(),
    message,
    required_env:required,
    checked_at:new Date().toISOString(),
    validation_state:validationState,
    next_action:nextAction,
  };
}

export function GET(){
  const vworldConfigured=Boolean(env('VWORLD_SERVER_API_KEY'));
  const kma=kmaConfigured();
  const hrfco=hrfcoConfigured();
  const rag=uneRagConfigured();
  const t3qApi=false;
  const t3qMcp=false;
  const rows=[
    status(
      'VWORLD',
      'VWorld 배경지도',
      vworldConfigured,
      vworldConfigured?'서버 환경변수는 설정되었습니다. 브라우저 타일 성공 여부와 등록 도메인을 별도로 확인해야 합니다.':'브라우저 키가 없으면 공간 Seed만 표시합니다.',
      ['VITE_VWORLD_MAP_KEY'],
      vworldConfigured?'configured':'fallback',
      'Vercel Preview 도메인을 VWorld 허용 도메인에 등록한 후 Base·Satellite 타일을 확인합니다.',
    ),
    status(
      'KMA_NOWCAST',
      '기상청 초단기실황',
      kma,
      (kma?'의왕·구미·남원 격자좌표로 공식 초단기실황 호출을 시도합니다.':'공공데이터포털 서비스키가 미설정이며 Scenario 값으로 대체합니다.')+lifecycleNote('kma_nowcast'),
      ['DATA_GO_KR_SERVICE_KEY'],
      kma?'configured':'fallback',
      '공공데이터포털 활용신청 키로 RN1·T1H·REH·WSD 실응답을 검증합니다.',
    ),
    status(
      'HRFCO_HYDRO',
      '홍수통제소 수위·유량',
      hrfco,
      (hrfco?'Endpoint·인증키·공식 관측소 매핑이 설정되었습니다.':'하천기본계획 내부 지점코드와 홍수통제소 공식 관측소 코드를 분리하여 관리합니다. 공식 코드 미확정 시 사용자 입력·Scenario를 유지합니다.')+lifecycleNote('hrfco_hydrology'),
      ['HRFCO_API_BASE_URL','HRFCO_WATERLEVEL_PATH','HRFCO_SERVICE_KEY','HRFCO_STATION_MAP_JSON'],
      hrfco?'configured':'pending',
      '의왕·구미·남원 인접 공식 관측소 코드와 응답 필드명을 확인한 뒤 실호출을 활성화합니다.',
    ),

    status(
      'T3Q_META_ONTOLOGY',
      'T3Q 구조 기반 Mock 계약',
      true,
      `현재 정책은 ${T3Q_RUNTIME_POLICY}이며 Event·Passage·RefDisasterEventID·T코드·lineage 구조를 UNE Mock 데이터로 구현합니다.`+lifecycleNote('t3q_event'),
      [],
      'fallback',
      '외부 API를 요청하지 않고 Mock Contract Test와 화면·검색 시나리오를 수행합니다.',
    ),
    status(
      'T3Q_MCP',
      'T3Q MCP 교체경계',
      false,
      '현재 MCP 기술연계는 범위에 포함하지 않으며 논리 Tool 계약과 Adapter 경계만 유지합니다.',
      [],
      'pending',
      '향후 공식 Tool 규격이 제공되는 별도 단계에서 Provider를 교체합니다.',
    ),
    status(
      'UNE_RAG',
      '유니 RAG API',
      rag,
      (rag?'로그인·검색 설정은 완료되었으나 OpenAPI 접근과 실제 응답 매핑 검증이 필요합니다.':'URL·인증정보 또는 검색경로가 미설정되어 Seed 근거로 대체합니다.')+lifecycleNote('une_rag'),
      ['UNE_RAG_BASE_URL','UNE_RAG_SEARCH_PATH','UNE_RAG_USERNAME/UNE_RAG_PASSWORD 또는 UNE_RAG_API_KEY'],
      rag?'configured':'fallback',
      'UNE_RAG_OPENAPI_PATH를 설정하고 /api/v1/integrations/une-rag-probe로 Swagger 경로를 확인합니다.',
    ),
  ];
  return envelope(rows,{provider:'IntegrationDiagnostics',dataStatus:'provisional'});
}
