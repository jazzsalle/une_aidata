// Provider Shadow Test 하네스 (Phase 8)
// - CLI로 지정한 provider 1종(kma_nowcast|hrfco_hydrology|une_rag)만 .runtime-cjs 실 fetch 함수로 1회 실호출한다.
// - env 미설정·선행조건 미충족(HRFCO official_station_code 부재, UNE RAG search path 미설정 등) 시
//   실호출 없이 HELD(보류)로 기록하고 exit 0 — 스크립트 존재·dry-run만으로는 네트워크 호출 0건.
// - 실호출 성공 시: (a) 정규화 계약 검증(official_data=true, value_status/data_status='actual', 관측시각, provider 표기),
//   (b) fixture 대표응답 매핑 결과와 필드 구조 병행비교(키 집합·타입만, 값 비교 아님),
//   (c) 오류·Timeout이 예외 전파 없이 연계별 warning Fallback으로 수렴함을 기록한다.
// - Redaction: serviceKey·비밀번호·인증 헤더·키 포함 URL을 결과에 기록하지 않으며,
//   기록 직전 직렬화 문자열에 env 비밀값 포함 여부를 자기검증(assert)한다.
// - SHADOW_PASSED는 SELECTABLE/DEFAULT 전환이 아니다. 승격은 승인 기반으로만 진행한다(docs/27 §3).
const fs = require('fs');
const path = require('path');

const kma = require('../../.runtime-cjs/server/providers/kmaNowcast.js');
const hrfco = require('../../.runtime-cjs/server/providers/hrfcoHydrology.js');
const uneRag = require('../../.runtime-cjs/server/providers/uneRag.js');
const { env } = require('../../.runtime-cjs/server/env.js');

const RESULT_FILE = path.resolve('tests/provider/provider_shadow_test_result.json');
const FIXTURE_ROOT = path.resolve('data/fixtures/providers');
const SUPPORTED = ['kma_nowcast', 'hrfco_hydrology', 'une_rag'];

function fail(message) { throw new Error(message); }
function assert(condition, message) { if (!condition) fail(message); }

// ---------- 네트워크 가드: 승인된 실호출 1회 구간에서만 실 fetch를 통과시킨다 ----------
const realFetch = globalThis.fetch;
let fetchCallCount = 0;
let networkAllowed = false;
globalThis.fetch = (...args) => {
  fetchCallCount += 1;
  if (!networkAllowed) throw new Error('provider shadow gate: 보류(HELD) 상태에서 네트워크 호출 금지');
  return realFetch(...args);
};

// ---------- CLI ----------
function parseArgs(argv) {
  const args = { provider: undefined, adminCode: undefined, query: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const eat = (name) => (token === `--${name}` ? argv[++i] : token.startsWith(`--${name}=`) ? token.slice(name.length + 3) : undefined);
    const provider = eat('provider'); if (provider !== undefined) { args.provider = provider; continue; }
    const adminCode = eat('admin-code'); if (adminCode !== undefined) { args.adminCode = adminCode; continue; }
    const query = eat('query'); if (query !== undefined) { args.query = query; continue; }
  }
  return args;
}

// ---------- Redaction 자기검증 ----------
const SECRET_ENV_NAMES = [
  'DATA_GO_KR_SERVICE_KEY', 'HRFCO_SERVICE_KEY',
  'UNE_RAG_API_KEY', 'UNE_RAG_USERNAME', 'UNE_RAG_PASSWORD',
  'VITE_VWORLD_MAP_KEY', 'VWORLD_API_KEY', 'T3Q_API_KEY', 'T3Q_AUTH_TOKEN',
];
function secretValues() {
  const values = new Set();
  for (const [name, value] of Object.entries(process.env)) {
    if (!value || typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length < 4) continue; // 'true' 등 일반값 오탐 방지
    if (SECRET_ENV_NAMES.includes(name) || /(KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL)/i.test(name)) values.add(trimmed);
  }
  return [...values];
}
function assertRedacted(serialized) {
  for (const secret of secretValues()) {
    // 비밀값 자체를 오류 메시지에 되풀이하지 않는다.
    assert(!serialized.includes(secret), 'redaction 자기검증 실패: 결과 직렬화 문자열에 env 비밀값이 포함되어 기록을 중단합니다.');
  }
  assert(!/serviceKey=/i.test(serialized), 'redaction 자기검증 실패: serviceKey 포함 URL이 결과에 기록되려 했습니다.');
  assert(!/Bearer\s+[A-Za-z0-9._~+/-]{8,}/.test(serialized), 'redaction 자기검증 실패: 인증 헤더(Bearer 토큰)가 결과에 기록되려 했습니다.');
  assert(!/Basic\s+[A-Za-z0-9+/=]{8,}/.test(serialized), 'redaction 자기검증 실패: 인증 헤더(Basic)가 결과에 기록되려 했습니다.');
}

