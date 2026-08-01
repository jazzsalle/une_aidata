export type DataStatus = 'actual'|'actual_backed'|'open_api'|'t3q_supplied'|'derived'|'scenario'|'scenario_input'|'mock'|'synthetic_demo'|'provisional'|'not_available';
export type SituationMode = 'live' | 'hybrid' | 'scenario';

export interface Observation {
  observation_id?: string;
  type: string;
  station_id?: string | null;
  name?: string | null;
  value: unknown;
  unit?: string | null;
  trend?: string | null;
  observed_at: string;
  source_provider?: string;
  value_status?: DataStatus;
  official_data: boolean;
}
export interface CurrentSituation {
  situation_id: string; admin_code: string; admin_name?: string | null; reference_time: string;
  mode: SituationMode; hazards: string[]; user_input?: Record<string, unknown>;
  observations: Observation[]; data_quality: Record<string, unknown>; warnings?: string[];
}
export interface PriorityArea {
  rank: number; spatial_object_id: string; name: string; score: number;
  component_scores: Record<string, number>; reasons: string[]; required_checks: string[];
  operator_confirmation_required: true;
}
export interface PriorityAreaResult {
  situation_id: string; generated_at: string; method: string; official_risk_score: false; areas: PriorityArea[];
}
export interface EvidenceItem {
  evidence_id: string; source_type: string; title: string; excerpt?: string | null;
  document_id?: string | null; page?: number | null; passage_id?: string | null;
  score?: number | null; url?: string | null; data_status: DataStatus;
}
export type ProviderKind='mock'|'t3q'|'openapi'|'local';
export interface DataQuality { completeness?:number|null; verified?:boolean; issues?:string[]; }
export interface DataProvenance { data_status:DataStatus; source_type:string; provider_id:string; official_data:boolean; provisional:boolean; observed_at?:string|null; reference_at?:string|null; schema_version:string; evidence?:EvidenceItem[]; quality?:DataQuality; }
export interface SimilarityFactorScore { factor_code:string; factor_name:string; current_value:unknown; candidate_value:unknown; unit?:string|null; normalized_score:number|null; weight:number; effective_weight:number; contribution_score:number; availability:'AVAILABLE'|'NOT_AVAILABLE'; comparison_description:string; evidence_ids:string[]; }
export interface SimilarityScoreSummary { profile_id:string; profile_version:string; event_similarity_score:number; retrieval_relevance_score:number|null; available_weight:number; comparison_coverage:number; confidence_status:'HIGH'|'MEDIUM'|'LIMITED'; graph_similarity_score:null; graph_similarity_status:'NOT_AVAILABLE'; factors:SimilarityFactorScore[]; }
export interface ResponseComparisonItem { action_category:string; current_required_check:string; past_event_action:string|null; past_action_time?:string|null; responsible_agency?:string|null; past_outcome?:string|null; difference:string; evidence_ids:string[]; operator_confirmation_required:true; }
export interface SimilarEvent {
  event_id: string; record_id: string; admin_code: string; admin_name: string; event_name: string;
  occurred_from: string; occurred_to?: string | null; hazards: string[];
  similarity_score: number; similarity_reasons: string[]; spatial_relation: string;
  similarity: SimilarityScoreSummary; response_comparison: ResponseComparisonItem[];
  conditions?: Record<string, unknown>; damage: Record<string, unknown>;
  response: Array<Record<string, unknown>>; recovery: Array<Record<string, unknown>>;
  evidence: EvidenceItem[]; data_status: DataStatus; source_type?:string; provider_id?:string; official_data: boolean; is_prediction: false;
  display_badges?: string[];
}
export interface ProviderContract { domain:'event'|'risk'|'observation'|'spatial'; env_key:string; current:string; allowed:string[]; common_model:string; future_api_content:string[]; fallback:string; }
export interface SimilarityWeightProfile { profile_id:string; hazard_codes:string[]; version:string; weights:Record<string,number>; missing_value_policy:'RENORMALIZE_AVAILABLE_WEIGHTS'; minimum_coverage:number; }
export interface IntegrationStatus {
  integration_id: string; name: string; configured: boolean; runtime_mode: string;
  message: string; required_env: string[]; checked_at: string; validation_state?: 'verified'|'configured'|'pending'|'fallback'|'error'; next_action?: string;
}


export interface ReportEvidenceSelection {
  satellite_pair?: { left_asset_id: string; right_asset_id: string; added_at: string } | null;
  satellite_event_set?: { asset_ids: string[]; event_id: string; evidence_set_id?: string; provenance_version?: string; target_region_match?: boolean; added_at: string } | null;
  similar_event_ids: string[];
  include_flood_trace: boolean;
  updated_at: string;
}

