import type { CurrentSituation, EvidenceItem } from '../contracts.js';
import { calculatePriorityAreas } from './priorityAreas.js';
import { searchSimilarEvents } from './similarEvents.js';
import { seed } from '../seeds.js';

// 화면에서 선택한 대상(위험지구·유사사례·하천)을 질의와 함께 전달받기 위한 요청 부가필드.
// contracts.ts(응답 계약)는 변경하지 않으며 요청 본문 확장으로만 수용한다.
export type AgentContextKind = 'district' | 'similar_event' | 'river';
export interface AgentContextItem { kind: AgentContextKind; id: string; label: string; detail?: string; admin_code?: string; }

type Rec = Record<string, unknown>;
const CONTEXT_KINDS = new Set<AgentContextKind>(['district', 'similar_event', 'river']);
const MAX_CONTEXT_ITEMS = 10;
const MAX_EVIDENCE_ITEMS = 10;

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const rec = (value: unknown): Rec => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {});
const recs = (value: unknown): Rec[] => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object').map((item) => item as Rec) : []);
const strs = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
const firstPage = (value: unknown): number | null => (Array.isArray(value) ? num(value[0]) : num(value));
const fmt = (value: number | null): string => (value === null ? '미기재' : value.toLocaleString('ko-KR'));
const dateOnly = (value: string): string => (value.length >= 10 ? value.slice(0, 10) : value);
/** 한글 종성 유무에 따른 조사 선택. 한글이 아니면 병기형(을(를))으로 둔다. */
function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return `${withFinal}(${withoutFinal})`;
  return (code - 0xac00) % 28 !== 0 ? withFinal : withoutFinal;
}

/** 요청 본문의 context를 화면 계약(kind/id/label)에 맞게 정규화한다. 잘못된 항목은 조용히 제외한다. */
export function normalizeAgentContext(value: unknown): AgentContextItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => rec(item))
    .filter((item) => CONTEXT_KINDS.has(str(item.kind) as AgentContextKind) && (str(item.id) || str(item.label)))
    .slice(0, MAX_CONTEXT_ITEMS)
    .map((item) => {
      const normalized: AgentContextItem = { kind: str(item.kind) as AgentContextKind, id: str(item.id), label: str(item.label) || str(item.id) };
      if (str(item.detail)) normalized.detail = str(item.detail);
      if (str(item.admin_code)) normalized.admin_code = str(item.admin_code);
      return normalized;
    });
}

interface Intent { river: boolean; threshold: boolean; district: boolean; damage: boolean; procedure: boolean; station: boolean; }
const KEYWORDS: Record<keyof Intent, string[]> = {
  river: ['하천', '유량', '홍수량', '본류', '수계', '제방', '월류'],
  threshold: ['기준유량', '특보', '주의보', '경보', '임계', '기준치', '발령'],
  district: ['위험지구', '저지대', '침수', '내수', '사면', '산사태', '토사', '위험'],
  damage: ['피해', '과거', '이력', '사례', '사상', '복구'],
  procedure: ['절차', '매뉴얼', '대응', '조치', '행동요령', '보고'],
  station: ['수위계', '관측소', '수위표', '모니터링', '관측', '수위'],
};

/** 규칙 기반(비-LLM) 키워드 축 인식. 매칭 실패는 기본 응답으로 흡수한다. */
function detectIntent(message: string): Intent {
  const text = message.toLowerCase();
  const has = (key: keyof Intent) => KEYWORDS[key].some((word) => text.includes(word));
  return { river: has('river'), threshold: has('threshold'), district: has('district'), damage: has('damage'), procedure: has('procedure'), station: has('station') };
}

/** "특보 유량이 1100인데 …" 형태의 질의 유량값(㎥/s 추정)을 추출한다. */
function extractFlowValue(message: string, intent: Intent): number | null {
  if (!intent.threshold && !intent.river) return null;
  const matches = message.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  const values = matches.map((token) => Number(token.replace(/,/g, ''))).filter((value) => Number.isFinite(value) && value >= 50);
  return values.length ? Math.max(...values) : null;
}

const DISTRICT_TYPE_HINTS: Array<{ words: string[]; type: string }> = [
  { words: ['저지대', '내수', '하수', '역류', '배수'], type: '내수재해' },
  { words: ['산사태', '사면', '급경사'], type: '사면재해' },
  { words: ['토사'], type: '토사재해' },
  { words: ['하천', '제방', '월류'], type: '하천재해' },
  { words: ['대설', '폭설'], type: '대설재해' },
];

