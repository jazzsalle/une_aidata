import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { META_DEMO_REGIONS, isMetaDemoId } from '../features/map/mapRegions';
import { moveTabFocus } from '../hooks/useRovingTabs';
import { loadPlanReference } from '../services/apiClient';
import { DetailModal } from './DetailModal';
// 위험지구 상세는 지도 POI 팝업과 같은 공용 컴포넌트를 재사용한다(중복 구현 금지).
import { DistrictDetailSections, districtFactRows } from './DistrictDetail';
import type { PriorityArea, PriorityAreaResult, ProcedureStep, SimilarEvent } from '../types/contracts';
import type { DistrictReference, PlanReference, ReferenceEvidence, RiverReference, RiverStation } from '../types/planReference';
import type { AgentContextItem } from '../types/uiContext';
import { type NetworkRiver, loadNetworkRivers, riversInRegion } from '../features/map/riverCatalog';
import { type RiverSearchEntry, loadRiverSearchIndex } from '../features/map/riverSearchIndex';

interface Props {
  priorities: PriorityAreaResult | null;
  procedures: ProcedureStep[];
  similarEvents: SimilarEvent[];
  selectedEventId: string | null;
  onHighlight(id: string): void;
  onSelectEvent(id: string): void;
  /** 계획·근거 탭이 조회할 행정구역. 미배선이면 '계획자료 미확보' 안내만 표시한다. */
  adminCode?: string | null;
  /** 하천 탭이 보여줄 시군구. 지도가 보고 있는 지역이며 앱 지역과 별개로 움직인다. */
  mapRegion?: string;
  /** 하천 목록에서 고른 하천으로 지도를 옮긴다. 미연결이면 이동 버튼을 렌더하지 않는다. */
  onFocusMap?(lonLat: [number, number], zoom?: number): void;
  /** 선택 대상을 AI 질의 컨텍스트로 넘기는 배선. 미연결이면 버튼을 렌더하지 않는다. */
  onAddContext?(item: AgentContextItem): void;
}

// 하천 탭은 맨 뒤에 둔다. 앞의 4개는 기존 순서를 그대로 유지한다 —
// 콘솔 스모크가 탭을 인덱스로 지목하고 있어 순서를 바꾸면 검증이 통째로 어긋난다.
const tabs=['현재 판단','유사사례','대응절차','계획·근거','하천'] as const;
type Tab=(typeof tabs)[number];
/** 하천 탭의 등급 구분. 서비스가 다루는 3종이며 원자료의 등급 표기를 그대로 쓴다. */
const riverClasses=['국가하천','지방하천','소하천'] as const;
type RiverClass=(typeof riverClasses)[number];
const MISSING='미확보';
const ALL_TYPES='전체';

const str=(value:unknown):string|null=>{
  if(value===null||value===undefined)return null;
  if(typeof value==='number')return Number.isFinite(value)?String(value):null;
  const text=String(value).trim();
  return text?text:null;
};
const orMissing=(value:unknown)=>str(value)??MISSING;
const numText=(value?:number|null,unit=''):string=>(value===null||value===undefined||!Number.isFinite(value)?MISSING:`${value.toLocaleString('ko-KR')}${unit}`);
/** 백만원 단위 계획 사업비를 억원 병기로 표기한다(계획문서 표기값이며 산정·예측값이 아니다). */
function money(value?:number|null){
  if(value===null||value===undefined||!Number.isFinite(value))return MISSING;
  return `${(value/100).toLocaleString('ko-KR',{maximumFractionDigits:1})}억원 (${value.toLocaleString('ko-KR')}백만원)`;
}
function evidenceText(evidence?:ReferenceEvidence|null):string|null{
  if(!evidence)return null;
  const title=str(evidence.doc_title)??str(evidence.doc);
  const page=str(evidence.page_label)??str(evidence.chapter_page)??(evidence.page?`p.${evidence.page}`:null)??(typeof evidence.pdf_page==='number'?`p.${evidence.pdf_page}`:null)??(Array.isArray(evidence.pdf_page)&&evidence.pdf_page.length?`p.${evidence.pdf_page.join(', ')}`:null);
  const parts=[title,str(evidence.chapter),str(evidence.table),page].filter(Boolean);
  return parts.length?parts.join(' · '):null;
}
/**
 * 지점 계획홍수량은 하천마다 단일값(design_flood_m3s) 또는 계획본별 목록(design_floods)으로 판독되어 있다.
 * 계획본별 목록이면 채택본(adopted) 값을 쓰고 어느 계획본 값인지 함께 표기한다(임의 보정·환산 없음).
 */
