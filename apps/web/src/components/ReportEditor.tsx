import { Fragment, useEffect, useMemo, useState } from 'react';
import type { CurrentSituation, PriorityAreaResult, ReportDraft, ReportEvidenceSelection, SimilarEvent } from '../types/contracts';
import type { ReportBlock, ReportDocument, ReportSection } from '../domain/reportDocument';
import { listBlock, noteBlock, rankedListBlock, textBlock, toMarkdown } from '../domain/reportDocument';

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

function isSeedReference(event: SimilarEvent) {
  return event.data_status === 'mock' || event.data_status === 'synthetic_demo' || event.similarity.profile_id === 'SEED-FALLBACK';
}

interface ReportDocumentInput {
  overview: string;
  conditions: string;
  actions: string;
  damageStatus: string;
  priorities: PriorityAreaResult | null;
  selectedEvents: SimilarEvent[];
  selection: ReportEvidenceSelection;
}

/**
 * 화면 입력·선택 근거를 보고서 문서 구조로 만든다(순수함수).
 * 마크다운 문자열은 toMarkdown(document)로만 파생하며, 여기서 문자열을 조립하지 않는다.
 * 과거 참고정보 프레이밍만 사용하고 피해예측·공식 위험도·자동 조치결정을 만들지 않는다.
 */
export function buildReportDocument({ overview, conditions, actions, damageStatus, priorities, selectedEvents, selection }: ReportDocumentInput): ReportDocument {
  const priorityBlock = priorities
    ? rankedListBlock(priorities.areas.slice(0, 5).map((area) => ({ marker: area.rank, text: `${area.name} - ${area.reasons.join(', ')}` })))
    : textBlock('미확인');
  const eventItems = selectedEvents.map((event) => {
    const factorText=event.similarity.factors
      .filter((factor)=>factor.availability==='AVAILABLE')
      .sort((a,b)=>b.contribution_score-a.contribution_score)
      .slice(0,4)
      .map((factor)=>`${factor.factor_name} ${factor.contribution_score.toFixed(1)}점`)
      .join(', ');
    const responseChildren=event.response_comparison
      .map((item)=>`현재 확인: ${item.current_required_check} / 과거 조치: ${item.past_event_action??'근거 미확보'}`);
    const passageChildren=event.evidence
      .map((item)=>`근거 Passage: ${item.title} (${item.passage_id??item.evidence_id})`);
    return {
      text: `${event.event_name}: 사건 유사도 ${event.similarity.event_similarity_score}점, 비교범위 ${event.similarity.comparison_coverage}%, 신뢰 ${event.similarity.confidence_status}, 데이터상태 ${event.data_status} (${factorText || '비교요인 미확보'})`,
      children: [
        ...(isSeedReference(event) ? ['Seed 참고사례 · T3Q 실데이터 아님'] : []),
        ...(responseChildren.length > 0 ? responseChildren : ['대응비교 미확보']),
        ...(passageChildren.length > 0 ? passageChildren : ['근거 Passage 미확보']),
        '과거 참고정보이며 권고·자동 결정 아님 (담당자 확인 필요)',
        '현재 피해예측 아님'
      ]
    };
  });
  const eventBlock = eventItems.length > 0 ? listBlock(eventItems) : textBlock('선택된 참고사례 없음');
  const satelliteBlock = selection.satellite_event_set
    ? listBlock([{ text: `PRE·EVENT·POST 증거세트 ${selection.satellite_event_set.evidence_set_id??selection.satellite_event_set.event_id} · ${selection.satellite_event_set.asset_ids.length}개 타일 · 출처버전 ${selection.satellite_event_set.provenance_version??'미확인'} · 대상지역 일치 ${selection.satellite_event_set.target_region_match?'예':'아니오'}` }])
    : selection.satellite_pair
      ? listBlock([{ text: `기준영상 ${selection.satellite_pair.left_asset_id} / 비교영상 ${selection.satellite_pair.right_asset_id}` }])
      : textBlock('선택된 위성영상 근거 없음');
  const floodBlock = listBlock([{ text: selection.include_flood_trace ? '침수흔적도 Seed 근거 포함 (공식 침수범위 아님)' : '침수흔적도 근거 미선택' }]);
  return {
    title: '재난상황 보고서 초안',
    sections: [
      { id: 'overview', level: 2, heading: '1. 상황 개요', blocks: [textBlock(overview || '미입력')] },
      { id: 'conditions', level: 2, heading: '2. 현재 조건', blocks: [textBlock(conditions || '미입력')] },
      { id: 'priority', level: 2, heading: '3. 우선 확인지역', blocks: [priorityBlock] },
      { id: 'evidence', level: 2, heading: '4. 피해·변화 참고근거', blocks: [] },
      { id: 'evidence-satellite', level: 3, heading: '위성영상', blocks: [satelliteBlock] },
      { id: 'evidence-flood', level: 3, heading: '침수흔적도', blocks: [floodBlock] },
      { id: 'evidence-events', level: 3, heading: '과거 피해·대응·복구 사례', blocks: [eventBlock] },
      { id: 'actions', level: 2, heading: '5. 담당자 조치결과', blocks: [textBlock(actions || '미입력')] },
      { id: 'damage', level: 2, heading: '6. 피해현황', blocks: [textBlock(damageStatus || '미확인')] }
    ],
    closing: [noteBlock('본 문서는 담당자 검토용 초안이며 NDMS 자동 제출 또는 공식 피해예측 결과가 아닙니다.')]
  };
}