interface ResolvedTargets {
  districts: Rec[]; rivers: Rec[]; eventIds: string[];
  contextLabels: string[]; fromContext: boolean; riverExplicit: boolean; typeHint: string | null;
}

function resolveTargets(situation: CurrentSituation, message: string, context: AgentContextItem[], intent: Intent): ResolvedTargets {
  const allDistricts = seed.districts.districts as unknown as Rec[];
  const allRivers = seed.rivers.rivers as unknown as Rec[];
  const localDistricts = allDistricts.filter((item) => str(item.admin_code) === situation.admin_code);
  const localRivers = allRivers.filter((item) => str(item.admin_code) === situation.admin_code);
  const districts: Rec[] = []; const rivers: Rec[] = []; const eventIds: string[] = []; const contextLabels: string[] = [];
  let riverExplicit = false;
  const pushDistrict = (row?: Rec) => { if (row && !districts.some((item) => str(item.district_code) === str(row.district_code))) districts.push(row); };
  const pushRiver = (row?: Rec, explicit = false) => {
    if (!row) return;
    if (explicit) riverExplicit = true;
    if (!rivers.some((item) => str(item.river_id) === str(row.river_id))) rivers.push(row);
  };

  for (const item of context) {
    contextLabels.push(item.label || item.id);
    if (item.kind === 'district') pushDistrict(allDistricts.find((row) => str(row.district_code) === item.id || str(row.district_name) === item.label));
    if (item.kind === 'river') pushRiver(allRivers.find((row) => str(row.river_id) === item.id || str(row.name) === item.label), true);
    if (item.kind === 'similar_event' && item.id) eventIds.push(item.id);
  }
  const fromContext = districts.length > 0 || rivers.length > 0 || eventIds.length > 0;

  // 질의 문장에서의 직접 언급(주어가 있는 질문) 인식
  for (const row of localDistricts.concat(allDistricts)) {
    const name = str(row.district_name);
    if (name.length >= 2 && message.includes(name)) pushDistrict(row);
  }
  for (const row of allRivers) {
    const name = str(row.name);
    if (name.length >= 2 && message.includes(name)) pushRiver(row, true);
  }

  // 유형 힌트("저지대 위험지구 보여줘")로 대상 지구를 좁힌다.
  const typeHint = DISTRICT_TYPE_HINTS.find((hint) => hint.words.some((word) => message.includes(word)))?.type ?? null;
  if (!districts.length && typeHint && intent.district) {
    for (const row of localDistricts.filter((item) => str(item.disaster_type) === typeHint).slice(0, 3)) pushDistrict(row);
  }

  // 선택 지구가 인용하는 하천을 함께 해석해 "여긴 왜 위험해?" 같은 무주어 질의를 성립시킨다.
  for (const district of [...districts]) {
    const riverName = str(district.river_name);
    if (!riverName) continue;
    pushRiver(allRivers.find((row) => str(row.name) && riverName.startsWith(str(row.name))));
  }
  // 하천·기준유량·관측 질의는 대상 하천이 없으면 관할 하천을 사용한다.
  if (!rivers.length && (intent.river || intent.threshold || intent.station)) for (const row of localRivers) pushRiver(row);

  return { districts, rivers, eventIds, contextLabels, fromContext, riverExplicit, typeHint };
}

const evidenceItem = (item: EvidenceItem): EvidenceItem => item;

