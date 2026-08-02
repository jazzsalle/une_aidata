import { badRequest, body, envelope } from '../../../http.js';
import type { CurrentSituation, ReportEvidenceSelection } from '../../../contracts.js';
import { calculatePriorityAreas } from '../../../domain/priorityAreas.js';
import { searchSimilarEvents } from '../../../domain/similarEvents.js';
import { findSeedSituation } from '../../../domain/situations.js';
import { seed } from '../../../seeds.js';

export async function POST(request: Request){
  try{
    const input=await body<{situation?:CurrentSituation;situation_id?:string;selected_evidence?:ReportEvidenceSelection}>(request);
    const situation=input.situation??(input.situation_id?findSeedSituation(input.situation_id):undefined);
    if(!situation)return badRequest('situation이 필요합니다.');

    const priority=calculatePriorityAreas(situation);
    const selection=input.selected_evidence;
    const selectedIds=selection?.similar_event_ids??[];
    const ranked=selectedIds.length?await searchSimilarEvents(situation,15):{events:[],warnings:[]};
    const selectedEvents=ranked.events.filter((item)=>selectedIds.includes(item.event_id));
    const selectedAssetIds=selection?.satellite_event_set?.asset_ids ?? [selection?.satellite_pair?.left_asset_id,selection?.satellite_pair?.right_asset_id].filter(Boolean);
    const selectedSatellites=(seed.satellites.assets as Array<any>).filter((item)=>selectedAssetIds.includes(item.asset_id));

    const report={
      report_id:`RPT-${crypto.randomUUID()}`,
      situation_id:situation.situation_id,
      status:'DRAFT',
      ndms_submission:false,
      sections:{
        overview:`${situation.admin_name??situation.admin_code} ${situation.hazards.join('·')} 상황`,
        current_conditions:situation.observations.map((item)=>`${item.name??item.type}: ${String(item.value)}${item.unit??''} (${item.value_status??'scenario'})`),
        priority_areas:priority.areas.map((a)=>({name:a.name,reasons:a.reasons,required_checks:a.required_checks})),
        reference_evidence:{
          satellite_assets:selectedSatellites.map((item)=>({asset_id:item.asset_id,phase:item.phase_label??item.phase,acquired_at:item.acquired_at,data_status:item.data_status,official_data:item.official_data})),
          flood_trace_included:Boolean(selection?.include_flood_trace),
          similar_events:selectedEvents.map((item)=>({
            event_id:item.event_id,
            event_name:item.event_name,
            occurred_from:item.occurred_from,
            event_similarity_score:item.similarity.event_similarity_score,
            retrieval_relevance_score:item.similarity.retrieval_relevance_score,
            comparison_coverage:item.similarity.comparison_coverage,
            confidence_status:item.similarity.confidence_status,
            similarity_factors:item.similarity.factors,
            response_comparison:item.response_comparison,
            damage:item.damage,
            response:item.response,
            recovery:item.recovery,
            evidence:item.evidence,
            data_status:item.data_status,
            is_prediction:false,
            official_data:item.official_data
          }))
        },
        damage_recovery_note:'과거 유사사례 피해·복구 참고정보이며 현재 피해예측 또는 현재 피해현황이 아닙니다.',
        similarity_note:'사건 유사도·요인별 기여도·대응비교는 Mock 정책 검증 결과이며 실제 T3Q RAG 성능 또는 공식 판단 결과가 아닙니다.',
        operator_actions:[],
        unconfirmed_items:['현장 확인 결과','통제·대피 조치 여부','현재 피해현황']
      },
      limitations:['담당자 검토용 초안입니다.','NDMS 자동제출 기능이 아닙니다.',...ranked.warnings]
    };
    return envelope(report,{provider:'ReportDraftFunction',dataStatus:'provisional',warnings:['담당자 검토용 초안이며 NDMS 자동제출이 아닙니다.','선택한 과거 피해·복구 자료는 참고근거이며 현재 피해현황으로 자동 전환하지 않습니다.']});
  }catch(error){
    return badRequest(error instanceof Error?error.message:'보고서 생성 실패');
  }
}