// ---------- 결과 병합 기록 ----------
function mergeAndWrite(entry) {
  let current = null;
  if (fs.existsSync(RESULT_FILE)) {
    try { current = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8')); } catch { current = null; }
  }
  if (!current || typeof current !== 'object' || !Array.isArray(current.results)) {
    current = {
      gate: 'provider-shadow-gate',
      note: 'Phase 8 Shadow Test 결과. SHADOW_PASSED는 SELECTABLE/DEFAULT 전환이 아니며 승격은 승인 기반으로만 진행한다. HELD는 env·선행조건 미충족으로 실호출을 보류한 상태(네트워크 0건)이다.',
      results: [],
    };
  }
  current.results = current.results.filter((item) => item && item.provider_id !== entry.provider_id).concat([entry]);
  current.results.sort((a, b) => String(a.provider_id).localeCompare(String(b.provider_id)));
  current.updated_at = entry.executed_at;
  const serialized = JSON.stringify(current, null, 2);
  assertRedacted(serialized);
  fs.writeFileSync(RESULT_FILE, serialized + '\n');
}

// ---------- 구조 병행비교 (키 집합·타입만, 값 비교 아님) ----------
function typeOf(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
// 레코드를 배열 순서로 짝지으면 안 된다. 기상청 실응답은 카테고리를 알파벳순으로
// 주고(PTY 먼저, unit=null) fixture 는 다른 순서라(RN1 먼저, unit='mm'), 같은 8종을
// 담고 있어도 인덱스 0 끼리 비교하면 서로 다른 지표를 견주게 된다. 실제로 그 때문에
// 2026-08-09 kma_nowcast Shadow Test 가 헛되이 FAILED 로 떨어졌다.
// 그래서 `type` 같은 안정적 식별자로 짝지어 **레코드 전건**을 비교한다. 비교 범위가
// 1건 → 전건으로 넓어지므로 판정이 느슨해지는 것이 아니라 강해진다.
const RECORD_IDENTITY = ['type', 'passage_id', 'station_id', 'id'];
function identityOf(record, index) {
  if (!record || typeof record !== 'object') return `#${index}`;
  for (const key of RECORD_IDENTITY) {
    if (typeof record[key] === 'string' && record[key]) return `${key}:${record[key]}`;
  }
  return `#${index}`;
}
function asRecords(value) {
  if (Array.isArray(value)) return value.filter((row) => row && typeof row === 'object');
  return value && typeof value === 'object' ? [value] : [];
}
function unionKeys(records) {
  const keys = new Set();
  for (const record of records) for (const key of Object.keys(record)) keys.add(key);
  return [...keys].sort();
}
function compareStructure(liveInput, fixtureInput) {
  const liveRecords = asRecords(liveInput);
  const fixtureRecords = asRecords(fixtureInput);
  const liveKeys = unionKeys(liveRecords);
  const fixtureKeys = unionKeys(fixtureRecords);
  const missingInLive = fixtureKeys.filter((key) => !liveKeys.includes(key));
  const extraInLive = liveKeys.filter((key) => !fixtureKeys.includes(key));

  const liveById = new Map(liveRecords.map((record, index) => [identityOf(record, index), record]));
  const fixtureById = new Map(fixtureRecords.map((record, index) => [identityOf(record, index), record]));
  const typeMismatches = [];
  for (const [id, live] of liveById) {
    const fixture = fixtureById.get(id);
    if (!fixture) continue;
    for (const key of Object.keys(live)) {
      if (!(key in fixture)) continue;
      if (typeOf(live[key]) !== typeOf(fixture[key])) {
        typeMismatches.push({ record: id, key, live_type: typeOf(live[key]), fixture_type: typeOf(fixture[key]) });
      }
    }
  }
  const onlyInFixture = [...fixtureById.keys()].filter((id) => !liveById.has(id));
  const onlyInLive = [...liveById.keys()].filter((id) => !fixtureById.has(id));
  return {
    mode: 'key-set-and-type-only',
    note: '값 비교 아님 — fixture 대표응답 매핑 결과와 실호출 정규화 결과의 필드 구조(키 집합·타입)만 병행비교한다. 레코드는 배열 순서가 아니라 식별자로 짝지어 전건 비교한다.',
    live_record_count: liveRecords.length,
    fixture_record_count: fixtureRecords.length,
    matched_records: [...liveById.keys()].filter((id) => fixtureById.has(id)).length,
    live_keys: liveKeys,
    fixture_keys: fixtureKeys,
    missing_in_live: missingInLive,
    extra_in_live: extraInLive,
    // 짝이 없는 레코드는 실패 사유가 아니다 — 시각에 따라 응답 항목 수가 달라질 수 있다. 기록만 남긴다.
    records_only_in_fixture: onlyInFixture,
    records_only_in_live: onlyInLive,
    type_mismatches: typeMismatches,
    structurally_compatible: missingInLive.length === 0 && typeMismatches.length === 0,
  };
}
function loadFixture(providerId, file) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, providerId, file), 'utf8'));
}