function districtEvidence(district: Rec): EvidenceItem[] {
  const code = str(district.district_code); const name = str(district.district_name);
  const out: EvidenceItem[] = [];
  const ledger = rec(district.evidence);
  if (str(ledger.doc_title)) {
    out.push(evidenceItem({
      evidence_id: `EVD-DISTRICT-${code}`, source_type: 'PLAN_DISTRICT_LEDGER',
      title: `${str(ledger.doc_title)} — ${name}`,
      excerpt: strs(district.risk_factors).slice(0, 2).join(' / ') || str(district.grade) || null,
      document_id: str(ledger.source_asset_id) || null, page: num(ledger.pdf_page) ?? num(ledger.page),
      passage_id: null, score: null, url: null, data_status: 'provisional',
    }));
  }
  recs(district.risk_thresholds).forEach((threshold, index) => {
    const source = rec(threshold.evidence);
    if (!str(source.doc_title) && !str(source.table)) return;
    out.push(evidenceItem({
      evidence_id: `EVD-DISTRICT-${code}-THR-${index + 1}`, source_type: 'PLAN_RISK_THRESHOLD',
      title: [str(source.doc_title) || name, str(source.table)].filter(Boolean).join(' · '),
      excerpt: `${str(threshold.target)} ${str(threshold.operator)} ${num(threshold.value) ?? ''}${str(threshold.unit)} — ${str(threshold.basis)}`.trim(),
      document_id: str(source.source_asset_id) || null, page: num(source.pdf_page) ?? num(source.page),
      passage_id: null, score: null, url: null, data_status: 'provisional',
    }));
  });
  recs(district.damage_events).forEach((event, index) => {
    const source = rec(event.evidence);
    if (!str(source.doc_title) && !str(source.passage_id)) return;
    out.push(evidenceItem({
      evidence_id: `EVD-DISTRICT-${code}-DMG-${index + 1}`, source_type: 'PLAN_DAMAGE_HISTORY',
      title: [str(source.doc_title) || name, str(source.chapter)].filter(Boolean).join(' · '),
      excerpt: `${str(event.occurred)} ${str(event.event_name)} — ${str(event.description)}`.trim(),
      document_id: str(source.source_asset_id) || null, page: num(source.page) ?? num(source.pdf_page),
      passage_id: str(source.passage_id) || null, score: null, url: null, data_status: 'provisional',
    }));
  });
  return out;
}

function stationDesignFlood(station: Rec): number | null {
  const direct = num(station.design_flood_m3s);
  if (direct !== null) return direct;
  const versions = recs(station.design_floods);
  const adopted = versions.find((item) => item.adopted === true) ?? versions[versions.length - 1];
  return adopted ? num(adopted.design_flood_m3s) : null;
}

function stationLabel(station: Rec): string {
  const no = str(station.station_no) || str(station.flow_segment_no);
  return `${str(station.station_name) || str(station.station_code)}(${str(station.station_code)}${no ? `, ${no}` : ''})`;
}

/** 홍수특보 판단 기준지점(계획문서 내부 산정지점). 미지정 하천은 계획홍수량 최대지점을 참고지점으로 사용한다. */
function warningStation(river: Rec): { station: Rec | null; designated: boolean } {
  const stations = recs(river.stations);
  const reference = rec(river.warning_reference_station);
  const code = str(reference.station_code);
  const matched = code ? stations.find((item) => str(item.station_code) === code) : undefined;
  if (matched) return { station: matched, designated: true };
  const fallback = stations.reduce<Rec | null>((best, item) => ((stationDesignFlood(item) ?? -1) > (best ? stationDesignFlood(best) ?? -1 : -1) ? item : best), null);
  return { station: fallback, designated: false };
}

function riverEvidence(river: Rec, stations: Rec[]): EvidenceItem[] {
  const id = str(river.river_id); const plan = str(river.plan_name) || str(river.name);
  const out: EvidenceItem[] = [];
  const profile = rec(river.profile_evidence);
  if (str(profile.doc) || str(profile.table)) {
    out.push(evidenceItem({
      evidence_id: `EVD-RIVER-${id}-PROFILE`, source_type: 'RIVER_PLAN_PROFILE',
      title: [plan, str(profile.table)].filter(Boolean).join(' · '),
      excerpt: `${str(river.name)}(${str(river.grade)}) 유역면적 ${fmt(num(river.basin_area_km2))}㎢ · 연장 ${fmt(num(river.length_km))}km · 계획빈도 ${str(river.design_frequency_yr)} — ${str(profile.doc)} ${str(profile.chapter_page)}쪽`,
      document_id: str(profile.source_asset_id) || str(river.source_asset_id) || null, page: firstPage(profile.pdf_page),
      passage_id: null, score: null, url: null, data_status: 'provisional',
    }));
  }
  for (const station of stations) {
    const source = rec(station.evidence);
    const warning = rec(station.flood_warning);
    out.push(evidenceItem({
      evidence_id: `EVD-RIVER-${id}-${str(station.station_code)}`, source_type: 'RIVER_PLAN_DESIGN_FLOOD',
      title: [plan, str(source.table)].filter(Boolean).join(' · ') || `${plan} 계획홍수량`,
      excerpt: `${stationLabel(station)} 계획홍수량 ${fmt(stationDesignFlood(station))}㎥/s · 주의보 기준유량 ${fmt(num(warning.advisory_m3s))}㎥/s · 경보 기준유량 ${fmt(num(warning.alert_m3s))}㎥/s (계획홍수량 50%·70% 산출 참고값, 고시 발령값 아님)`,
      document_id: str(source.source_asset_id) || str(river.source_asset_id) || null, page: firstPage(source.pdf_page),
      passage_id: null, score: null, url: null, data_status: 'provisional',
    }));
  }
  return out;
}

function dedupeEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.evidence_id) ? false : (seen.add(item.evidence_id), true))).slice(0, MAX_EVIDENCE_ITEMS);
}

type MapAction = { action: string; target_id?: string; layer_id?: string; visible?: boolean };
function geoIdSet(): Set<string> {
  return new Set((seed.geo.features as unknown as Rec[]).map((feature) => str(rec(feature.properties).id)).filter(Boolean));
}

/** 질문 문자열 정규화 — 공백·문장부호를 걷어 CQ 질문과 느슨하게 대조한다. */
function normalizeQuestion(text: string): string {
  return String(text ?? '').replace(/[\s?.,·]/g, '');
}

interface MetaCqEntry {
  cq_key: string; plan_type: string; set_label: string; admin_code: string; admin_name: string;
  cq_id: string; question: string; answerable: boolean;
  answer_passages: Array<{ passage_text: string; class_iri: string; instance_kind: string; provenance: Record<string, unknown> }>;
  links: Array<Record<string, unknown>>;
}

/** T3Q 메타 표본 지역에서 역량질문(CQ)이 들어오면 준비된 인스턴스 답을 돌려준다.

    T3Q 실 API 가 아직 붙지 않아, 실제 올 예상 데이터(메타 인스턴스)의 passage 를 그대로
    나열하는 Mock 시범이다 — 값을 요약·재계산하지 않는다. 매칭은 질문 전체의 정규화 일치
    또는 앞 12자 이상 부분일치다(추천질문 버튼이 CQ 원문을 넣으므로 보통 정확히 맞는다). */
function matchMetaCq(situation: CurrentSituation, message: string): MetaCqEntry | null {
  if (!situation.situation_id.includes('-META-')) return null;
  const entries = (seed.metaDemoCqAnswers?.entries ?? []) as unknown as MetaCqEntry[];
  const asked = normalizeQuestion(message);
  if (asked.length < 8) return null;
  let best: MetaCqEntry | null = null;
  for (const entry of entries) {
    if (entry.admin_code !== situation.admin_code || !entry.answerable) continue;
    const q = normalizeQuestion(entry.question);
    if (q === asked || q.includes(asked) || asked.includes(q)) return entry;
    if (!best && asked.length >= 12 && (q.startsWith(asked.slice(0, 12)) || asked.startsWith(q.slice(0, 12)))) best = entry;
  }
  return best;
}

