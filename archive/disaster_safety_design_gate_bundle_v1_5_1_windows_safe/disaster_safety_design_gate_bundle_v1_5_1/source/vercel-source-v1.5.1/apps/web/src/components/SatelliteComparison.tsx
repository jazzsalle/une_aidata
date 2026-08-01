import { useMemo } from 'react';
import type { FloodMaskMetrics, PhaseSelectionResult, SatelliteAsset, SatelliteEvidenceSet } from '../types/contracts';

const PHASES = [
  { code: 'PRE', title: 'PRE', rule: '사건 시작일 -12일 기준' },
  { code: 'EVENT', title: 'EVENT', rule: '재난 시작~종료 +2일 이내' },
  { code: 'POST', title: 'POST', rule: '재난 종료일 +12일 기준' },
] as const;
function url(asset: SatelliteAsset | null) { return asset?.image_url ?? asset?.thumbnail_url ?? '/seed/satellite-placeholder.svg'; }
function localDate(value?: string | null) { return value ? new Date(value).toLocaleString('ko-KR') : '-'; }
function signed(value:number|null|undefined,suffix=''){ if(value==null)return '-'; return `${value>0?'+':''}${value}${suffix}`; }

export function SatelliteComparison({ satellites, metrics, selectionResults, evidenceSet, selectedSet, onAddToReport }: { satellites: SatelliteAsset[]; metrics: FloodMaskMetrics | null; selectionResults: PhaseSelectionResult[]; evidenceSet: SatelliteEvidenceSet | null; selectedSet?: { asset_ids: string[]; event_id: string; evidence_set_id?:string } | null; onAddToReport?(assetIds: string[], eventId: string, evidenceSet:SatelliteEvidenceSet): void }) {
  const eventId=evidenceSet?.event_id??'POC-FLOOD-IMAGE-SAMPLE-001';
  const sample = useMemo(() => satellites.filter((item) => item.event_id === eventId), [satellites,eventId]);
  const phaseAssets = useMemo(() => PHASES.map((phase) => ({ ...phase, satellite: sample.find((item) => item.phase === phase.code && item.asset_kind === 'SATELLITE') ?? null, mask: sample.find((item) => item.phase === phase.code && item.asset_kind === 'WATER_MASK') ?? null, metric: metrics?.phases.find((item)=>item.phase===phase.code)??null, selection: selectionResults.find((item)=>item.phase===phase.code&&item.asset_kind==='SATELLITE')??null })), [sample,metrics,selectionResults]);
  const assetIds = phaseAssets.flatMap((item) => [item.satellite?.asset_id, item.mask?.asset_id]).filter((id): id is string => Boolean(id));
  const selected = selectedSet?.event_id === eventId && (!evidenceSet||selectedSet.evidence_set_id===evidenceSet.evidence_set_id) && assetIds.every((id) => selectedSet.asset_ids.includes(id));
  return <section className="evidence-section" aria-labelledby="satellite-title">
    <div className="section-heading-row"><div><h2 id="satellite-title">홍수 PRE·EVENT·POST 위성영상·수계마스크</h2><p>위성영상은 VWorld 2D 베이스맵에 오버레이하지 않고 256×256 독립 타일로 표시합니다.</p></div><span className="seed-badge">{evidenceSet?.area.is_target_region?'시범 대상지역':'대상지역 외 POC Seed'} · {evidenceSet?.official_data?'공식자료':'공식자료 아님'}</span></div>
    <div className="phase-rule-summary" role="note"><strong>시점 선정:</strong> PRE는 사건 시작일 -12일, EVENT는 재난 시작~종료 +2일 이내, POST는 EVENT 구간과 겹치지 않도록 재난 종료일 +12일을 기준으로 합니다. 목표일과 실제 촬영일 차이는 별도 표시합니다.</div>
    <div className="flood-phase-grid">{phaseAssets.map((item) => <article className="flood-phase-card" key={item.code} aria-labelledby={`phase-${item.code}`}><header><h3 id={`phase-${item.code}`}>{item.title}</h3><p>{item.rule}</p>{item.selection?<p className="phase-selection-note">선정편차 {signed(item.selection.offset_days_from_target,'일')} · {item.selection.selection_reason}</p>:null}</header><div className="phase-tile-pair">
      <figure><img width="256" height="256" src={url(item.satellite)} alt={`${item.title} 단계 홍수 시연용 흑백 위성영상 256×256 타일`} /><figcaption><strong>위성영상</strong><span>{localDate(item.satellite?.acquired_at)}</span><span>{item.satellite?.source_type === 'derived_seed_from_pre_post' ? 'PRE·POST 기반 생성 Seed' : '사용자 첨부 참고영상'}</span></figcaption></figure>
      <figure><img width="256" height="256" src={url(item.mask)} alt={`${item.title} 단계 수계마스크 256×256 타일, 흰색은 수계영역이고 검은색은 비수계영역`} /><figcaption><strong>수계마스크</strong><span>흰색=수계·침수 표현</span><span>{item.metric?`흰색 픽셀 ${item.metric.water_ratio_pct}% · PRE 대비 ${signed(item.metric.delta_ratio_points_from_pre,'%p')}`:'지표 없음'}</span></figcaption></figure>
    </div></article>)}</div>
    <section className="mask-metrics-panel" aria-labelledby="mask-metrics-title"><h3 id="mask-metrics-title">수계마스크 픽셀 상대변화</h3><p>아래 수치는 256×256 마스크의 흰색 픽셀 비율입니다. 공간해상도와 지리좌표가 없으므로 면적·침수심·피해예측으로 환산하지 않습니다.</p><div className="accessible-data-table-wrap"><table><caption>PRE 대비 수계마스크 픽셀 상대변화</caption><thead><tr><th scope="col">단계</th><th scope="col">흰색 픽셀</th><th scope="col">비율</th><th scope="col">PRE 대비 순증감</th><th scope="col">PRE 대비 비율차</th></tr></thead><tbody>{phaseAssets.map((item)=><tr key={item.code}><th scope="row">{item.code}</th><td>{item.metric?.water_pixels.toLocaleString()??'-'} / 65,536</td><td>{item.metric?`${item.metric.water_ratio_pct}%`:'-'}</td><td>{item.metric?signed(item.metric.net_water_pixels_from_pre,' px'):'-'}</td><td>{item.metric?signed(item.metric.delta_ratio_points_from_pre,'%p'):'-'}</td></tr>)}</tbody></table></div></section>
    <div className="evidence-action-row"><button type="button" className="primary" disabled={assetIds.length !== 6} onClick={() => evidenceSet&&onAddToReport?.(assetIds, eventId, evidenceSet)}>6개 타일·상대변화 근거를 보고서에 반영</button>{selected ? <span className="selection-status" role="status">현재 보고서 근거로 선택됨</span> : null}</div>
    <div className="accessible-data-table-wrap"><table><caption>PRE·EVENT·POST 영상자료 메타데이터</caption><thead><tr><th scope="col">단계</th><th scope="col">선정기준</th><th scope="col">촬영·생성시각</th><th scope="col">목표일 편차</th><th scope="col">자료성격</th><th scope="col">지도 중첩</th></tr></thead><tbody>{phaseAssets.map((item) => <tr key={item.code}><th scope="row">{item.title}</th><td>{item.rule}</td><td>{localDate(item.satellite?.acquired_at)}</td><td>{signed(item.selection?.offset_days_from_target,'일')}</td><td>{item.satellite?.source_type === 'derived_seed_from_pre_post' ? '생성 Seed' : '첨부 참고자료'}</td><td>미적용</td></tr>)}</tbody></table></div>
    <p className="safety-note">본 표본은 부산·인제·영천 자료가 아니며 위치정합·면적계산·피해판정·공식 침수범위 산정에 사용하지 않습니다. 향후 쓰리디랩스 정식 영상과 마스크로 교체합니다.</p>
  </section>;
}
