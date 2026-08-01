import { useEffect, useMemo, useState } from 'react';
import type { CurrentSituation, PriorityAreaResult, ReportDraft, ReportEvidenceSelection, SimilarEvent } from '../types/contracts';

interface Props {
  situation: CurrentSituation | null;
  priorities: PriorityAreaResult | null;
  events: SimilarEvent[];
  report: ReportDraft | null;
  selection: ReportEvidenceSelection;
}

function asText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join('\n');
  return typeof value === 'string' ? value : value ? JSON.stringify(value, null, 2) : '';
}

export function ReportEditor({ situation, priorities, events, report, selection }: Props) {
  const [overview, setOverview] = useState('');
  const [conditions, setConditions] = useState('');
  const [actions, setActions] = useState('');
  const [damageStatus, setDamageStatus] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const sections = report?.sections ?? {};
    setOverview(asText(sections.overview ?? sections.situation_overview));
    setConditions(asText(sections.current_conditions ?? sections.observations));
    setActions(asText(sections.operator_actions));
    setDamageStatus(asText(sections.damage_status));
  }, [report?.report_id]);

  const markdown = useMemo(() => {
    const priorityText = priorities?.areas.slice(0, 5).map((area) => `${area.rank}. ${area.name} - ${area.reasons.join(', ')}`).join('\n') ?? '미확인';
    const selectedEvents=events.filter(event=>selection.similar_event_ids.includes(event.event_id));
    const eventText = selectedEvents.map((event) => {
      const factorText=event.similarity.factors
        .filter((factor)=>factor.availability==='AVAILABLE')
        .sort((a,b)=>b.contribution_score-a.contribution_score)
        .slice(0,4)
        .map((factor)=>`${factor.factor_name} ${factor.contribution_score.toFixed(1)}점`)
        .join(', ');
      const responseText=event.response_comparison
        .map((item)=>`  - 현재 확인: ${item.current_required_check} / 과거 조치: ${item.past_event_action??'근거 미확보'}`)
        .join('\n');
      return `- ${event.event_name}: 사건 유사도 ${event.similarity.event_similarity_score}점, 비교범위 ${event.similarity.comparison_coverage}% (${factorText || '비교요인 미확보'})\n${responseText || '  - 대응비교 미확보'}\n  - 현재 피해예측 아님`;
    }).join('\n') || '선택된 참고사례 없음';
    const satelliteText=selection.satellite_event_set?`- PRE·EVENT·POST 증거세트 ${selection.satellite_event_set.evidence_set_id??selection.satellite_event_set.event_id} · ${selection.satellite_event_set.asset_ids.length}개 타일 · 출처버전 ${selection.satellite_event_set.provenance_version??'미확인'} · 대상지역 일치 ${selection.satellite_event_set.target_region_match?'예':'아니오'}`:(selection.satellite_pair?`- 기준영상 ${selection.satellite_pair.left_asset_id} / 비교영상 ${selection.satellite_pair.right_asset_id}`:'선택된 위성영상 근거 없음');
    const floodText=selection.include_flood_trace?'- 침수흔적도 Seed 근거 포함 (공식 침수범위 아님)':'- 침수흔적도 근거 미선택';
    const maskMetrics=(report?.sections as any)?.flood_mask_pixel_metrics?.phases as Array<{phase:string;water_ratio_pct:number;delta_ratio_points_from_pre:number}>|undefined;
    const maskMetricText=maskMetrics?.map(m=>`- ${m.phase}: 흰색 픽셀 ${m.water_ratio_pct}% (PRE 대비 ${m.delta_ratio_points_from_pre>0?'+':''}${m.delta_ratio_points_from_pre}%p)`).join('\n')??'- 선택된 수계마스크 상대변화 없음';
    return `# 재난상황 보고서 초안\n\n## 1. 상황 개요\n${overview || '미입력'}\n\n## 2. 현재 조건\n${conditions || '미입력'}\n\n## 3. 우선 확인지역\n${priorityText}\n\n## 4. 피해·변화 참고근거\n### 위성영상\n${satelliteText}\n\n### 침수흔적도\n${floodText}\n\n### 과거 피해·대응·복구 사례\n${eventText}\n\n## 5. 담당자 조치결과\n${actions || '미입력'}\n\n## 6. 피해현황\n${damageStatus || '미확인'}\n\n> 본 문서는 담당자 검토용 초안이며 NDMS 자동 제출 또는 공식 피해예측 결과가 아닙니다.`;
  }, [overview, conditions, actions, damageStatus, priorities, events, selection, report]);

  function saveDraft() {
    if (!situation) return;
    localStorage.setItem(`une-disaster-report:${situation.situation_id}`, JSON.stringify({ overview, conditions, actions, damageStatus, savedAt: new Date().toISOString() }));
    setStatus('보고서 초안을 이 브라우저에 저장했습니다.');
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `재난상황보고서_초안_${situation?.admin_code ?? 'POC'}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus('Markdown 초안 파일을 생성했습니다.');
  }

  return (
    <div className="report-layout">
      <aside className="report-outline" aria-labelledby="report-outline-title">
        <h2 id="report-outline-title">작성 항목</h2>
        <ol>
          <li><a href="#report-overview">상황 개요</a></li>
          <li><a href="#report-conditions">현재 조건</a></li>
          <li><a href="#report-evidence">피해·변화 참고근거</a></li><li><a href="#report-actions">조치결과</a></li>
          <li><a href="#report-damage">피해현황</a></li>
          <li><a href="#report-preview">미리보기</a></li>
        </ol>
        <div className="report-warning"><strong>검토용 초안</strong><p>NDMS 자동등록과 공식 보고 승인은 수행하지 않습니다.</p></div>
      </aside>
      <section className="report-form" aria-labelledby="report-form-title">
        <h2 id="report-form-title">보고서 내용 편집</h2>
        <label id="report-overview">상황 개요<textarea value={overview} onChange={(event) => setOverview(event.target.value)} /></label>
        <label id="report-conditions">현재 조건<textarea value={conditions} onChange={(event) => setConditions(event.target.value)} /></label>
        <section id="report-evidence" className="report-selected-evidence" aria-labelledby="report-evidence-title"><h3 id="report-evidence-title">선택된 피해·변화 참고근거</h3><ul><li>위성영상·수계마스크: {selection.satellite_event_set?`증거세트 ${selection.satellite_event_set.evidence_set_id??selection.satellite_event_set.event_id} 선택됨`:(selection.satellite_pair?'2시점 비교 선택됨':'미선택')}</li><li>침수흔적도: {selection.include_flood_trace?'포함':'미포함'}</li><li>과거 피해·복구 사례: {selection.similar_event_ids.length}건</li></ul>{selection.satellite_event_set&&!selection.satellite_event_set.target_region_match?<p className="safety-note">선택된 위성 증거세트는 현재 시범 대상지역 자료가 아닙니다. 화면·보고서 구조 검증용으로만 사용합니다.</p>:null}<p>참고근거는 현재 피해현황 또는 피해예측으로 자동 기입하지 않습니다.</p></section><label id="report-actions">담당자 조치결과<textarea value={actions} onChange={(event) => setActions(event.target.value)} placeholder="현장 확인, 도로 통제, 주민 안내 등 실제 조치 결과를 입력합니다." /></label>
        <label id="report-damage">현재 피해현황<textarea value={damageStatus} onChange={(event) => setDamageStatus(event.target.value)} placeholder="현장 확인 전에는 미확인으로 유지합니다." /></label>
        <div className="report-actions"><button type="button" onClick={saveDraft}>브라우저에 저장</button><button type="button" className="primary" onClick={downloadMarkdown}>Markdown 다운로드</button></div>
        <p className="sr-only" aria-live="polite">{status}</p>
      </section>
      <aside className="report-preview" id="report-preview" aria-labelledby="preview-title">
        <h2 id="preview-title">초안 미리보기</h2>
        <pre tabIndex={0}>{markdown}</pre>
      </aside>
    </div>
  );
}