export function ReportEditor({ situation, priorities, events, report, selection }: Props) {
  const [overview, setOverview] = useState('');
  const [conditions, setConditions] = useState('');
  const [actions, setActions] = useState('');
  const [damageStatus, setDamageStatus] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (situation) {
      const raw = localStorage.getItem(`une-disaster-report:${situation.situation_id}`);
      if (raw) {
        try {
          const saved = JSON.parse(raw) as { overview?: unknown; conditions?: unknown; actions?: unknown; damageStatus?: unknown };
          setOverview(asText(saved.overview));
          setConditions(asText(saved.conditions));
          setActions(asText(saved.actions));
          setDamageStatus(asText(saved.damageStatus));
          return;
        } catch {
          // 저장된 초안 파싱 실패 시 Seed 초안 sections로 폴백한다.
        }
      }
    }
    const sections = report?.sections ?? {};
    setOverview(asText(sections.overview ?? sections.situation_overview));
    setConditions(asText(sections.current_conditions ?? sections.observations));
    setActions(asText(sections.operator_actions));
    setDamageStatus(asText(sections.damage_status));
  }, [report?.report_id, situation?.situation_id]);

  const selectedEvents = useMemo(() => events.filter((event) => selection.similar_event_ids.includes(event.event_id)), [events, selection]);

  const draftWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!overview.trim()) warnings.push('상황 개요가 미입력 상태입니다. 내용 입력이 필요합니다.');
    if (!conditions.trim()) warnings.push('현재 조건이 미입력 상태입니다. 내용 입력이 필요합니다.');
    if (!actions.trim()) warnings.push('담당자 조치결과가 미입력 상태입니다. 조치 내용 확인이 필요합니다.');
    const damageText = damageStatus.trim();
    if (!damageText || damageText === '미확인') warnings.push('피해현황이 미확인으로 남아 있습니다. 현장 확인 후 갱신이 필요합니다.');
    const hasSatellite = Boolean(selection.satellite_event_set || selection.satellite_pair);
    if (!hasSatellite && !selection.include_flood_trace && selection.similar_event_ids.length === 0) {
      warnings.push('참고근거 3종(위성 증거세트·침수흔적·피해사례)이 모두 미선택 상태입니다. 근거 페이지에서 선택 여부 확인이 필요합니다.');
    }
    if (selection.satellite_event_set?.target_region_match === false) {
      warnings.push('선택된 위성 증거세트는 대상지역 외 표본입니다. 화면·보고서 구조 검증용 자료임을 확인해 주세요.');
    }
    const missingEventIds = selection.similar_event_ids.filter((id) => !events.some((event) => event.event_id === id));
    if (missingEventIds.length > 0) {
      warnings.push(`선택된 사례 중 현재 목록에 없는 ID가 있습니다 (정합성 확인 필요): ${missingEventIds.join(', ')}`);
    }
    return warnings;
  }, [overview, conditions, actions, damageStatus, selection, events]);

  // 보고서를 문자열이 아닌 문서 구조로 만든다. 마크다운(다운로드)과 화면 렌더는 이 구조에서만 파생한다.
  const draftDocument = useMemo<ReportDocument>(
    () => buildReportDocument({ overview, conditions, actions, damageStatus, priorities, selectedEvents, selection }),
    [overview, conditions, actions, damageStatus, priorities, selectedEvents, selection]
  );

  const markdown = useMemo(() => toMarkdown(draftDocument), [draftDocument]);

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
        <section id="report-evidence" className="report-selected-evidence" aria-labelledby="report-evidence-title"><h3 id="report-evidence-title">선택된 피해·변화 참고근거</h3><ul><li>위성영상·수계마스크: {selection.satellite_event_set?`증거세트 ${selection.satellite_event_set.evidence_set_id??selection.satellite_event_set.event_id} 선택됨`:(selection.satellite_pair?'2시점 비교 선택됨':'미선택')}</li><li>침수흔적도: {selection.include_flood_trace?'포함':'미포함'}</li><li>과거 피해·복구 사례: {selection.similar_event_ids.length}건</li></ul>{selection.satellite_event_set&&!selection.satellite_event_set.target_region_match?<p className="safety-note">선택된 위성 증거세트는 현재 시범 대상지역 자료가 아닙니다. 화면·보고서 구조 검증용으로만 사용합니다.</p>:null}{selectedEvents.map((event)=>{
          const seed=isSeedReference(event);
          return <article key={event.event_id} className="report-event-detail">
            <h4>{event.event_name} <span className="event-meta">사건 유사도 {event.similarity.event_similarity_score}점 · 비교범위 {event.similarity.comparison_coverage}% · 신뢰 {event.similarity.confidence_status} · 데이터상태 {event.data_status}</span>{seed?<span className="seed-badge">Seed 참고사례 · T3Q 실데이터 아님</span>:null}</h4>
            {event.response_comparison.length>0?<div className="table-scroll" tabIndex={0} aria-label={`${event.event_name} 현재 확인사항과 과거 대응조치 비교 표`}>
              <table className="comparison-table"><caption>현재 확인사항과 과거 대응조치 (과거 참고정보 · 담당자 확인 필요)</caption><thead><tr><th scope="col">현재 확인사항</th><th scope="col">과거 조치</th><th scope="col">차이·확인</th></tr></thead><tbody>
                {event.response_comparison.map((item)=><tr key={item.action_category}><th scope="row">{item.current_required_check}</th><td>{item.past_event_action??'근거 미확보'}</td><td>{item.difference}</td></tr>)}
              </tbody></table>
            </div>:<p className="report-event-empty">대응비교 미확보</p>}
            {event.evidence.length>0?<ul className="report-passage-list" aria-label={`${event.event_name} 근거 Passage 목록`}>
              {event.evidence.map((item)=><li key={item.evidence_id}>근거 Passage: {item.title} ({item.passage_id??item.evidence_id}){item.excerpt?<span className="passage-excerpt"> — {item.excerpt}</span>:null}<span className="passage-status">[{item.data_status}]</span></li>)}
            </ul>:<p className="report-event-empty">근거 Passage 미확보</p>}
          </article>;
        })}{selectedEvents.length>0?<p className="safety-note">과거 대응조치와 Passage는 과거 참고정보이며 권고 조치나 자동 결정이 아닙니다. 담당자 확인이 필요합니다.</p>:null}<p>참고근거는 현재 피해현황 또는 피해예측으로 자동 기입하지 않습니다.</p></section><label id="report-actions">담당자 조치결과<textarea value={actions} onChange={(event) => setActions(event.target.value)} placeholder="현장 확인, 도로 통제, 주민 안내 등 실제 조치 결과를 입력합니다." /></label>
        <label id="report-damage">현재 피해현황<textarea value={damageStatus} onChange={(event) => setDamageStatus(event.target.value)} placeholder="현장 확인 전에는 미확인으로 유지합니다." /></label>
        <section className="draft-validation" role="status" aria-labelledby="draft-validation-title">
          <h3 id="draft-validation-title">초안 검증</h3>
          {draftWarnings.length > 0 ? (
            <ul className="draft-validation-list">
              {draftWarnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : (
            <p className="draft-validation-ok">누락 없음 — 필수 입력과 참고근거 선택이 확인되었습니다.</p>
          )}
          <p className="draft-validation-note">확인 안내이며 저장·다운로드를 차단하지 않습니다.</p>
        </section>
        <div className="report-actions"><button type="button" onClick={saveDraft}>브라우저에 저장</button><button type="button" className="primary" onClick={downloadMarkdown}>Markdown 다운로드</button></div>
        <p className="sr-only" aria-live="polite">{status}</p>
      </section>
      <aside className="report-preview" id="report-preview" aria-labelledby="preview-title">
        <h2 id="preview-title">초안 미리보기</h2>
        <ReportDocumentView document={draftDocument} />
        <details className="report-preview-source">
          <summary>Markdown 원문 보기 (다운로드 파일과 동일)</summary>
          <pre tabIndex={0}>{markdown}</pre>
        </details>
      </aside>
    </div>
  );
}

