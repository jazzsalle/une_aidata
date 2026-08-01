import type { Observation } from '../contracts';
import { env } from '../env';

type Json = Record<string, unknown>;
interface StationMapping {
  admin_code: string;
  official_station_code?: string | null;
  official_station_name?: string | null;
  river_name?: string | null;
}

function timeoutMs(): number {
  const value = Number(env('HRFCO_TIMEOUT_MS') ?? '12000');
  return Number.isFinite(value) ? Math.max(1000, value) : 12000;
}

function parseStationMap(): Record<string, StationMapping> {
  const raw = env('HRFCO_STATION_MAP_JSON');
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (Array.isArray(value)) {
      return Object.fromEntries(value.filter((item): item is StationMapping => Boolean(item && typeof item === 'object' && 'admin_code' in item)).map((item) => [item.admin_code, item]));
    }
    if (value && typeof value === 'object') return value as Record<string, StationMapping>;
  } catch {
    return {};
  }
  return {};
}

function arrayFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const row = payload as Json;
  for (const key of ['items', 'item', 'results', 'result', 'data', 'list', 'records', 'content', 'body', 'response']) {
    const value = row[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = arrayFromPayload(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

function value(row: Json, keys: string[]): unknown {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
}
function numeric(row: Json, keys: string[]): number | undefined {
  const candidate = value(row, keys);
  if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  if (typeof candidate === 'string' && candidate.trim() && Number.isFinite(Number(candidate))) return Number(candidate);
}
function stringValue(row: Json, keys: string[]): string | undefined {
  const candidate = value(row, keys);
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
}
function normalizeTimestamp(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (/^\d{12}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:00+09:00`;
  if (/^\d{10}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:00:00+09:00`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}
function join(base: string, path: string): string { return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`; }
function replaceTemplate(path: string, stationCode: string): string {
  return path.replaceAll('{stationCode}', encodeURIComponent(stationCode)).replaceAll('{station_code}', encodeURIComponent(stationCode));
}

export function hrfcoConfigured(adminCode?: string): boolean {
  const base = env('HRFCO_API_BASE_URL');
  const path = env('HRFCO_WATERLEVEL_PATH');
  const key = env('HRFCO_SERVICE_KEY');
  if (!base || !path || !key) return false;
  if (!adminCode) return true;
  return Boolean(parseStationMap()[adminCode]?.official_station_code);
}

export function hydrologyStationStatus(adminCode: string): { configured: boolean; station?: StationMapping; warning?: string } {
  const station = parseStationMap()[adminCode];
  if (!station?.official_station_code) return { configured: false, station, warning: `홍수통제소 공식 관측소 코드 미확정: ${adminCode}` };
  if (!hrfcoConfigured()) return { configured: false, station, warning: '홍수통제소 Endpoint 또는 인증키 미설정' };
  return { configured: true, station };
}

export async function fetchHrfcoHydrology(adminCode: string, referenceTime = new Date()): Promise<{ observations: Observation[]; warning?: string; station?: StationMapping }> {
  const status = hydrologyStationStatus(adminCode);
  if (!status.configured || !status.station?.official_station_code) return { observations: [], warning: status.warning, station: status.station };
  const base = env('HRFCO_API_BASE_URL')!;
  const template = env('HRFCO_WATERLEVEL_PATH')!;
  const endpoint = new URL(join(base, replaceTemplate(template, status.station.official_station_code)));
  const keyName = env('HRFCO_SERVICE_KEY_PARAM') ?? 'serviceKey';
  const stationName = env('HRFCO_STATION_PARAM') ?? 'stationCode';
  if (!template.includes('{stationCode}') && !template.includes('{station_code}')) endpoint.searchParams.set(stationName, status.station.official_station_code);
  endpoint.searchParams.set(keyName, env('HRFCO_SERVICE_KEY')!);
  const response = await fetch(endpoint, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs()) });
  if (!response.ok) throw new Error(`홍수통제소 HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) throw new Error(`홍수통제소 응답형식 미지원: ${contentType || 'unknown'}`);
  const payload = await response.json() as unknown;
  const rows = arrayFromPayload(payload);
  const latest = rows.map((item) => (item && typeof item === 'object' ? item as Json : {})).find((row) => numeric(row, ['wl', 'waterLevel', 'water_level', 'wlev', 'level']) !== undefined || numeric(row, ['fw', 'flow', 'flowRate', 'flow_rate', 'q']) !== undefined);
  if (!latest) return { observations: [], warning: '홍수통제소 응답에서 수위·유량 필드를 찾지 못했습니다.', station: status.station };
  const observedAt = normalizeTimestamp(stringValue(latest, ['ymdhm', 'obsdt', 'observed_at', 'datetime', 'tm', 'dateTime']), referenceTime.toISOString());
  const stationCode = stringValue(latest, ['wlobscd', 'stationCode', 'station_code', 'obsCode']) ?? status.station.official_station_code;
  const waterLevel = numeric(latest, ['wl', 'waterLevel', 'water_level', 'wlev', 'level']);
  const flow = numeric(latest, ['fw', 'flow', 'flowRate', 'flow_rate', 'q']);
  const observations: Observation[] = [];
  if (waterLevel !== undefined) observations.push({ observation_id: `HRFCO-${stationCode}-WL-${observedAt}`, type: 'WATER_LEVEL', station_id: stationCode, name: status.station.official_station_name ?? `${status.station.river_name ?? '하천'} 수위`, value: waterLevel, unit: env('HRFCO_WATERLEVEL_UNIT') ?? 'm', observed_at: observedAt, source_provider: 'HRFCO_STANDARD_HYDROLOGY_DB', value_status: 'actual', official_data: true });
  if (flow !== undefined) observations.push({ observation_id: `HRFCO-${stationCode}-FLOW-${observedAt}`, type: 'FLOW_RATE', station_id: stationCode, name: status.station.official_station_name ?? `${status.station.river_name ?? '하천'} 유량`, value: flow, unit: env('HRFCO_FLOW_UNIT') ?? '㎥/s', observed_at: observedAt, source_provider: 'HRFCO_STANDARD_HYDROLOGY_DB', value_status: 'actual', official_data: true });
  return { observations, station: status.station };
}
