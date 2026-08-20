import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type currentSituationsSeed from '../data/seed/current_situations_seed.json';
import type prioritiesSeed from '../data/seed/priority_areas_seed.json';
import type proceduresSeed from '../data/seed/response_procedures_seed.json';
import type satellitesSeed from '../data/seed/satellite_assets_seed.json';
import type reportsSeed from '../data/seed/report_draft_seed.json';
import type damageRecoverySeed from '../data/seed/damage_recovery_events_seed.json';
import type layersSeed from '../data/seed/layer_catalog_seed.json';
import type publicApiCatalogSeed from '../data/seed/public_api_catalog_seed.json';
import type scenarioTimelinesSeed from '../data/seed/scenario_timelines_seed.json';
import type criteriaRef from '../data/reference/criteria.json';
import type districtsRef from '../data/reference/districts.json';
import type riversRef from '../data/reference/rivers.json';
import type geoRef from '../data/reference/geo.json';
import type satelliteEvidenceSetsSeed from '../data/seed/satellite_evidence_sets_seed.json';
import type t3qAlignmentSeed from '../data/seed/t3q_alignment_seed.json';
import type t3qReadinessSeed from '../data/seed/t3q_integration_readiness_seed.json';
import type t3qCqCoverageSeed from '../data/seed/t3q_cq_coverage_seed.json';
import type t3qFieldContractSeed from '../data/seed/t3q_field_contract_seed.json';
import type providerContractsSeed from '../data/seed/provider_contracts_seed.json';
import type similarityWeightProfilesSeed from '../data/seed/similarity_weight_profiles_seed.json';
import type providerConformanceCasesSeed from '../data/seed/provider_conformance_cases_seed.json';

import type t3qMockEventsSeed from '../data/seed/t3q_mock_event_master_seed.json';
import type t3qMockPassagesSeed from '../data/seed/t3q_mock_passages_seed.json';
import type t3qMockRelationsSeed from '../data/seed/t3q_mock_ontology_relations_seed.json';
import type t3qMockSearchScenariosSeed from '../data/seed/t3q_mock_search_scenarios_seed.json';
import type mockContractCatalogSeed from '../data/seed/mock_contract_catalog_seed.json';
import type mockFloodRiskAreasSeed from '../data/seed/mock_flood_risk_areas_seed.json';
import type mockDangerousReservoirsSeed from '../data/seed/mock_dangerous_reservoirs_seed.json';
import type mockStormFloodImprovementDistrictsSeed from '../data/seed/mock_storm_flood_improvement_districts_seed.json';

// ESM(Vercel 런타임)·CJS(로컬 runtime gate) 양쪽에서 동작하도록 JSON은 import 대신
// fs 기반으로 로딩한다. cwd는 Vercel에서 /var/task, 로컬 게이트에서 리포 루트로 동일하게 성립한다.
type RuntimeProcess = { cwd(): string };
const runtime = globalThis as typeof globalThis & { process?: RuntimeProcess };
const readJson = (...segments: string[]): unknown =>
  JSON.parse(readFileSync(join(runtime.process?.cwd?.() ?? '.', 'data', ...segments), 'utf-8'));

const currentSituations = readJson('seed', 'current_situations_seed.json') as typeof currentSituationsSeed;
const priorities = readJson('seed', 'priority_areas_seed.json') as typeof prioritiesSeed;
const procedures = readJson('seed', 'response_procedures_seed.json') as typeof proceduresSeed;
const satellites = readJson('seed', 'satellite_assets_seed.json') as typeof satellitesSeed;
const reports = readJson('seed', 'report_draft_seed.json') as typeof reportsSeed;
const damageRecovery = readJson('seed', 'damage_recovery_events_seed.json') as typeof damageRecoverySeed;
const layers = readJson('seed', 'layer_catalog_seed.json') as typeof layersSeed;
const publicApiCatalog = readJson('seed', 'public_api_catalog_seed.json') as typeof publicApiCatalogSeed;
const scenarioTimelines = readJson('seed', 'scenario_timelines_seed.json') as typeof scenarioTimelinesSeed;
const criteria = readJson('reference', 'criteria.json') as typeof criteriaRef;
const districts = readJson('reference', 'districts.json') as typeof districtsRef;
const rivers = readJson('reference', 'rivers.json') as typeof riversRef;
const geo = readJson('reference', 'geo.json') as typeof geoRef;
const metaDemoCqAnswers = readJson('seed', 'meta_demo_cq_answers_seed.json') as { entries: Array<Record<string, unknown>> };
const satelliteEvidenceSets = readJson('seed', 'satellite_evidence_sets_seed.json') as typeof satelliteEvidenceSetsSeed;
const t3qAlignment = readJson('seed', 't3q_alignment_seed.json') as typeof t3qAlignmentSeed;
const t3qReadiness = readJson('seed', 't3q_integration_readiness_seed.json') as typeof t3qReadinessSeed;
const t3qCqCoverage = readJson('seed', 't3q_cq_coverage_seed.json') as typeof t3qCqCoverageSeed;
const t3qFieldContract = readJson('seed', 't3q_field_contract_seed.json') as typeof t3qFieldContractSeed;
const providerContracts = readJson('seed', 'provider_contracts_seed.json') as typeof providerContractsSeed;
const similarityWeightProfiles = readJson('seed', 'similarity_weight_profiles_seed.json') as typeof similarityWeightProfilesSeed;
const providerConformanceCases = readJson('seed', 'provider_conformance_cases_seed.json') as typeof providerConformanceCasesSeed;

const t3qMockEvents = readJson('seed', 't3q_mock_event_master_seed.json') as typeof t3qMockEventsSeed;
const t3qMockPassages = readJson('seed', 't3q_mock_passages_seed.json') as typeof t3qMockPassagesSeed;
const t3qMockRelations = readJson('seed', 't3q_mock_ontology_relations_seed.json') as typeof t3qMockRelationsSeed;
const t3qMockSearchScenarios = readJson('seed', 't3q_mock_search_scenarios_seed.json') as typeof t3qMockSearchScenariosSeed;
const mockContractCatalog = readJson('seed', 'mock_contract_catalog_seed.json') as typeof mockContractCatalogSeed;
const mockFloodRiskAreas = readJson('seed', 'mock_flood_risk_areas_seed.json') as typeof mockFloodRiskAreasSeed;
const mockDangerousReservoirs = readJson('seed', 'mock_dangerous_reservoirs_seed.json') as typeof mockDangerousReservoirsSeed;
const mockStormFloodImprovementDistricts = readJson('seed', 'mock_storm_flood_improvement_districts_seed.json') as typeof mockStormFloodImprovementDistrictsSeed;
export const seed={currentSituations,metaDemoCqAnswers,priorities,procedures,satellites,reports,damageRecovery,layers,publicApiCatalog,scenarioTimelines,criteria,districts,rivers,geo,satelliteEvidenceSets,t3qAlignment,t3qReadiness,t3qCqCoverage,t3qFieldContract,t3qMockEvents,t3qMockPassages,t3qMockRelations,t3qMockSearchScenarios,mockContractCatalog,mockFloodRiskAreas,mockDangerousReservoirs,mockStormFloodImprovementDistricts,providerContracts,similarityWeightProfiles,providerConformanceCases} as const;