// ---------- Observation(기상·수문) 공통 계약 검증 ----------
function observationChecks(observations, providerLabel) {
  const checks = [];
  const push = (check, pass, detail) => checks.push({ check, pass, ...(detail ? { detail } : {}) });
  push('records_present', observations.length > 0, `정규화 Observation ${observations.length}건`);
  push('official_data_true', observations.length > 0 && observations.every((o) => o.official_data === true));
  push('value_status_actual', observations.length > 0 && observations.every((o) => o.value_status === 'actual'));
  push('observed_at_present', observations.length > 0 && observations.every((o) => typeof o.observed_at === 'string' && o.observed_at.length > 0));
  push('source_provider_present', observations.length > 0 && observations.every((o) => typeof o.source_provider === 'string' && o.source_provider.length > 0), providerLabel);
  return checks;
}

// ---------- provider별 선행조건(HELD) 검사 — provider 코드의 기존 가드와 동일 기준 ----------
function heldReasonFor(providerId, args) {
  if (providerId === 'kma_nowcast') {
    if (!kma.kmaConfigured()) return 'DATA_GO_KR_SERVICE_KEY 미설정 — 기상청 초단기실황을 호출하지 않고 사용자 입력·Scenario 값을 유지합니다.';
    const adminCode = args.adminCode ?? '41430';
    if (!kma.kmaGrid(adminCode)) return `기상청 격자좌표 미정의: ${adminCode} — 호출 보류`;
    return undefined;
  }
  if (providerId === 'hrfco_hydrology') {
    const adminCode = args.adminCode ?? firstHrfcoAdminCandidate();
    if (!adminCode) return 'HRFCO_STATION_MAP_JSON 미설정 또는 official_station_code 부재 — 수위·유량 API를 호출하지 않고 사용자 입력·Scenario 값을 유지합니다(v0.7 규칙 4).';
    const status = hrfco.hydrologyStationStatus(adminCode);
    if (!status.configured) return `${status.warning ?? '홍수통제소 연계 선행조건 미충족'} — 수위·유량 API 호출 보류(v0.7 규칙 4)`;
    return undefined;
  }
  if (providerId === 'une_rag') {
    if (!env('UNE_RAG_BASE_URL')) return 'UNE_RAG_BASE_URL 미설정 — 실호출 없이 Seed 근거를 유지합니다.';
    if (!env('UNE_RAG_SEARCH_PATH')) return 'UNE_RAG_SEARCH_PATH 미설정 — 경로를 추정하여 고정하지 않고 보류합니다(v0.7 규칙 5). Seed 근거를 유지합니다.';
    if (!uneRag.uneRagConfigured()) return 'UNE RAG 인증정보(UNE_RAG_API_KEY 또는 UNE_RAG_USERNAME/UNE_RAG_PASSWORD) 미설정 — 실호출 보류.';
    return undefined;
  }
  return `지원하지 않는 provider: ${providerId}`;
}

// HRFCO_STATION_MAP_JSON에서 official_station_code가 있는 첫 admin_code를 찾는다(provider parseStationMap과 동일 기준).
function firstHrfcoAdminCandidate() {
  const raw = env('HRFCO_STATION_MAP_JSON');
  if (!raw) return undefined;
  let value;
  try { value = JSON.parse(raw); } catch { return undefined; }
  const entries = Array.isArray(value)
    ? value.filter((item) => item && typeof item === 'object' && item.admin_code).map((item) => [item.admin_code, item])
    : value && typeof value === 'object' ? Object.entries(value) : [];
  for (const [adminCode, mapping] of entries) {
    if (mapping && typeof mapping === 'object' && mapping.official_station_code) return adminCode;
  }
  return undefined;
}

