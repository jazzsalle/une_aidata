import { useState } from 'react';
import { moveTabFocus } from '../hooks/useRovingTabs';
import type { PriorityAreaResult, ProcedureStep, SimilarEvent } from '../types/contracts';

interface Props {
  priorities: PriorityAreaResult | null;
  procedures: ProcedureStep[];
  similarEvents: SimilarEvent[];
  selectedEventId: string | null;
  onHighlight(id: string): void;
  onSelectEvent(id: string): void;
}

const tabs=['현재 판단','유사사례','대응절차','계획·근거'] as const;
type Tab=(typeof tabs)[number];

export function InsightPanel({priorities,procedures,similarEvents,selectedEventId,onHighlight,onSelectEvent}:Props){
  const [tab,setTab]=useState<Tab>('현재 판단');
  const selectedEvent=similarEvents.find((event)=>event.event_id===selectedEventId)??similarEvents[0]??null;

  return <aside className="right-panel">
    <div className="panel-tabs compact" role="tablist" aria-label="판단 정보" onKeyDown={e=>moveTabFocus<Tab>(e,tabs,tab,setTab,'insight-tab')}>
      {tabs.map((item,index)=><button key={item} id={`insight-tab-${index}`} role="tab" aria-selected={tab===item} aria-controls={`insight-panel-${index}`} tabIndex={tab===item?0:-1} type="button" className={tab===item?'active':''} onClick={()=>setTab(item)}>{item}</button>)}
    </div>
    <div id={`insight-panel-${tabs.indexOf(tab)}`} role="tabpanel" aria-labelledby={`insight-tab-${tabs.indexOf(tab)}`} className="panel-scroll">
      {tab==='현재 판단'&&<>
        <div className="notice-card warning"><strong>우선 확인 상대순위</strong><p>공식 위험도·피해예측 결과가 아니며 담당자 확인이 필요합니다.</p></div>
        {priorities?.areas.map(area=><article className="priority-card" key={area.spatial_object_id}><div className="rank">{area.rank}</div><div><div className="priority-title"><strong>{area.name}</strong><span>{area.score}점</span></div><ul>{area.reasons.slice(0,3).map(reason=><li key={reason}>{reason}</li>)}</ul><button type="button" onClick={()=>onHighlight(area.spatial_object_id)}>지도에서 보기</button></div></article>)}
      </>}

      {tab==='유사사례'&&<div className="event-list">
        <div className="notice-card info"><strong>과거 피해·복구 참고</strong><p>현재 피해를 예측하지 않으며 향후 T3Q NDMS 데이터로 교체합니다.</p></div>
        {similarEvents.map(event=><button type="button" key={event.event_id} className={`event-card ${selectedEvent?.event_id===event.event_id?'selected':''}`} onClick={()=>onSelectEvent(event.event_id)}>
          <span className="event-score">{event.similarity_score}점</span>
          <strong>{event.event_name}</strong>
          <small>{new Date(event.occurred_from).toLocaleDateString('ko-KR')} · {event.spatial_relation}</small>
          <div className="similarity-meta"><span>비교 {event.similarity.comparison_coverage}%</span><span>신뢰 {event.similarity.confidence_status}</span><span>Graph {event.similarity.graph_similarity_status==='NOT_AVAILABLE'?'비교 제외':'적용'}</span></div>
          <ul>{event.similarity.factors.filter(factor=>factor.availability==='AVAILABLE').sort((a,b)=>b.contribution_score-a.contribution_score).slice(0,3).map(factor=><li key={factor.factor_code}>{factor.factor_name} {factor.contribution_score.toFixed(1)}점</li>)}</ul>
          <span className="evidence-count">근거 {event.evidence.length}건 · 문서관련도 {event.similarity.retrieval_relevance_score??'별도'}</span>
        </button>)}

        {selectedEvent?<section className="similar-event-detail" aria-labelledby="similar-event-detail-title">
          <h3 id="similar-event-detail-title">선택 사례 비교 상세</h3>
          <p><strong>{selectedEvent.event_name}</strong> · 사건 유사도 {selectedEvent.similarity.event_similarity_score}점 · 비교 가능 범위 {selectedEvent.similarity.comparison_coverage}%</p>
          <div className="table-scroll" tabIndex={0} aria-label="요인별 유사도 점수 표">
            <table className="comparison-table"><caption>요인별 점수와 기여도</caption><thead><tr><th scope="col">요인</th><th scope="col">상태</th><th scope="col">가중치</th><th scope="col">요인점수</th><th scope="col">기여도</th></tr></thead><tbody>
              {selectedEvent.similarity.factors.map(factor=><tr key={factor.factor_code}><th scope="row">{factor.factor_name}</th><td>{factor.availability==='AVAILABLE'?'비교':'미확보'}</td><td>{factor.weight}</td><td>{factor.normalized_score===null?'-':factor.normalized_score.toFixed(3)}</td><td>{factor.contribution_score.toFixed(1)}</td></tr>)}
            </tbody></table>
          </div>
          <div className="table-scroll" tabIndex={0} aria-label="현재 확인사항과 과거 대응조치 비교 표">
            <table className="comparison-table"><caption>현재 확인사항과 과거 대응조치</caption><thead><tr><th scope="col">현재 확인사항</th><th scope="col">과거 조치</th><th scope="col">차이·확인</th></tr></thead><tbody>
              {selectedEvent.response_comparison.map(item=><tr key={item.action_category}><th scope="row">{item.current_required_check}</th><td>{item.past_event_action??'근거 미확보'}</td><td>{item.difference}</td></tr>)}
            </tbody></table>
          </div>
          <p className="safety-note">Mock 가중치와 과거 참고사례를 이용한 비교이며 실제 T3Q 검색성능·공식 대응결정이 아닙니다.</p>
        </section>:null}
      </div>}

      {tab==='대응절차'&&procedures.slice(0,8).map(step=><article className="procedure-card" key={step.procedure_id}><small>{step.stage_name} · 잠정 참고</small><strong>{step.sequence}. {step.action_title}</strong><p>{step.action_description}</p><div className="badge-row"><span>대상지 공식 아님</span><span>담당자 확인 필요</span></div></article>)}

      {tab==='계획·근거'&&<div className="evidence-list"><article><strong>자연재해저감종합계획</strong><p>위험지구·취약요인·저감대책 근거</p></article><article><strong>하천기본계획</strong><p>계획홍수량·제방·하폭·시설능력 근거</p></article><article><strong>침수흔적도·위성영상</strong><p>과거 피해·변화의 공간근거</p></article><article><strong>유니 RAG</strong><p>환경변수의 로그인·검색 경로 설정 시 문서·페이지·Passage 근거를 자동 결합합니다.</p></article></div>}
    </div>
  </aside>;
}