/** 사용자 입력 텍스트를 문단·줄바꿈만 보존해 렌더한다(마크다운 기호는 화면에 노출하지 않는다). */
function ReportTextBlock({ value }: { value: string }) {
  const paragraphs = value.split(/\n{2,}/).map((paragraph) => paragraph.split('\n'));
  return <>{paragraphs.map((lines, index) => (
    <p className="report-doc-paragraph" key={index}>
      {lines.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 ? <br /> : null}{line}</Fragment>)}
    </p>
  ))}</>;
}

function ReportBlockView({ block }: { block: ReportBlock }) {
  if (block.kind === 'text') return <ReportTextBlock value={block.value} />;
  if (block.kind === 'note') return <blockquote className="report-doc-note"><p>{block.value}</p></blockquote>;
  if (block.kind === 'ranked-list') {
    if (block.items.length === 0) return null;
    return <ol className="report-doc-ranked-list">
      {block.items.map((item, index) => <li className="report-doc-ranked-item" key={index} value={item.marker}>{item.text}</li>)}
    </ol>;
  }
  if (block.items.length === 0) return null;
  return <ul className="report-doc-list">
    {block.items.map((item, index) => <li className="report-doc-item" key={index}>
      <span className="report-doc-item-text">{item.text}</span>
      {item.children && item.children.length > 0
        ? <ul className="report-doc-sublist">{item.children.map((child, childIndex) => <li className="report-doc-subitem" key={childIndex}>{child}</li>)}</ul>
        : null}
    </li>)}
  </ul>;
}

function ReportSectionView({ section }: { section: ReportSection }) {
  const blocks = section.blocks.map((block, index) => <ReportBlockView block={block} key={index} />);
  if (section.level === 3) {
    return <section className="report-doc-subsection">
      <h4 className="report-doc-subheading">{section.heading}</h4>
      {blocks}
    </section>;
  }
  return <section className="report-doc-section">
    <h3 className="report-doc-heading">{section.heading}</h3>
    {blocks}
  </section>;
}

/** 문서 구조를 시맨틱 HTML로 표현한다. 마크다운 원문(#, -, >)은 details 안에서만 제공한다. */
function ReportDocumentView({ document: doc }: { document: ReportDocument }) {
  return (
    <article className="report-preview-doc" tabIndex={0} aria-label={`${doc.title} 미리보기 문서`}>
      <p className="report-doc-title">{doc.title}</p>
      {doc.sections.map((section) => <ReportSectionView section={section} key={section.id} />)}
      {doc.closing.map((block, index) => <ReportBlockView block={block} key={index} />)}
    </article>
  );
}