// ---------- provider별 실호출 1회 + 검증 ----------
async function runKma(args) {
  const adminCode = args.adminCode ?? '41430';
  let result;
  let fallback = null;
  try {
    networkAllowed = true;
    result = await kma.fetchKmaNowcast(adminCode);
  } catch (error) {
    // (c) 오류·Timeout: 예외를 전파하지 않고 실경로(publicObservation catch)와 동일한 연계별 warning Fallback으로 수렴시킨다.
    result = kma.mapKmaFixtureError(error);
    fallback = { converged: true, warning: result.warning, error_name: error && error.name ? error.name : 'Error' };
  } finally {
    networkAllowed = false;
  }
  const observations = result.observations ?? [];
  const checks = observationChecks(observations, 'KMA_ULTRA_SRT_NCST');
  checks.push(fallback
    ? { check: 'error_timeout_warning_fallback', pass: true, detail: '오류·Timeout이 예외 전파 없이 연계별 warning Fallback으로 수렴함' }
    : { check: 'error_timeout_warning_fallback', pass: 'not_triggered', detail: '성공 응답 — 오류·Timeout 경로 미발생(fixture 게이트 KMA-ERR/TMO 케이스로 검증됨)' });
  const fixtureMapped = kma.mapKmaFixturePayload(loadFixture('kma_nowcast', 'representative_response.json'), { adminCode: '41430' });
  const compared = compareStructure(observations, fixtureMapped.observations);
  return { checks, compared, fallback, warning: result.warning, record_count: observations.length };
}

async function runHrfco(args) {
  const adminCode = args.adminCode ?? firstHrfcoAdminCandidate();
  let result;
  let fallback = null;
  try {
    networkAllowed = true;
    result = await hrfco.fetchHrfcoHydrology(adminCode);
  } catch (error) {
    result = hrfco.mapHrfcoFixtureError(error, { adminCode });
    fallback = { converged: true, warning: result.warning, error_name: error && error.name ? error.name : 'Error' };
  } finally {
    networkAllowed = false;
  }
  const observations = result.observations ?? [];
  const checks = observationChecks(observations, 'HRFCO_STANDARD_HYDROLOGY_DB');
  checks.push(fallback
    ? { check: 'error_timeout_warning_fallback', pass: true, detail: '오류·Timeout이 예외 전파 없이 연계별 warning Fallback으로 수렴함' }
    : { check: 'error_timeout_warning_fallback', pass: 'not_triggered', detail: '성공 응답 — 오류·Timeout 경로 미발생(fixture 게이트 HRFCO-ERR/TMO 케이스로 검증됨)' });
  // fixture 비교는 표본 관측소 컨텍스트로 수행 — 실호출 결과 구조와 키 집합·타입만 비교한다.
  const sampleStation = { admin_code: '99999', official_station_code: 'SAMPLE-ST-01', official_station_name: '표본 관측지점(POC)', river_name: '표본하천' };
  const fixtureMapped = hrfco.mapHrfcoFixturePayload(loadFixture('hrfco_hydrology', 'representative_response.json'), { adminCode: '99999', station: sampleStation });
  const compared = compareStructure(observations, fixtureMapped.observations);
  return { checks, compared, fallback, warning: result.warning, record_count: observations.length };
}