type DesignFloodEntry={design_flood_m3s?:number|null;plan_version?:string;adopted?:boolean};
function designFlood(station:RiverStation):{value:number|null;planVersion:string|null}{
  if(typeof station.design_flood_m3s==='number'&&Number.isFinite(station.design_flood_m3s))return{value:station.design_flood_m3s,planVersion:null};
  const entries=(station as unknown as{design_floods?:DesignFloodEntry[]}).design_floods;
  if(!Array.isArray(entries)||!entries.length)return{value:null,planVersion:null};
  const picked=entries.find(entry=>entry.adopted)??entries[entries.length-1];
  if(!picked)return{value:null,planVersion:null};
  return{value:typeof picked.design_flood_m3s==='number'?picked.design_flood_m3s:null,planVersion:str(picked.plan_version)};
}
/** damage/response/recovery 등 계약상 자유형 Record를 화면 문자열로 정리한다. */
function recordText(row:Record<string,unknown>):string{
  const primary=str(row.action)??str(row.description)??str(row.category)??str(row.title);
  const extras=[str(row.responsible_agency),str(row.status),row.count!==undefined?`${orMissing(row.count)}${str(row.unit)??''}`:null,row.duration_hours!==undefined?`소요 ${orMissing(row.duration_hours)}시간`:null].filter(Boolean);
  return [primary??MISSING,...extras].join(' · ');
}
const DAMAGE_LABEL:Record<string,string>={human:'인명',public_facility:'공공시설',private_facility:'사유시설',agriculture:'농업',damage_note:'비고'};
/** 정량 피해항목을 라벨·값 쌍으로 펼친다. 값이 없으면 항목 자체를 만들지 않는다. */
function damageQuantities(damage:Record<string,unknown>):Array<{label:string;value:string}>{
  const rows:Array<{label:string;value:string}>=[];
  for(const [key,label] of Object.entries(DAMAGE_LABEL)){
    const value=damage[key];
    if(value===null||value===undefined)continue;
    if(Array.isArray(value)){
      const text=value.map(item=>typeof item==='object'&&item?recordText(item as Record<string,unknown>):orMissing(item)).join(' / ');
      if(text)rows.push({label,value:text});
    }else if(typeof value==='object'){
      const text=Object.entries(value as Record<string,unknown>).map(([k,v])=>`${k} ${orMissing(v)}`).join(' / ');
      if(text)rows.push({label,value:text});
    }else{
      rows.push({label,value:orMissing(value)});
    }
  }
  return rows;
}
const CONDITION_LABEL:Array<[string,string,string]>=[['rainfall_3h_mm','3시간 강우','mm'],['rainfall_12h_mm','12시간 강우','mm'],['water_level_m','수위','m'],['water_level_trend','수위경향',''],['wind_speed_ms','풍속','m/s']];
function conditionRows(conditions?:Record<string,unknown>):Array<{label:string;value:string}>{
  if(!conditions)return [];
  const rows=CONDITION_LABEL.map(([key,label,unit])=>({label,value:conditions[key]===null||conditions[key]===undefined?MISSING:`${orMissing(conditions[key])}${typeof conditions[key]==='number'?unit:''}`}));
  const objects=Array.isArray(conditions.affected_objects)?conditions.affected_objects.map(str).filter(Boolean).join(', '):'';
  const keywords=Array.isArray(conditions.risk_keywords)?conditions.risk_keywords.map(str).filter(Boolean).join(', '):'';
  rows.push({label:'영향대상',value:objects||MISSING});
  rows.push({label:'위험 키워드',value:keywords||MISSING});
  return rows;
}

