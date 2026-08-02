import { envelope } from '../../../http.js';
import { seed } from '../../../seeds.js';
export function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('event_id') ?? 'POC-FLOOD-IMAGE-SAMPLE-001';
  const metrics = seed.floodMaskMetrics as any;
  if (metrics.event_id !== eventId) return envelope({ ...metrics, phases: [] }, { provider:'FloodMaskPixelMetricProvider', dataStatus:'derived', warnings:['해당 Event의 Seed 수계마스크 지표가 없습니다.'] });
  return envelope(metrics,{provider:'FloodMaskPixelMetricProvider',dataStatus:'derived',warnings:['픽셀 기반 상대변화이며 지리면적·피해예측이 아닙니다.']});
}