async function runUneRag(args) {
  const query = args.query ?? '호우 침수 대응 사례';
  let result;
  try {
    networkAllowed = true;
    // searchUneRag는 내부 catch로 예외를 전파하지 않고 warning Fallback을 반환한다.
    result = await uneRag.searchUneRag({ query });
  } finally {
    networkAllowed = false;
  }
  const results = result.results ?? [];
  const fallback = results.length === 0 && result.warning
    ? { converged: true, warning: result.warning }
    : null;
  const checks = [];
  const push = (check, pass, detail) => checks.push({ check, pass, ...(detail ? { detail } : {}) });
  push('records_present', results.length > 0, `정규화 Passage ${results.length}건`);
  push('data_status_actual', results.length > 0 && results.every((item) => item.data_status === 'actual'));
  push('source_type_une_rag_passage', results.length > 0 && results.every((item) => item.source_type === 'UNE_RAG_PASSAGE'), 'source_provider 대응: source_type=UNE_RAG_PASSAGE');
  push('evidence_id_present', results.length > 0 && results.every((item) => typeof item.evidence_id === 'string' && item.evidence_id.length > 0));
  push('observed_at_present', 'not_applicable', 'Passage 검색결과 계약에는 관측시각 필드가 없음 — Observation 계약이 아닌 EvidenceItem 계약');
  checks.push(fallback
    ? { check: 'error_timeout_warning_fallback', pass: true, detail: '오류·Timeout이 예외 전파 없이 연계별 warning Fallback으로 수렴함' }
    : { check: 'error_timeout_warning_fallback', pass: 'not_triggered', detail: '성공 응답 — 오류·Timeout 경로 미발생(fixture 게이트 UNERAG-ERR/TMO 케이스로 검증됨)' });
  const fixtureMapped = uneRag.mapUneRagFixturePayload(loadFixture('une_rag', 'representative_response.json'));
  const compared = compareStructure(results, fixtureMapped.results);
  return { checks, compared, fallback, warning: result.warning, record_count: results.length };
}

const RUNNERS = { kma_nowcast: runKma, hrfco_hydrology: runHrfco, une_rag: runUneRag };

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.provider) {
    console.error('사용법: node tests/provider/provider_shadow_gate.cjs --provider kma_nowcast|hrfco_hydrology|une_rag [--admin-code CODE] [--query TEXT]');
    process.exit(2);
  }
  if (!SUPPORTED.includes(args.provider)) {
    console.error(`지원하지 않는 provider: ${args.provider} (지원: ${SUPPORTED.join(', ')})`);
    process.exit(2);
  }
  // 실 fetch 함수 require 확인 — 지정 provider 외에는 require만 하고 실행하지 않는다.
  assert(typeof kma.fetchKmaNowcast === 'function', 'fetchKmaNowcast require 실패');
  assert(typeof hrfco.fetchHrfcoHydrology === 'function', 'fetchHrfcoHydrology require 실패');
  assert(typeof uneRag.searchUneRag === 'function', 'searchUneRag require 실패');
  assert(typeof uneRag.probeUneRagOpenApi === 'function', 'probeUneRagOpenApi require 실패');

  const executedAt = new Date().toISOString();
  const heldReason = heldReasonFor(args.provider, args);
  if (heldReason) {
    assert(fetchCallCount === 0, `HELD 판정 중 네트워크 호출 ${fetchCallCount}건 감지 — 보류 시 실호출 0건이어야 합니다.`);
    mergeAndWrite({
      provider_id: args.provider,
      executed: false,
      status: 'HELD',
      held_reason: heldReason,
      checks: [],
      compared_with_fixture: null,
      network_calls: fetchCallCount,
      executed_at: executedAt,
    });
    console.log(`HELD provider shadow gate: ${args.provider} — ${heldReason} (network calls: ${fetchCallCount})`);
    process.exit(0);
  }

  const outcome = await RUNNERS[args.provider](args);
  const contractPassed = outcome.checks.every((item) => item.pass === true || item.pass === 'not_applicable' || item.pass === 'not_triggered');
  const shadowPassed = contractPassed && outcome.record_count > 0 && !outcome.fallback && outcome.compared.structurally_compatible;
  const entry = {
    provider_id: args.provider,
    executed: true,
    status: shadowPassed ? 'SHADOW_PASSED' : 'FAILED',
    checks: outcome.checks,
    compared_with_fixture: outcome.compared,
    ...(outcome.warning ? { warning: outcome.warning } : {}),
    ...(outcome.fallback ? { fallback: outcome.fallback } : {}),
    network_calls: fetchCallCount,
    executed_at: executedAt,
    note: 'SHADOW_PASSED는 SELECTABLE/DEFAULT 전환이 아님 — 승격은 승인 기반으로만 진행(docs/27 §3).',
  };
  mergeAndWrite(entry);
  if (shadowPassed) {
    console.log(`SHADOW_PASSED provider shadow gate: ${args.provider} (records: ${outcome.record_count}, network calls: ${fetchCallCount})`);
    process.exit(0);
  }
  console.error(`FAILED provider shadow gate: ${args.provider} — ${outcome.warning ?? '계약 검증 또는 구조 비교 실패'} (network calls: ${fetchCallCount})`);
  process.exit(1);
}

main().catch((error) => {
  console.error('FAIL provider shadow gate:', error && error.stack ? error.stack : error);
  process.exit(1);
});