function FactList({rows,className='plan-fact-list'}:{rows:Array<{label:string;value:string}>;className?:string}){
  return <dl className={className}>{rows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>;
}

export function InsightPanel(props:Props){
  const {priorities,procedures,similarEvents,selectedEventId,onHighlight,onSelectEvent,adminCode,onAddContext}=props;
  // 메타 표본 지역: 유사도 점수·비교범위 같은 우리 산정값을 유사사례 탭에서도 그리지 않는다.
  const metaSituation=META_DEMO_REGIONS.has(adminCode??'');
  const [tab,setTab]=useState<Tab>('현재 판단');
  // 하천 탭. 목록은 탭을 처음 열 때만 받는다(카탈로그 1.4 MB · 검색색인 5.9 MB, gzip 로 훨씬 작다).
  const [riverClass,setRiverClass]=useState<RiverClass>('국가하천');
  const [networkRivers,setNetworkRivers]=useState<NetworkRiver[]|null>(null);
  const [sochunEntries,setSochunEntries]=useState<RiverSearchEntry[]|null>(null);
  const [riverError,setRiverError]=useState<string|null>(null);
  useEffect(()=>{
    if(tab!=='하천')return;
    let alive=true;
    Promise.all([loadNetworkRivers(),loadRiverSearchIndex()])
      .then(([rivers,entries])=>{if(alive){setNetworkRivers(rivers);setSochunEntries(entries);setRiverError(null);}})
      .catch(()=>{if(alive)setRiverError('하천 목록을 불러오지 못했습니다.');});
    return ()=>{alive=false;};
  },[tab]);
  const [plan,setPlan]=useState<PlanReference|null>(null);
  const [planState,setPlanState]=useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [typeFilter,setTypeFilter]=useState<string>(ALL_TYPES);
  const [openDistrict,setOpenDistrict]=useState<string|null>(null);
  /** '현재 판단' 카드 상세보기 모달 대상. 닫으면 열었던 버튼으로 초점이 복귀한다. */
  const [detailArea,setDetailArea]=useState<PriorityArea|null>(null);
  const planCache=useRef<Map<string,Promise<PlanReference>>>(new Map());
  const selectedEvent=similarEvents.find((event)=>event.event_id===selectedEventId)??similarEvents[0]??null;

  // 계획·근거 자료는 정적 판독 산출물이므로 행정구역이 바뀔 때만 읽고 캐시한다.
  useEffect(()=>{
    setTypeFilter(ALL_TYPES);
    setOpenDistrict(null);
    setDetailArea(null);
    if(!adminCode){setPlan(null);setPlanState('idle');return;}
    let active=true;
    setPlanState('loading');
    const cached=planCache.current.get(adminCode)??loadPlanReference(adminCode);
    planCache.current.set(adminCode,cached);
    cached.then(result=>{if(!active)return;setPlan(result);setPlanState('ready');})
      .catch(()=>{if(!active)return;planCache.current.delete(adminCode);setPlan(null);setPlanState('error');});
    return()=>{active=false;};
  },[adminCode]);

  const districts=plan?.districts??[];
  const rivers=plan?.rivers??[];
  // 우선 확인지역(spatial_object_id)과 계획문서 판독 위험지구(district_code)를 코드로만 대응시킨다. 없으면 태그·상세를 만들지 않는다.
  const districtByCode=useMemo(()=>new Map(districts.map(item=>[item.district_code,item])),[districts]);
  const detailDistrict=detailArea?districtByCode.get(detailArea.spatial_object_id)??null:null;
  // 닫기 시 초점 복귀는 DetailModal 이 열기 전 초점 요소(상세보기 버튼)로 되돌린다.
  const closeDetail=useCallback(()=>setDetailArea(null),[]);
  const districtTypes=useMemo(()=>{
    const counts=new Map<string,number>();
    districts.forEach(item=>{const key=str(item.disaster_type)??MISSING;counts.set(key,(counts.get(key)??0)+1);});
    return [...counts.entries()];
  },[districts]);
  const visibleDistricts=typeFilter===ALL_TYPES?districts:districts.filter(item=>(str(item.disaster_type)??MISSING)===typeFilter);
  const totalCost=districts.reduce((sum,item)=>sum+(Number.isFinite(item.cost_million_krw as number)?Number(item.cost_million_krw):0),0);
  const costUnknown=districts.filter(item=>item.cost_million_krw===null||item.cost_million_krw===undefined).length;
  const planEmpty=planState==='ready'&&!districts.length&&!rivers.length;

  const addDistrictContext=(item:DistrictReference)=>onAddContext?.({kind:'district',id:item.district_code,label:item.district_name,detail:[str(item.disaster_type),str(item.location)].filter(Boolean).join(' · ')||undefined,admin_code:item.admin_code});
  const addRiverContext=(item:RiverReference)=>onAddContext?.({kind:'river',id:item.river_id,label:item.name,detail:[str(item.grade),str(item.plan_name)].filter(Boolean).join(' · ')||undefined,admin_code:item.admin_code});

  const damage=selectedEvent?.damage??{};
  const damageDescription=str(damage.description);
  const damageRows=damageQuantities(damage);
  const quantitiesStatus=str(damage.quantities_status);

  const region=props.mapRegion??'';
  const riverRows=useMemo(()=>{
    if(riverClass==='소하천'){
      // 소하천은 검색색인이 이미 '시군구+하천명' 단위로 묶어 둔 것을 그대로 쓴다.
      return (sochunEntries??[])
        .filter(entry=>entry.scope==='region'&&entry.admin===region)
        .map(entry=>({key:entry.feature_id||entry.name,name:entry.name,detail:entry.detail,nav:entry.nav}))
        .sort((a,b)=>a.name.localeCompare(b.name,'ko-KR'));
    }
    return riversInRegion(networkRivers??[],region)
      .filter(river=>river.river_class===riverClass)
      .map(river=>({key:river.river_code,name:river.river_name,detail:`하천코드 ${river.river_code}`,nav:river.nav}))
      .sort((a,b)=>a.name.localeCompare(b.name,'ko-KR'));
  },[riverClass,networkRivers,sochunEntries,region]);
  const riverLoaded=networkRivers!==null&&sochunEntries!==null;

  return <aside className="right-panel">
    <div className="panel-tabs compact" role="tablist" aria-label="판단 정보" onKeyDown={e=>moveTabFocus<Tab>(e,tabs,tab,setTab,'insight-tab')}>
      {tabs.map((item,index)=><button key={item} id={`insight-tab-${index}`} role="tab" aria-selected={tab===item} aria-controls={`insight-panel-${index}`} tabIndex={tab===item?0:-1} type="button" className={tab===item?'active':''} onClick={()=>setTab(item)}>{item}</button>)}
    </div>
    <div id={`insight-panel-${tabs.indexOf(tab)}`} role="tabpanel" aria-labelledby={`insight-tab-${tabs.indexOf(tab)}`} className="panel-scroll">
      {tab==='현재 판단'&&<>
        <div className="notice-card warning"><strong>우선 확인 상대순위</strong><p>공식 위험도·피해예측 결과가 아니며 담당자 확인이 필요합니다.</p></div>
        {/* 메타 표본은 우리 산정값(순위·점수·사유)을 표시하지 않는다 — 표본과 섞이면 T3Q 데이터로
            오인되기 때문이다. 카드 목록은 표본 지구 나열이며 순서는 전달분 파일 순서다. */}
        {isMetaDemoId(priorities?.situation_id)?<p className="meta-demo-text priority-meta-caption">표본 지구 목록 — 우선순위 점수·사유 등 산정값은 표시하지 않습니다(T3Q 실데이터 수신 전).</p>:null}
        <p className="sr-only">각 카드의 지역명 버튼은 지도의 해당 지점으로 이동하고, 상세보기 버튼은 지도 표시와 같은 위험지구 상세 정보를 창으로 엽니다.</p>
        {/* 카드 목록 래퍼. 초와이드(>2560px)에서 우측 패널이 520px 를 넘으면 이 래퍼만 2열로 흐른다(F-16 tier B). */}
        <div className="priority-list">{priorities?.areas.map(area=>{
          const district=districtByCode.get(area.spatial_object_id)??null;
          const typeTag=str(district?.disaster_type);           // 계획문서 판독 재해유형. 매칭 실패 시 태그를 만들지 않는다.
          const locationSummary=str(district?.location);
          // 메타 표본 지구: 순위·점수·사유(우리 산정값)를 그리지 않는다 — T3Q 데이터 오인 방지.
          const metaArea=isMetaDemoId(area.spatial_object_id);
          return <article
            /* 메타 나열 카드는 rank 원이 없으므로 1열 그리드로 — 2열(32px+1fr) 그대로면 본문이
               32px 칸에 끼어 글자가 세로로 깨진다. */
            className={metaArea?'priority-card meta-listing':'priority-card'}
            key={area.spatial_object_id}
            /* 마우스 편의를 위한 카드 전체 클릭. 키보드 진입점은 아래 지역명 버튼이며 내부 컨트롤은 stopPropagation 한다. */
            onClick={()=>onHighlight(area.spatial_object_id)}
          >
            {metaArea?null:<div className="rank">{area.rank}</div>}
            <div className="priority-body">
              <div className="priority-title">
                <button type="button" className="priority-name-button" aria-label={`${area.name} 지도에서 보기`} onClick={event=>{event.stopPropagation();onHighlight(area.spatial_object_id);}}><strong className={metaArea?'meta-demo-text':undefined}>{area.name}</strong></button>
                {metaArea?<span className="meta-demo-badge">표본</span>:null}
                {metaArea?null:<span>{area.score}점</span>}
              </div>
              {typeTag||locationSummary?<p className="priority-tags">
                {typeTag?<span className="priority-tag">{typeTag}</span>:null}
                {locationSummary?<span className="priority-location">{locationSummary}</span>:null}
              </p>:null}
              {metaArea?null:<ul>{area.reasons.slice(0,3).map(reason=><li key={reason}>{reason}</li>)}</ul>}
              <div className="card-action-row">
                <button type="button" className="priority-detail-button" onClick={event=>{event.stopPropagation();setDetailArea(area);}}>상세보기</button>
                {/* 질의 참조 detail: 메타 표본은 산정 사유 대신 표본 원자료(위치·재해유형)를 넘긴다. */}
                {onAddContext?<button type="button" className="context-add-button" onClick={event=>{event.stopPropagation();onAddContext({kind:'district',id:area.spatial_object_id,label:area.name,detail:metaArea?(locationSummary??typeTag??undefined):area.reasons[0],admin_code:adminCode??undefined});}}>질의에 참조</button>:null}
              </div>
            </div>
          </article>;
        })}</div>
      </>}

      {tab==='유사사례'&&<div className="event-list">
        <div className="notice-card info"><strong>과거 피해·복구 참고</strong><p>현재 피해를 예측하지 않으며 향후 T3Q NDMS 데이터로 교체합니다.</p></div>
        {/* 메타 표본: 유사도·비교범위·요인점수(우리 산정값)를 숨기고 과거 기록 원자료만 남긴다. */}
        {metaSituation?<p className="meta-demo-text priority-meta-caption">표본 지역에서는 유사도 점수 등 산정값을 표시하지 않습니다(T3Q 실데이터 수신 전).</p>:null}
        {similarEvents.map(event=><div className="event-card-row" key={event.event_id}>
          <button type="button" className={`event-card ${selectedEvent?.event_id===event.event_id?'selected':''}`} onClick={()=>onSelectEvent(event.event_id)}>
            {metaSituation?null:<span className="event-score">{event.similarity_score}점</span>}
            <strong>{event.event_name}</strong>
            <small>{new Date(event.occurred_from).toLocaleDateString('ko-KR')} · {event.spatial_relation}</small>
            {metaSituation?null:<div className="similarity-meta"><span>비교 {event.similarity.comparison_coverage}%</span><span>신뢰 {event.similarity.confidence_status}</span><span>Graph {event.similarity.graph_similarity_status==='NOT_AVAILABLE'?'비교 제외':'적용'}</span></div>}
            {metaSituation?null:<ul>{event.similarity.factors.filter(factor=>factor.availability==='AVAILABLE').sort((a,b)=>b.contribution_score-a.contribution_score).slice(0,3).map(factor=><li key={factor.factor_code}>{factor.factor_name} {factor.contribution_score.toFixed(1)}점</li>)}</ul>}
            <span className="event-damage-line">피해기록 {str(event.damage.description)?'서술 있음':'미확보'} · 대응 {event.response.length}건 · 복구 {event.recovery.length}건</span>
            <span className="evidence-count">근거 {event.evidence.length}건{metaSituation?'':` · 문서관련도 ${event.similarity.retrieval_relevance_score??'별도'}`}</span>
          </button>
          {onAddContext?<button type="button" className="context-add-button" onClick={()=>onAddContext({kind:'similar_event',id:event.event_id,label:event.event_name,detail:`${event.spatial_relation} · ${event.hazards.join(', ')}`,admin_code:event.admin_code})}>질의에 참조</button>:null}
        </div>)}

        {selectedEvent?<section className="similar-event-detail" aria-labelledby="similar-event-detail-title">
          <h3 id="similar-event-detail-title">선택 사례 비교 상세</h3>
          <p><strong>{selectedEvent.event_name}</strong>{metaSituation?null:<> · 사건 유사도 {selectedEvent.similarity.event_similarity_score}점 · 비교 가능 범위 {selectedEvent.similarity.comparison_coverage}%</>}</p>

          <section className="event-damage-block" aria-labelledby="event-damage-title">
            <h4 id="event-damage-title">피해정보(과거 기록)</h4>
            <p>{damageDescription??'피해 서술 미확보'}</p>
            {damageRows.length?<FactList rows={damageRows} className="plan-fact-list damage-fact-list" />:null}
            <p className="damage-quantity-note">정량 피해수치 {quantitiesStatus==='NOT_AVAILABLE'?'미확보 — 기록 서술만 확인됩니다.':damageRows.length?'기록값 표시(과거 실적이며 현재 피해예측이 아닙니다).':`${MISSING}.`}</p>
            <div className="event-damage-columns">
              <div>
                <h5>당시 조건</h5>
                {selectedEvent.conditions?<FactList rows={conditionRows(selectedEvent.conditions)} className="plan-fact-list condition-fact-list" />:<p>조건 기록 미확보</p>}
              </div>
              <div>
                <h5>대응 이력</h5>
                {selectedEvent.response.length?<ol className="event-history-list">{selectedEvent.response.map((row,index)=><li key={`response-${index}`}>{recordText(row)}</li>)}</ol>:<p>대응 이력 미확보</p>}
                <h5>복구 이력</h5>
                {selectedEvent.recovery.length?<ol className="event-history-list">{selectedEvent.recovery.map((row,index)=><li key={`recovery-${index}`}>{recordText(row)}</li>)}</ol>:<p>복구 이력 미확보</p>}
              </div>
            </div>
          </section>

          {/* 요인별 점수 표는 통째로 우리 산정값 — 메타 표본에서는 그리지 않는다. */}
          {metaSituation?null:<div className="table-scroll" tabIndex={0} aria-label="요인별 유사도 점수 표">
            <table className="comparison-table"><caption>요인별 점수와 기여도</caption><thead><tr><th scope="col">요인</th><th scope="col">상태</th><th scope="col">가중치</th><th scope="col">요인점수</th><th scope="col">기여도</th></tr></thead><tbody>
              {selectedEvent.similarity.factors.map(factor=><tr key={factor.factor_code}><th scope="row">{factor.factor_name}</th><td>{factor.availability==='AVAILABLE'?'비교':'미확보'}</td><td>{factor.weight}</td><td>{factor.normalized_score===null?'-':factor.normalized_score.toFixed(3)}</td><td>{factor.contribution_score.toFixed(1)}</td></tr>)}
            </tbody></table>
          </div>}
          <div className="table-scroll" tabIndex={0} aria-label="현재 확인사항과 과거 대응조치 비교 표">
            <table className="comparison-table"><caption>현재 확인사항과 과거 대응조치</caption><thead><tr><th scope="col">현재 확인사항</th><th scope="col">과거 조치</th><th scope="col">차이·확인</th></tr></thead><tbody>
              {selectedEvent.response_comparison.map(item=><tr key={item.action_category}><th scope="row">{item.current_required_check}</th><td>{item.past_event_action??'근거 미확보'}</td><td>{item.difference}</td></tr>)}
            </tbody></table>
          </div>
          <p className="safety-note">Mock 가중치와 과거 참고사례를 이용한 비교이며 실제 T3Q 검색성능·공식 대응결정이 아닙니다.</p>
        </section>:null}
      </div>}

      {tab==='대응절차'&&procedures.slice(0,8).map(step=><article className="procedure-card" key={step.procedure_id}><small>{step.stage_name} · 잠정 참고</small><strong>{step.sequence}. {step.action_title}</strong><p>{step.action_description}</p><div className="badge-row"><span>대상지 공식 아님</span><span>담당자 확인 필요</span></div></article>)}

      {tab==='하천'&&<div className="river-tab">
        <div className="notice-card"><strong>이 시군구의 하천</strong><p>국가·지방하천은 하천망도(국가수자원관리종합시스템), 소하천은 소하천구역(연속주제도) 기준입니다. 이름을 누르면 지도가 그 하천으로 이동합니다.</p></div>
        <div className="panel-tabs compact" role="tablist" aria-label="하천 등급" onKeyDown={e=>moveTabFocus<RiverClass>(e,riverClasses,riverClass,setRiverClass,'river-class-tab')}>
          {riverClasses.map((item,index)=><button key={item} id={`river-class-tab-${index}`} role="tab" aria-selected={riverClass===item} tabIndex={riverClass===item?0:-1} type="button" className={riverClass===item?'active':''} onClick={()=>setRiverClass(item)}>{item}</button>)}
        </div>
        {riverError?<p className="inline-error" role="alert">{riverError}</p>:null}
        {!riverLoaded&&!riverError?<p className="plan-status" role="status">하천 목록을 불러오는 중입니다.</p>:null}
        {riverLoaded?<p className="plan-status" role="status" aria-live="polite">{riverRows.length?`${riverRows.length.toLocaleString('ko-KR')}건`:'이 시군구에는 해당 등급의 하천 자료가 없습니다.'}</p>:null}
        <ul className="river-list">
          {riverRows.map(row=><li key={row.key}>
            <button type="button" disabled={!row.nav||!props.onFocusMap} onClick={()=>{if(row.nav)props.onFocusMap?.(row.nav,13);}}>
              <strong>{row.name}</strong>
              <small>{row.detail}</small>
            </button>
          </li>)}
        </ul>
      </div>}

      {tab==='계획·근거'&&<div className="evidence-list plan-reference">
        <div className="notice-card warning"><strong>계획문서 판독 참고정보</strong><p>자연재해저감 종합계획·하천기본계획을 판독한 값이며 공식 위험등급 판정·피해예측이 아닙니다. 원문과 담당자 확인이 필요합니다.</p></div>

        {planState==='loading'?<p className="plan-status" role="status">계획자료를 불러오는 중입니다.</p>:null}
        {planState==='error'?<p className="inline-error" role="alert">계획자료를 불러오지 못했습니다. 나머지 판단 정보는 계속 확인할 수 있습니다.</p>:null}
        {planState==='idle'||planEmpty?<article className="plan-empty"><strong>해당 지역 계획자료 미확보</strong><p>{adminCode?`행정구역 ${adminCode}`:'선택 지역'}의 자연재해저감 종합계획·하천기본계획 판독자료가 아직 없습니다. 계획 PDF 수령 후 구조화 예정입니다.</p></article>:null}

        {planState==='ready'&&districts.length?<section className="plan-district-section" aria-labelledby="plan-district-title">
          <h3 id="plan-district-title">위험지구(자연재해저감 종합계획)</h3>
          <FactList className="plan-summary" rows={[{label:'위험지구 수',value:`${districts.length}개소`},{label:'총사업비(계획서 표기 합계)',value:`${money(totalCost)}${costUnknown?` · 사업비 미확보 ${costUnknown}개소 제외`:''}`}]} />
          <div className="plan-filter-chips" role="group" aria-label="재해유형 필터">
            <button type="button" className={`chip ${typeFilter===ALL_TYPES?'active':''}`} aria-pressed={typeFilter===ALL_TYPES} onClick={()=>setTypeFilter(ALL_TYPES)}>전체 {districts.length}</button>
            {districtTypes.map(([type,count])=><button key={type} type="button" className={`chip ${typeFilter===type?'active':''}`} aria-pressed={typeFilter===type} onClick={()=>setTypeFilter(type)}>{type} {count}</button>)}
          </div>
          <p className="plan-filter-status" role="status">{visibleDistricts.length}개소 표시 중</p>

          {visibleDistricts.map(item=>{
            const open=openDistrict===item.district_code;
            const detailId=`plan-district-detail-${item.district_code}`;
            return <article className={`plan-district-card ${open?'open':''}`} key={item.district_code}>
              <button type="button" className="plan-district-toggle" aria-expanded={open} aria-controls={detailId} onClick={()=>setOpenDistrict(open?null:item.district_code)}>
                <span className="plan-district-head"><strong className={isMetaDemoId(item.district_code)?'meta-demo-text':undefined}>{item.district_name}</strong>{isMetaDemoId(item.district_code)?<span className="meta-demo-badge">표본</span>:null}<span className="plan-badge type">{orMissing(item.disaster_type)}</span></span>
                <span className="plan-district-sub">{orMissing(item.location)}</span>
                <span className="plan-district-sub">계획서 위험도 표기 {orMissing(item.grade)} · 계획 우선순위 {orMissing(item.priority)}</span>
                <span className="plan-district-sub">사업비 {money(item.cost_million_krw)}</span>
              </button>
              <div id={detailId} className="plan-district-detail" hidden={!open}>
                <h4>위험요인(계획서 판독)</h4>
                {item.risk_factors?.length?<ul>{item.risk_factors.map(factor=><li key={factor}>{factor}</li>)}</ul>:<p>위험요인 기재 미확보</p>}

                {item.risk_thresholds?.length?<div className="table-scroll" tabIndex={0} aria-label={`${item.district_name} 위험조건 임계값 표`}>
                  <table className="comparison-table"><caption>{item.district_name} 위험조건 임계값 — 계획서 판독값이며 발령기준이 아닙니다.</caption>
                    <thead><tr><th scope="col">대상</th><th scope="col">조건</th><th scope="col">값</th><th scope="col">단위</th><th scope="col">산정근거</th></tr></thead>
                    <tbody>{item.risk_thresholds.map((row,index)=><tr key={`${row.target}-${index}`}><th scope="row">{orMissing(row.target)}</th><td>{orMissing(row.operator)}</td><td>{row.value===null||row.value===undefined?MISSING:row.value.toLocaleString('ko-KR')}</td><td>{orMissing(row.unit)}</td><td>{[str(row.basis),evidenceText(row.evidence)].filter(Boolean).join(' · ')||MISSING}</td></tr>)}</tbody>
                  </table>
                </div>:<p>임계값 기재 미확보</p>}

                <h4>저감대책</h4>
                {item.mitigation?.length?<ul>{item.mitigation.map(action=><li key={action}>{action}</li>)}</ul>:<p>저감대책 기재 미확보</p>}

                <h4>사업·시행</h4>
                <FactList rows={[
                  {label:'사업비',value:money(item.cost_million_krw)},
                  {label:'계획 예상피해액',value:money(item.expected_damage_million_krw)},
                  {label:'사업상태',value:orMissing(item.project_status)},
                  {label:'시행시기',value:orMissing(item.implementation_period)},
                  {label:'시행방법',value:orMissing(item.implementation_method)},
                  {label:'시행주체',value:orMissing(item.implementer)},
                  {label:'계획 우선순위',value:orMissing(item.priority)},
                  {label:'관련 하천·측점',value:[str(item.river_name),str(item.station)].filter(Boolean).join(' ')||MISSING},
                ]} />

                <h4>피해이력(계획서 기재)</h4>
                {item.damage_events?.length?<ul className="plan-damage-list">{item.damage_events.map((event,index)=><li key={`${item.district_code}-damage-${index}`}>
                  <strong>{orMissing(event.occurred)} {str(event.event_name)??''}</strong>
                  <span>{orMissing(event.description)}</span>
                  {evidenceText(event.evidence)?<small>출처 · {evidenceText(event.evidence)}</small>:null}
                </li>)}</ul>:<p>피해이력 기재 미확보</p>}

                <p className="plan-evidence">근거 · {evidenceText(item.evidence)??MISSING}</p>
              </div>
              {onAddContext?<button type="button" className="context-add-button" onClick={()=>addDistrictContext(item)}>질의에 참조</button>:null}
            </article>;
          })}
        </section>:null}

        {planState==='ready'&&rivers.length?<section className="plan-river-section" aria-labelledby="plan-river-title">
          <h3 id="plan-river-title">하천기본계획</h3>
          {rivers.map(river=><article className="plan-river-card" key={river.river_id}>
            <div className="plan-river-head"><strong>{river.name}</strong><span className="plan-badge grade">{orMissing(river.grade)}</span></div>
            <FactList rows={[
              {label:'유역면적',value:river.basin_area_km2?`${river.basin_area_km2} km²`:MISSING},
              {label:'연장',value:river.length_km?`${river.length_km} km`:MISSING},
              {label:'계획빈도',value:orMissing(river.design_frequency_yr)},
              {label:'시점',value:orMissing(river.start_point)},
              {label:'종점',value:orMissing(river.end_point)},
              {label:'계획명',value:orMissing(river.plan_name)},
              {label:'홍수특보 기준지점',value:[str(river.warning_reference_station?.name),str(river.warning_reference_station?.station_no)].filter(Boolean).join(' ')||MISSING},
            ]} />
            <p className="plan-evidence">근거 · {evidenceText(river.profile_evidence)??MISSING}</p>
            {river.stations?.length?<div className="table-scroll" tabIndex={0} aria-label={`${river.name} 지점별 계획홍수량 표`}>
              <table className="comparison-table plan-station-table">
                <caption>{river.name} 지점별 계획홍수량 — 주의보·경보 열은 계획홍수량 50%/70% 산출 참고값이며 고시 발령값이 아닙니다.</caption>
                <thead><tr><th scope="col">지점</th><th scope="col">측점 No.</th><th scope="col">계획홍수량(㎥/s)</th><th scope="col">주의보 50%(㎥/s)</th><th scope="col">경보 70%(㎥/s)</th></tr></thead>
                <tbody>{river.stations.map(station=>{
                  const flood=designFlood(station);
                  return <tr key={station.station_code}>
                    <th scope="row">{str(station.station_name)??station.station_code}</th>
                    <td>{orMissing(station.station_no)}</td>
                    <td>{numText(flood.value)}{flood.planVersion?<small className="plan-station-version"> {flood.planVersion}</small>:null}</td>
                    <td>{numText(station.flood_warning?.advisory_m3s)}</td>
                    <td>{numText(station.flood_warning?.alert_m3s)}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>:<p>지점별 계획홍수량 미확보</p>}
            {onAddContext?<button type="button" className="context-add-button" onClick={()=>addRiverContext(river)}>질의에 참조</button>:null}
          </article>)}
        </section>:null}

        <article className="plan-source-note"><strong>그 밖의 근거자료</strong><p>침수흔적도·위성영상은 피해·변화 근거 화면에서 확인합니다. 유니 RAG는 로그인·검색 경로 환경변수 설정 시 문서·페이지·Passage 근거를 결합합니다.</p></article>
      </div>}
    </div>

    {detailArea?<DetailModal
      title={detailArea.name}
      badge={str(detailDistrict?.disaster_type)}
      closeLabel="우선 확인지역 상세 정보 창 닫기"
      footNote="본 요약은 관리대장·계획문서 판독 및 Mock/Seed 기반 참고 정보이며, 공식 위험등급 판정이나 피해예측이 아닙니다."
      onClose={closeDetail}
    >
      {/* 메타 표본: 순위·점수·사유·확인항목(우리 산정값) 절을 통째로 뺀다 — 표본 원자료 절만 남긴다. */}
      <FactList className="map-popup-facts" rows={[
        ...(isMetaDemoId(detailArea.spatial_object_id)?[]:[{label:'우선 확인 순위',value:`${detailArea.rank}위 · 상대점수 ${detailArea.score}점(공식 위험등급·피해확률 아님)`}]),
        {label:'공간객체 ID',value:orMissing(detailArea.spatial_object_id)},
        ...districtFactRows(detailDistrict),
        {label:'행정구역',value:orMissing(detailDistrict?.admin_name??detailDistrict?.admin_code??adminCode)},
      ]} />
      {isMetaDemoId(detailArea.spatial_object_id)?<p className="meta-demo-text priority-meta-caption">우선순위 점수·사유 등 산정값은 표본 지역에서 표시하지 않습니다(T3Q 실데이터 수신 전).</p>:<>
      <section className="map-popup-section">
        <h4>우선 확인 사유</h4>
        {detailArea.reasons.length?<ul className="map-popup-list">{detailArea.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>:<p>사유 기재 미확보</p>}
      </section>
      <section className="map-popup-section">
        <h4>담당자 확인 필요 항목</h4>
        {detailArea.required_checks.length?<ul className="map-popup-list">{detailArea.required_checks.map(check=><li key={check}>{check}</li>)}</ul>:<p>확인 항목 미확보</p>}
      </section>
      </>}
      {detailDistrict
        ?<DistrictDetailSections district={detailDistrict} evidence={evidenceText(detailDistrict.evidence)} />
        :<section className="map-popup-section"><h4>계획문서 판독 상세</h4><p>이 지점과 코드가 일치하는 자연재해저감 종합계획 판독자료가 {MISSING} 상태입니다. 계획 PDF 수령 후 구조화 예정입니다.</p></section>}
    </DetailModal>:null}
  </aside>;
}