export async function buildAgentResponse(situation: CurrentSituation, message: string, context: AgentContextItem[] = []) {
  const metaCq = matchMetaCq(situation, message);
  if (metaCq) {
    const passages = metaCq.answer_passages.slice(0, 3);
    const answer = [
      `〔표본〕 ${metaCq.set_label} ${metaCq.plan_type} 보고서의 메타 인스턴스에서 찾은 근거입니다 (${metaCq.cq_id}).`,
      ...passages.map((p, i) => `${i + 1}. ${p.passage_text}`),
    ].join('\n');
    return {
      message_id: `MSG-${crypto.randomUUID()}`,
      answer,
      user_message: message,
      context,
      priority_areas: [],
      similar_events: [],
      procedures: [],
      map_actions: [],
      links: metaCq.links,
      meta_demo: true,
      evidence: passages.map((p) => ({
        kind: 'meta_instance',
        ref: String(p.provenance?.instance_id ?? ''),
        description: `${String(p.provenance?.source_file ?? '')} ${p.provenance?.page ? `${p.provenance.page}쪽` : ''}`.trim(),
      })) as unknown as EvidenceItem[],
      warnings: ['T3Q 메타 인스턴스 표본(Mock) 응답입니다 — 실 T3Q API 연계 전 시범이며 실지역 공식자료가 아닙니다.'],
      limitations: ['답변은 메타 인스턴스 passage 원문 나열이며 요약·재계산하지 않았습니다.',
        '표본 지역(대구 서구·정읍·김해)은 비교본이며 POC 대상지역 검증자료가 아닙니다.'],
      operator_confirmation_required: true,
    };
  }
  const priority = calculatePriorityAreas(situation);
  const similar = await searchSimilarEvents(situation, 3);
  const procedures = (seed.procedures.procedures as Array<Record<string, unknown>>).filter((item) => Array.isArray(item.target_admin_codes) && item.target_admin_codes.includes(situation.admin_code)).slice(0, 5);
  const first = priority.areas[0];

  const intent = detectIntent(message);
  const targets = resolveTargets(situation, message, context, intent);
  const flowValue = extractFlowValue(message, intent);
  const useRiver = targets.rivers.length > 0 && (targets.riverExplicit || intent.river || intent.threshold || intent.station || targets.fromContext || flowValue !== null);
  const enriched = targets.districts.length > 0 || targets.eventIds.length > 0 || useRiver;

  // 선택 대상을 앞으로 올리되 순위(rank)·점수는 산정값 그대로 보존한다.
  const focusCodes = new Set(targets.districts.map((item) => str(item.district_code)));
  const priorityAreas = focusCodes.size
    ? [...priority.areas].sort((a, b) => Number(focusCodes.has(b.spatial_object_id)) - Number(focusCodes.has(a.spatial_object_id)))
    : priority.areas;
  const eventFocus = new Set(targets.eventIds);
  const similarEvents = eventFocus.size
    ? [...similar.events].sort((a, b) => Number(eventFocus.has(b.event_id)) - Number(eventFocus.has(a.event_id)))
    : similar.events;
  const best = similarEvents[0];

  const sentences: string[] = [];
  const evidence: EvidenceItem[] = [];
  const extraWarnings: string[] = [];
  const extraLimitations: string[] = [];

  if (enriched && targets.contextLabels.length) {
    const labels = targets.contextLabels.join(' · ');
    sentences.push(`선택하신 ${labels}${josa(labels, '을', '를')} 질의와 함께 해석했습니다.`);
  } else if (enriched) {
    const inferred = [...targets.districts.map((item) => str(item.district_name)), ...(useRiver ? targets.rivers.map((item) => str(item.name)) : [])].filter(Boolean).slice(0, 3);
    if (inferred.length) { const label = inferred.join(' · '); sentences.push(`질의에서 ${label}${josa(label, '을', '를')} 대상으로 인식했습니다.`); }
  }

  // 위험지구 축: 계획자료 위험요인·임계값·저감대책 참고정보
  targets.districts.slice(0, 2).forEach((district, districtIndex) => {
    const code = str(district.district_code); const name = str(district.district_name);
    const area = priority.areas.find((item) => item.spatial_object_id === code);
    const factors = strs(district.risk_factors).slice(0, 2);
    const threshold = recs(district.risk_thresholds)[0];
    const parts = [`${name}${josa(name, '은', '는')} ${str(district.disaster_type)} 위험지구로 ${str(district.location) || str(district.admin_name)}에 위치합니다.`];
    if (factors.length) parts.push(`계획자료 위험요인은 ${factors.join(' / ')}입니다.`);
    if (threshold) parts.push(`계획 임계값 참고: ${str(threshold.target)} ${str(threshold.operator)} ${num(threshold.value) ?? ''}${str(threshold.unit)}(${str(threshold.basis)}).`);
    if (districtIndex === 0 && strs(district.mitigation).length) parts.push(`계획된 저감대책은 ${strs(district.mitigation).slice(0, 3).join(' / ')}이며 사업비 ${fmt(num(district.cost_million_krw))}백만원·우선순위 ${str(district.priority) || '미기재'}입니다.`);
    if (area) parts.push(`현재 조건 기준 우선 확인 순위는 ${area.rank}위(참고점수 ${area.score})입니다.`);
    else { parts.push('현재 조건 상위 우선 확인지역 목록에는 포함되지 않았습니다.'); extraWarnings.push(`${name}${josa(name, '은', '는')} 현재 조건 상위 5개 우선 확인지역 목록에 포함되지 않아 목록에는 표시되지 않습니다.`); }
    if (intent.damage || targets.fromContext) {
      const damages = recs(district.damage_events);
      if (damages.length) parts.push(`계획자료에 기록된 과거 참고 피해사례는 ${damages.length}건(${damages.slice(0, 2).map((item) => `${str(item.occurred)} ${str(item.event_name)}`).join(', ')})입니다.`);
    }
    sentences.push(parts.join(' '));
    evidence.push(...districtEvidence(district));
  });

  // 하천 축: 하천기본계획 제원·계획홍수량·주의보/경보 기준유량(계획문서값)
  if (useRiver) {
    for (const river of targets.rivers.slice(0, 2)) {
      const { station, designated } = warningStation(river);
      const stations = recs(river.stations);
      const parts = [`${str(river.name)}(${str(river.grade)}, ${str(river.admin_name)})은 ${str(river.plan_name)} 기준 유역면적 ${fmt(num(river.basin_area_km2))}㎢ · 연장 ${fmt(num(river.length_km))}km · 계획빈도 ${str(river.design_frequency_yr)}입니다.`];
      if (station) {
        const warning = rec(station.flood_warning);
        parts.push(`${designated ? '홍수특보 판단 기준지점' : '계획홍수량 최대지점(기준지점 미지정)'}인 ${stationLabel(station)}의 계획홍수량은 ${fmt(stationDesignFlood(station))}㎥/s이며, 주의보 기준유량 ${fmt(num(warning.advisory_m3s))}㎥/s·경보 기준유량 ${fmt(num(warning.alert_m3s))}㎥/s(계획홍수량의 50%·70% 산출값)입니다.`);
      }
      if (intent.station) {
        parts.push(`${str(river.name)} 계획 산정지점은 ${stations.length}개소(${stations.slice(0, 4).map((item) => stationLabel(item)).join(', ')})이며, 모니터링 대상 관측소는 홍수통제소 공식 관측소 목록으로 확인해야 합니다.`);
        extraWarnings.push('하천기본계획 산정지점 코드는 계획 내부 코드이며 홍수통제소 공식 관측소 코드가 아닙니다.');
      }
      if (flowValue !== null && station) {
        const warning = rec(station.flood_warning);
        const advisory = num(warning.advisory_m3s); const alert = num(warning.alert_m3s);
        const level = alert !== null && flowValue >= alert ? '경보 기준유량 이상' : advisory !== null && flowValue >= advisory ? '주의보 기준유량 이상·경보 기준유량 미만' : '주의보 기준유량 미만';
        parts.push(`질의 유량 ${fmt(flowValue)}㎥/s는 ${stationLabel(station)} 기준 ${level} 구간에 해당합니다(계획문서 기준값 대조 참고 비교).`);
      }
      parts.push('위 값은 하천기본계획 판독 전사값이며 관측 실황이나 고시 발령값이 아닙니다.');
      sentences.push(parts.join(' '));
      const extraStations = intent.station || flowValue !== null ? 2 : 0;
      const focusStations = station ? [station, ...stations.filter((item) => item !== station).slice(0, extraStations)] : stations.slice(0, 2);
      evidence.push(...riverEvidence(river, focusStations));
    }
    extraWarnings.push('주의보·경보 기준유량은 계획홍수량의 50%·70% 산출 참고값이며 고시된 홍수특보 발령값이 아닙니다.');
    if (flowValue !== null) extraLimitations.push('질의 유량 비교는 계획문서 기준값과의 단순 대조 참고정보이며 홍수특보 발령 판단이나 자동 조치결정이 아닙니다.');
  }

  // 유사사례·절차 축
  if (enriched && (intent.damage || eventFocus.size) && best) {
    sentences.push(`참고 유사사례는 '${best.event_name}'(${dateOnly(best.occurred_from)}, 유사도 ${best.similarity_score}점)이며 과거 참고자료입니다.`);
  }
  if (enriched && intent.procedure && procedures.length) {
    sentences.push(`관련 대응절차 참고 템플릿은 ${procedures.length}건이며 첫 단계는 '${str(procedures[0]?.action_title)}'입니다(부산 북구청 매뉴얼 기반 잠정 템플릿).`);
  }

  const legacyAnswer = first
    ? `현재 입력·관측 조건을 계획 위험지식과 비교하여 ${first.name}을 우선 확인 후보 1순위로 제시합니다.${best ? ` 유사 참고사례는 '${best.event_name}'이며 사건 유사도는 ${best.similarity_score}점입니다.` : ''} 본 결과는 공식 위험도나 피해예측이 아니라 담당자 현장 확인을 지원하는 상대순위입니다.`
    : '현재 조건에서 우선 확인지역을 산정하지 못했습니다.';
  const unresolvedLabels = !enriched && targets.contextLabels.length ? targets.contextLabels.join(' · ') : null;
  if (unresolvedLabels) extraWarnings.push(`선택하신 ${unresolvedLabels}에 해당하는 계획자료 대상을 확인하지 못해 현재 조건 기준 기본 결과를 제시합니다.`);
  const answer = enriched && sentences.length
    ? `${sentences.join(' ')} ${first ? `현재 조건 우선 확인 후보 1순위는 ${first.name}입니다.` : ''} 본 답변은 계획문서·Seed 기반 참고정보이며 공식 위험도·피해예측·자동 조치결정이 아닙니다.`.replace(/\s+/g, ' ').trim()
    : unresolvedLabels
      ? `선택하신 ${unresolvedLabels}${josa(unresolvedLabels, '은', '는')} 계획자료에서 확인되지 않아 현재 조건 기준 기본 결과를 제시합니다. ${legacyAnswer}`
      : legacyAnswer;

  // 지도 Action은 GeoJSON에 존재하는 ID만 실행한다.
  const geoIds = geoIdSet();
  const focusDistrictId = targets.districts.map((item) => str(item.district_code)).find((id) => geoIds.has(id)) ?? null;
  const focusRiverId = useRiver ? targets.rivers.map((item) => str(item.river_id)).find((id) => geoIds.has(id)) ?? null : null;
  let mapActions: MapAction[] = [];
  if (enriched && (focusDistrictId || focusRiverId)) {
    // 선택·인식 대상 1개만 이동(fit_bounds)하고 나머지는 레이어 표출로 보조한다.
    mapActions = focusDistrictId
      ? [{ action: 'highlight', target_id: focusDistrictId, layer_id: 'L-RISK' }, { action: 'fit_bounds', target_id: focusDistrictId }, ...(focusRiverId ? [{ action: 'toggle_layer', layer_id: 'L-RIVER', visible: true } as MapAction] : []), { action: 'toggle_layer', layer_id: 'L-FLOOD-TRACE', visible: true }]
      : [{ action: 'highlight', target_id: focusRiverId as string, layer_id: 'L-RIVER' }, { action: 'fit_bounds', target_id: focusRiverId as string }, { action: 'toggle_layer', layer_id: 'L-RIVER', visible: true }];
  } else if (first) {
    mapActions = [{ action: 'highlight', target_id: first.spatial_object_id }, { action: 'fit_bounds', target_id: first.spatial_object_id }, { action: 'toggle_layer', layer_id: 'L-FLOOD-TRACE', visible: true }];
  }

  const responseEvidence = enriched ? dedupeEvidence([...evidence, ...(best?.evidence ?? [])]) : (best?.evidence ?? []);
  const warnings = ['Rule/Seed Agent 응답에 UNE RAG 근거를 구성 가능할 때 결합합니다.', ...similar.warnings, ...[...new Set(extraWarnings)]];
  const limitations = [
    '현재 피해예측 결과가 아닙니다.',
    '피해·복구는 향후 T3Q NDMS 기반 데이터로 교체할 Seed 참고정보입니다.',
    '대응절차는 부산 북구청 매뉴얼 참고 잠정 템플릿입니다.',
    ...(enriched ? ['선택 대상·질의 해석은 규칙 기반 키워드 매칭이며 자연어 이해 모델 판단이 아닙니다.', '자연재해저감 종합계획·하천기본계획 판독값은 계획문서 기반 참고정보이며 관측 실황·공식 위험등급이 아닙니다.'] : []),
    ...[...new Set(extraLimitations)],
  ];

  return {
    message_id: `MSG-${crypto.randomUUID()}`,
    answer,
    user_message: message,
    context,
    priority_areas: priorityAreas,
    similar_events: similarEvents,
    procedures,
    map_actions: mapActions,
    evidence: responseEvidence,
    warnings,
    limitations,
    operator_confirmation_required: true,
  };
}