export interface SatelliteEvidenceSet {
  evidence_set_id: string; title: string; version: string; event_id: string; hazards: string[];
  event_start_at: string; event_end_at: string; phase_policy: Record<string,string>;
  area: { area_id:string; admin_code:string; admin_name:string; is_target_region:boolean; area_scope:string; target_area_note:string };
  asset_ids: string[]; tile_size_px: [number,number]; display_mode: 'standalone_tile_card'; map_overlay_allowed: false; base_map: 'VWorld 2D';
  data_status: DataStatus; official_data: false; shared_demo: true; is_prediction: false; provider: string; replacement_provider: string; replacement_status: string;
  provenance: Record<string,unknown>; integrity: {algorithm:string;verified_at:string;assets:Array<{asset_id:string;file:string;sha256:string;bytes:number;width:number;height:number}>};
  usage_limits: string[]; display_badges: string[];
}


export type T3qDisasterType = 'FLOOD'|'TYPH'|'QUAKE'|'SLOPE'|'FIRE'|'SNOW'|'FIRE_S'|'CHEM'|'BIO';
export type T3qRelationType = 'ref_event'|'spatial'|'references'|'type_match'|'relates_to'|'derived'|'code_ref';
export interface PassageLineage {
  source_asset_id?: string | null; source_file?: string | null; source_sheet?: string | null;
  source_row?: number | null; document_page?: number | null; version?: string | null;
}
export interface T3qPassage {
  passage_id: string; schema_type: string; ref_disaster_event_id?: string | null;
  taxonomy_codes: string[]; title?: string | null; content?: string | null;
  admin_code?: string | null; legal_region_code?: string | null;
  lineage: PassageLineage; data_status: DataStatus;
}
export interface T3qEventMaster {
  event_id: string; disaster_type: T3qDisasterType; taxonomy_codes: string[];
  region_code_5: string; legal_region_code_10?: string | null; sequence: number;
  event_status: '발생'|'진행'|'종료'|'보정'|'병합'; started_at?: string | null; ended_at?: string | null;
  crisis_level?: 'LVL_01'|'LVL_02'|'LVL_03'|'LVL_04'|null; risk_factors?: string[];
}
export interface OntologyRelation {
  relation_id?: string; relation_type: T3qRelationType; source_id: string; target_id: string;
  source_schema?: string | null; target_schema?: string | null; data_status: DataStatus;
}


export type T3qReadinessState = 'designed'|'seed_ready'|'configured'|'verified'|'pending'|'error';
export interface T3qReadinessDimension {
  dimension_id:string; name:string; state:T3qReadinessState; implemented:string[]; pending:string[]; completion_gate:string;
}
export interface T3qIntegrationReadiness {
  dataset?:string; version?:string; as_of?:string; source_status?:string; overall_state:string; notice?:string;
  dimensions:T3qReadinessDimension[]; required_consultation_items:string[];
}
export interface T3qCqCoverageItem {
  cq_id:string; question:string; design_state:'covered'|'partial'|'missing'; runtime_state:'verified'|'configured'|'partial'|'seed'|'pending'|'error';
  required_schema_types:string[]; search_filters:string[]; screen_outputs:string[]; current_providers:string[]; blocking_items:string[]; fallback:string;
}
export interface T3qCqCoverage { dataset?:string; version?:string; as_of?:string; coverage_basis?:string; items:T3qCqCoverageItem[]; }
export interface T3qSearchRequest { query:string; admin_code?:string|null; taxonomy_codes:string[]; schema_types?:string[]; top_k:number; }
export interface T3qSearchPreview { request:T3qSearchRequest; mode:'mock_contract'|'pending'; events:T3qEventMaster[]; passages:T3qPassage[]; warnings:string[]; }

export interface T3qMockCatalog {
  dataset:string; version:string; runtime_policy:'MOCK_FIRST_PROVIDER_NEUTRAL'; generated_at:string;
  contracts:Array<{id:string;file:string;count:number;schema:string}>; safety_rules:string[];
}
export interface T3qMockSearchScenario {
  scenario_id:string; cq_id:string; title:string; query:string; admin_code:string;
  taxonomy_codes:string[]; schema_types:string[]; expected_layers:string[];
  expected_event_ids:string[]; expected_warning?:string;
}

export type ProviderConformanceStatus='PASS'|'CONDITIONAL_PASS'|'BLOCKED'|'FAIL';
export type ProviderLifecycle='DRAFT'|'FIXTURE_VALIDATED'|'SHADOW_TESTED'|'SELECTABLE'|'DEFAULT';
export interface ProviderConformanceCase { case_id:string; name:string; provider_selection:Record<string,string>; fixtures:Record<string,string>; expected_status:ProviderConformanceStatus; expected_lifecycle:ProviderLifecycle; note:string; }
