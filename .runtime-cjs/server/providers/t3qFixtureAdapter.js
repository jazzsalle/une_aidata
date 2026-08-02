"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.T3Q_SPATIAL_REQUIRED_FIELDS = exports.T3Q_RISK_REQUIRED_FIELDS = void 0;
exports.mapT3qEventFixture = mapT3qEventFixture;
exports.mapT3qRiskFixture = mapT3qRiskFixture;
exports.mapT3qSpatialFixture = mapT3qSpatialFixture;
function rec(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}; }
function arr(value) { return Array.isArray(value) ? value : []; }
function str(value) { return typeof value === 'string' && value.length ? value : null; }
function num(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function strArr(value) { return arr(value).filter((item) => typeof item === 'string'); }
const FIXTURE_NOTICE = 'T3Q Fixture 매핑 검증 결과입니다. 실제 T3Q 데이터·공식 위험정보·피해예측이 아니며 official_data=false, data_status=mock을 유지합니다.';
// T3Q 오류 형식은 미확정이므로 fixture의 result_code/error 형태만 해석하고, 확정 시 이 함수 내부만 교체한다.
function fixtureError(root) {
    const resultCode = str(root.result_code);
    const error = rec(root.error);
    const code = str(error.code) ?? (resultCode && resultCode !== 'SUCCESS' ? resultCode : null);
    if (!code)
        return null;
    return { code, message: str(error.message) ?? '오류 상세 미제공' };
}
const DISASTER_TYPES = ['FLOOD', 'TYPH', 'QUAKE', 'SLOPE', 'FIRE', 'SNOW', 'FIRE_S', 'CHEM', 'BIO'];
const EVENT_STATUSES = ['발생', '진행', '종료', '보정', '병합'];
const CRISIS_LEVELS = ['LVL_01', 'LVL_02', 'LVL_03', 'LVL_04'];
function disasterType(value) {
    return typeof value === 'string' && DISASTER_TYPES.includes(value) ? value : null;
}
function eventStatus(value) {
    return typeof value === 'string' && EVENT_STATUSES.includes(value) ? value : null;
}
function crisisLevel(value) {
    return typeof value === 'string' && CRISIS_LEVELS.includes(value) ? value : null;
}
function mapEventRow(row) {
    const eventId = str(row.event_id);
    const type = disasterType(row.disaster_type);
    const region = str(row.region_code_5);
    const sequence = num(row.sequence);
    const status = eventStatus(row.event_status);
    if (!eventId || !type || !region || sequence === null || !status)
        return null;
    return {
        event_id: eventId,
        disaster_type: type,
        taxonomy_codes: strArr(row.taxonomy_codes),
        region_code_5: region,
        legal_region_code_10: str(row.legal_region_code_10),
        sequence,
        event_status: status,
        started_at: str(row.started_at),
        ended_at: str(row.ended_at),
        crisis_level: crisisLevel(row.crisis_level),
        risk_factors: strArr(row.risk_factors),
    };
}
function mapPassageRow(row) {
    const passageId = str(row.passage_id);
    const schemaType = str(row.schema_type);
    if (!passageId || !schemaType)
        return null;
    const lineageRaw = rec(row.lineage);
    const lineage = {
        source_asset_id: str(lineageRaw.source_asset_id),
        source_file: str(lineageRaw.source_file),
        source_sheet: str(lineageRaw.source_sheet),
        source_row: num(lineageRaw.source_row),
        document_page: num(lineageRaw.document_page),
        version: str(lineageRaw.version),
    };
    return {
        passage_id: passageId,
        schema_type: schemaType,
        ref_disaster_event_id: str(row.ref_disaster_event_id),
        taxonomy_codes: strArr(row.taxonomy_codes),
        title: str(row.title),
        content: str(row.content),
        admin_code: str(row.admin_code),
        legal_region_code: str(row.legal_region_code),
        lineage,
        // fixture 유래 Passage는 실데이터로 보이면 안 되므로 data_status='mock'을 강제한다.
        data_status: 'mock',
    };
}
// event 도메인: fixture payload → T3qEventMaster/T3qPassage 계약 매핑 (taxonomy_codes·lineage 보존).
// 오류 payload는 예외를 전파하지 않고 빈 결과 + warning으로 반환하여 mock_contract/pending Fallback을 유지한다.
function mapT3qEventFixture(payload) {
    const root = rec(payload);
    const error = fixtureError(root);
    if (error) {
        return {
            events: [],
            passages: [],
            warning: `T3Q Event Fixture 오류(${error.code}): ${error.message} — 서비스 오류로 전파하지 않고 mock_contract/pending Fallback(Seed 결과)을 유지합니다.`,
        };
    }
    const events = arr(root.events).map((row) => mapEventRow(rec(row))).filter((row) => row !== null);
    const passages = arr(root.passages).map((row) => mapPassageRow(rec(row))).filter((row) => row !== null);
    return { events, passages, warning: FIXTURE_NOTICE };
}
// risk 도메인 required_fields (provider_contracts_seed.json risk.future_api_content과 동일 목록 — Seed는 수정하지 않고 검증용 상수로만 사용).
exports.T3Q_RISK_REQUIRED_FIELDS = ['risk_id', 'hazard_codes', 'admin_code', 'district', 'risk_factors', 'thresholds', 'mitigation', 'geometry_ref', 'evidence'];
function mapEvidenceRefs(value) {
    return arr(value).map(rec).flatMap((row) => {
        const passageId = str(row.passage_id);
        return passageId ? [{ passage_id: passageId, source_file: str(row.source_file), document_page: num(row.document_page) }] : [];
    });
}
// risk 도메인: required_fields 커버 검증이 가능한 구조로 매핑한다. 화면·레이어 활성화 코드 없음 — 순수 매핑만.
// NO_DATA·오류는 데이터 미확보 정상 처리로 보고 local_plan_seed Fallback을 지시하며 임의 위험정보를 합성하지 않는다.
function mapT3qRiskFixture(payload) {
    const root = rec(payload);
    const base = { required_fields: exports.T3Q_RISK_REQUIRED_FIELDS, official_data: false, data_status: 'mock' };
    const error = fixtureError(root);
    if (error) {
        return {
            ...base,
            risks: [],
            missing_required_fields: {},
            fallback: 'local_plan_seed',
            warning: error.code === 'NO_DATA'
                ? 'T3Q Risk Fixture NO_DATA: 데이터 미확보를 정상 결과로 처리하고 local_plan_seed Fallback을 사용합니다. 임의 위험정보를 합성하지 않습니다.'
                : `T3Q Risk Fixture 오류(${error.code}): ${error.message} — local_plan_seed Fallback을 유지합니다.`,
        };
    }
    const missing = {};
    const risks = arr(root.risks).map(rec).flatMap((row, index) => {
        const riskId = str(row.risk_id) ?? `UNKNOWN-RISK-${index}`;
        const absent = exports.T3Q_RISK_REQUIRED_FIELDS.filter((field) => row[field] === undefined || row[field] === null);
        if (absent.length)
            missing[riskId] = [...absent];
        const geometryRaw = rec(row.geometry_ref);
        return [{
                risk_id: riskId,
                hazard_codes: strArr(row.hazard_codes),
                admin_code: str(row.admin_code) ?? '',
                district: str(row.district) ?? '',
                risk_factors: strArr(row.risk_factors),
                thresholds: rec(row.thresholds),
                mitigation: strArr(row.mitigation),
                geometry_ref: {
                    spatial_object_id: str(geometryRaw.spatial_object_id),
                    layer_id: str(geometryRaw.layer_id),
                    // Geometry는 좌표계·속성·공개등급 검증 전이므로 mock 상태를 보존한다(화면 활성화 금지).
                    geometry_status: str(geometryRaw.geometry_status) ?? 'mock',
                    note: str(geometryRaw.note),
                },
                evidence: mapEvidenceRefs(row.evidence),
                data_status: 'mock',
                official_data: false,
                is_prediction: false,
            }];
    });
    return { ...base, risks, missing_required_fields: missing, warning: FIXTURE_NOTICE };
}
// spatial 도메인 required_fields (provider_contracts_seed.json spatial.future_api_content과 동일 목록 — 검증용 상수).
exports.T3Q_SPATIAL_REQUIRED_FIELDS = ['spatial_object_id', 'layer_id', 'geometry', 'crs', 'properties', 'admin_code', 'hazard_codes', 'effective_at', 'evidence'];
// spatial 도메인: FeatureCollection 매핑 + map_activation_allowed=false·geometry_status 보존.
// CRS_NOT_CONFIRMED 등 좌표계 미확정 오류 payload는 임의 표출 없이 local_geojson_provider Fallback 형태로 반환한다.
function mapT3qSpatialFixture(payload) {
    const root = rec(payload);
    const base = {
        map_activation_allowed: false,
        required_fields: exports.T3Q_SPATIAL_REQUIRED_FIELDS,
        official_data: false,
        data_status: 'mock',
    };
    const error = fixtureError(root);
    if (error) {
        return {
            ...base,
            feature_collection: { type: 'FeatureCollection', crs: null, features: [] },
            geometry_status: 'not_available',
            missing_required_fields: {},
            fallback: 'local_geojson_provider',
            warning: `T3Q Spatial Fixture 오류(${error.code}): ${error.message} — 좌표계·공개등급 미확정 상태를 유지하고 임의 표출 없이 local_geojson_provider Fallback(기존 mock GeoJSON Seed)을 사용합니다.`,
        };
    }
    const collectionRaw = rec(root.feature_collection);
    const crs = root.feature_collection !== undefined && collectionRaw.crs !== undefined ? rec(collectionRaw.crs) : null;
    const missing = {};
    const features = arr(collectionRaw.features).map(rec).map((row, index) => {
        const propertiesRaw = rec(row.properties);
        const featureId = str(row.id) ?? str(propertiesRaw.spatial_object_id) ?? `UNKNOWN-FEATURE-${index}`;
        const absent = exports.T3Q_SPATIAL_REQUIRED_FIELDS.filter((field) => {
            if (field === 'geometry')
                return row.geometry === undefined || row.geometry === null;
            if (field === 'properties')
                return row.properties === undefined || row.properties === null;
            if (field === 'crs')
                return crs === null;
            return propertiesRaw[field] === undefined || propertiesRaw[field] === null;
        });
        if (absent.length)
            missing[featureId] = [...absent];
        return {
            type: 'Feature',
            id: str(row.id),
            geometry: row.geometry === undefined || row.geometry === null ? null : rec(row.geometry),
            // 속성은 보존하되 fixture 성격 필드는 강제한다 — mock Geometry는 지도(화면) 활성화에 사용하지 않는다.
            properties: {
                ...propertiesRaw,
                data_status: 'mock',
                official_data: false,
                is_prediction: false,
                map_activation_allowed: false,
            },
        };
    });
    return {
        ...base,
        feature_collection: { type: 'FeatureCollection', crs, features },
        geometry_status: 'mock',
        missing_required_fields: missing,
        warning: FIXTURE_NOTICE,
    };
}
