// 자연재해저감 종합계획·하천기본계획 판독 산출물(data/reference/districts.json, rivers.json)의 화면용 타입.
// 계약(contracts.ts)이 아니라 정적 참고자료 구조이며, public/seed 로 배포되어 프런트가 직접 읽는다.
// 값은 문서 판독 결과이므로 결측(null)이 정상이며 화면에서 "미확보"로 표기한다.

export interface ReferenceEvidence {
  source_asset_id?: string;
  doc_title?: string;
  doc?: string;
  chapter?: string;
  chapter_page?: string;
  page?: number | null;
  pdf_page?: number | number[] | null;
  page_label?: string;
  table?: string;
  passage_id?: string;
}

export interface DistrictThreshold {
  target: string;
  operator?: string;
  value?: number | null;
  unit?: string;
  basis?: string;
  evidence?: ReferenceEvidence;
}

export interface DistrictDamageEvent {
  occurred?: string;
  event_name?: string;
  hazard_codes?: string[];
  description?: string;
  evidence?: ReferenceEvidence;
}

export interface DistrictReference {
  district_code: string;
  ledger_code?: string;
  district_name: string;
  admin_code: string;
  admin_name?: string;
  disaster_type?: string;
  disaster_subtype?: string;
  hazard_codes?: string[];
  location?: string;
  river_name?: string;
  station?: string;
  risk_factors?: string[];
  risk_thresholds?: DistrictThreshold[];
  grade?: string | null;
  mitigation?: string[];
  project_status?: string;
  implementation_period?: string;
  implementation_method?: string;
  cost_million_krw?: number | null;
  expected_damage_million_krw?: number | null;
  priority?: string | number | null;
  implementer?: string | null;
  damage_events?: DistrictDamageEvent[];
  coordinates?: number[] | null;
  evidence?: ReferenceEvidence;
}

export interface RiverStation {
  station_code: string;
  station_name?: string;
  station_no?: string;
  basin_area_km2?: number | null;
  flow_length_km?: number | null;
  design_flood_m3s?: number | null;
  design_frequency_yr?: number | string | null;
  prev_design_flood_m3s?: number | null;
  flood_warning?: { advisory_m3s?: number | null; alert_m3s?: number | null } | null;
  evidence?: ReferenceEvidence;
}

export interface RiverReference {
  river_id: string;
  name: string;
  grade?: string;
  admin_code: string;
  admin_name?: string;
  basin_area_km2?: number | null;
  length_km?: number | null;
  length_note?: string;
  flow_length_km?: number | null;
  design_frequency_yr?: number | string | null;
  start_point?: string;
  end_point?: string;
  plan_name?: string;
  warning_reference_station?: { station_code?: string; name?: string; station_no?: string; note?: string } | null;
  stations?: RiverStation[];
  profile_evidence?: ReferenceEvidence;
}

export interface PlanReference {
  districts: DistrictReference[];
  rivers: RiverReference[];
}
