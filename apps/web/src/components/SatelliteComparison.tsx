import { useMemo, useState } from 'react';
import type { PhaseSelectionResult, SatelliteAsset, SatelliteEvidenceSet } from '../types/contracts';

const PHASES = [
  { code: 'PRE', title: 'PRE', rule: '사건 시작일 -12일 기준' },
  { code: 'EVENT', title: 'EVENT', rule: '재난 시작~종료 +2일 이내' },
  { code: 'POST', title: 'POST', rule: '재난 종료일 +12일 기준' },
] as const;
function url(asset: SatelliteAsset | null) { return asset?.image_url ?? asset?.thumbnail_url ?? '/seed/satellite-placeholder.svg'; }
function localDate(value?: string | null) { return value ? new Date(value).toLocaleString('ko-KR') : '-'; }
function signed(value:number|null|undefined,suffix=''){ if(value==null)return '-'; return `${value>0?'+':''}${value}${suffix}`; }

export function SatelliteComparison({ satellites, selectionResults, evidenceSet, selectedSet, onAddToReport }: { satellites: SatelliteAsset[]; selectionResults: PhaseSelectionResult[]; evidenceSet: SatelliteEvidenceSet | null; selectedSet?: { asset_ids: string[]; event_id: string; evidence_set_id?:string } | null; onAddToReport?(assetIds: string[], eventId: string, evidenceSet:SatelliteEvidenceSet): void }) {
  const eventId=evidenceSet?.event_id??'POC-FLOOD-IMAGE-SAMPLE-001';
  const sample = useMemo(() => satellites.filter((item) => item.event_id === eventId), [satellites,eventId]);
  const phaseAssets = useMemo(() => PHASES.map((phase) => ({ ...phase, satellite: sample.find((item) => item.phase === phase.code && item.asset_kind === 'SATELLITE') ?? null, mask: sample.find((item) => item.phase === phase.code && item.asset_kind === 'WATER_MASK') ?? null, selection: selectionResults.find((item)=>item.phase===phase.code&&item.asset_kind==='SATELLITE')??null })), [sample,selectionResults]);
  const assetIds = phaseAssets.flatMap((item) => [item.satellite?.asset_id, item.mask?.asset_id]).filter((id): id is string => Boolean(id));
  const [compareMode, setCompareMode] = useState<'side' | 'swipe'>('side');
  const [boundaryPct, setBoundaryPct] = useState(50);
  const preSatellite = phaseAssets.find((item) => item.code === 'PRE')?.satellite ?? null;
  const eventSatellite = phaseAssets.find((item) => item.code === 'EVENT')?.satellite ?? null;
  const selected = selectedSet?.event_id === eventId && (!evidenceSet||selectedSet.evidence_set_id===evidenceSet.evidence_set_id) && assetIds.every((id) => selectedSet.asset_ids.includes(id));
  return <section className="evidence-section" aria-labelledby="satellite-title">
    <div className="section-heading-row"><div><h2 id="satellite-title">홍수 PRE·EVENT·POST 위성영상·수계마스크</h2><p>위성영상은 VWorld 2D 베이스맵에 오버레이하지 않고 256×256 독립 타일로 표시합니다.</p></div><span className="seed-badge">{evidenceSet?.area.is_target_region?'시범 대상지역':'대상지역 외 POC Seed'} · {evidenceSet?.official_data?'공식자료':'공식자료 아님'}</span></div>
    <div className="phase-rule-summary" role="note"><strong>시점 선정:</strong> PRE는 사건 시작일 -12일, EVENT는 재난 시작~종료 +2일 이내, POST는 EVENT 구간과 겹치지 않도록 재난 종료일 +12일을 기준으로 합니다. 목표일과 실제 촬영일 차이는 별도 표시합니다.</div>
    <div className="flood-phase-grid">{phaseAssets.map((item) => <article className="flood-phase-card" key={item.code} aria-labelledby={`phase-${item.code}`}><header><h3 id={`phase-${item.code}`}>{item.title}</h3><p>{item.rule}</p>{item.selection?<p className="phase-selection-note">선정편차 {signed(item.selection.offset_days_from_target,'일')} · {item.selection.selection_reason}</p>:null}</header><div className="phase-tile-pair">
      <figure><img width="256" height="256" src={url(item.satellite)} alt={`${item.title} 단계 홍수 시연용 흑백 위성영상 256×256 타일`} /><figcaption><strong>위성영상</strong><span>{localDate(item.satellite?.acquired_at)}</span><span>{item.satellite?.source_type === 'derived_seed_from_pre_post' ? 'PRE·POST 기반 생성 Seed' : '사용자 첨부 참고영상'}</span></figcaption></figure>
      <figure><img width="256" height="256" src={url(item.mask)} alt={`${item.title} 단계 수계마스크 256×256 타일, 흰색은 수계영역이고 검은색은 비수계영역`} /><figcaption><strong>수계마스크</strong><span>흰색=수계·침수 표현</span><span>{localDate(item.mask?.acquired_at)}</span></figcaption></figure>
    </div></article>)}</div>
    <section className="satellite-compare-tool" aria-labelledby="satellite-compare-title">
      <h3 id="satellite-compare-title">PRE·EVENT 위성영상 좌우·스와이프 비교</h3>
      <p>동일 256×256 타일을 좌우 나란히 비교하거나, 스와이프 경계를 이동해 겹쳐 비교합니다. 두 방식 모두 키보드로 조작할 수 있습니다.</p>
      <fieldset className="compare-mode-fieldset">
        <legend>비교 방식</legend>
        <label><input type="radio" name="satellite-compare-mode" value="side" checked={compareMode === 'side'} onChange={() => setCompareMode('side')} />좌우 비교</label>
        <label><input type="radio" name="satellite-compare-mode" value="swipe" checked={compareMode === 'swipe'} onChange={() => setCompareMode('swipe')} />스와이프</label>
      </fieldset>
      {compareMode === 'side'
        ? <div className="compare-side-pair">
            <figure><img width="256" height="256" src={url(preSatellite)} alt="PRE 단계 홍수 시연용 위성영상 256×256 비교 타일, 왼쪽" /><figcaption><strong>PRE</strong><span>{localDate(preSatellite?.acquired_at)}</span></figcaption></figure>
            <figure><img width="256" height="256" src={url(eventSatellite)} alt="EVENT 단계 홍수 시연용 위성영상 256×256 비교 타일, 오른쪽" /><figcaption><strong>EVENT</strong><span>{localDate(eventSatellite?.acquired_at)}</span></figcaption></figure>
          </div>
        : <div className="compare-swipe-block">
            <div className="compare-swipe-stage">
              <img width="256" height="256" className="compare-swipe-base" src={url(eventSatellite)} alt="EVENT 단계 홍수 시연용 위성영상 256×256 비교 타일, 스와이프 아래층" />
              <img width="256" height="256" className="compare-swipe-top" style={{ clipPath: `inset(0 ${100 - boundaryPct}% 0 0)` }} src={url(preSatellite)} alt={`PRE 단계 홍수 시연용 위성영상 256×256 비교 타일, 스와이프 위층으로 왼쪽 ${boundaryPct}% 표시`} />
              <span className="compare-swipe-line" style={{ left: `${boundaryPct}%` }} aria-hidden="true" />
            </div>
            <div className="compare-swipe-controls">
              <label htmlFor="satellite-swipe-range">비교 경계 위치</label>
              <input id="satellite-swipe-range" type="range" min={0} max={100} step={1} value={boundaryPct} onChange={(event) => setBoundaryPct(Number(event.target.value))} />
              <span className="compare-swipe-value">현재 {boundaryPct}% · 왼쪽 PRE {boundaryPct}% / 오른쪽 EVENT {100 - boundaryPct}%</span>
              <div className="compare-swipe-quick" role="group" aria-label="빠른 경계 위치">
                {[25, 50, 75].map((value) => <button key={value} type="button" aria-pressed={boundaryPct === value} onClick={() => setBoundaryPct(value)}>{value}%</button>)}
              </div>
            </div>
          </div>}
      <p className="compare-note">비교 경계값은 256×256 픽셀 표본을 눈으로 비교하기 위한 참고용 화면값이며 지리면적·침수심·피해 정도를 의미하지 않습니다.</p>
    </section>
    <div className="evidence-action-row"><button type="button" className="primary" disabled={assetIds.length !== 6} onClick={() => evidenceSet&&onAddToReport?.(assetIds, eventId, evidenceSet)}>6개 타일 근거를 보고서에 반영</button>{selected ? <span className="selection-status" role="status">현재 보고서 근거로 선택됨</span> : null}</div>
    <p className="safety-note">본 표본은 부산·인제·영천 자료가 아니며 위치정합·면적계산·피해판정·공식 침수범위 산정에 사용하지 않습니다. 향후 쓰리디랩스 정식 영상과 마스크로 교체합니다.</p>
  </section>;
}
