import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'ol/ol.css';
import { createVWorldMap, type BaseMapType, type MapConnectionState, type MapFeatureHover, type MapFeatureSelection, type MapPoiPlacement, type VWorldMapHandle } from './VWorldMapAdapter';
import type { RiverSourceState } from './riverLayers';
import {
  RIVER_LAYER_SOURCES, SEMANTIC_ALIGNMENT_NOTE, SEMANTIC_LABEL,
  isRiverLayerId, riverLayerId, riverSourceById, riverSourceIdOf,
} from './riverLayerSources';
import { DEFAULT_MAP_REGION, type MapRegion, dataCodeOfApp, groupBySido, isMetaDemoId, loadMapRegions, mapRegionIn } from './mapRegions';
import { entryInRegion, loadRiverSearchIndex, searchRivers, type RiverSearchEntry } from './riverSearchIndex';
import { loadPlanReference } from '../../services/apiClient';
// 위험지구 상세 렌더·표기 규칙은 '현재 판단' 상세보기 모달과 공용 컴포넌트를 재사용한다.
import { DistrictDetailSections, FactList, MISSING, districtFactRows, evidenceText, orMissing, str, type Fact } from '../../components/DistrictDetail';
import type { PriorityArea } from '../../types/contracts';
import type { DistrictReference, PlanReference, ReferenceEvidence, RiverReference } from '../../types/planReference';
import type { AgentContextItem } from '../../types/uiContext';

interface Props {
  adminCode: string;
  /** 상단에서 고른 시군구. 주면 이 값이 지도 지역이 된다(앱 지역과 별개로 움직인다). */
  mapRegion?: string;
  /** 지도 안(검색창 시군구 선택 · 검색 결과 클릭)에서 지역이 바뀔 때 올려 보낸다. 상단 선택기가
   *  같이 따라와야 한다 — 지도는 동작구인데 상단은 강남구면 어느 쪽이 맞는지 알 수 없다. */
  onRegionChange?(code: string): void;
  /** 바깥(하천 목록 등)에서 지도를 옮길 때 쓴다. key 가 바뀔 때만 움직인다. */
  focusTarget?: { key: string; lonLat: [number, number]; zoom?: number } | null;
  highlightedFeatureId?: string | null;
  initialVisible?: Partial<Record<string, boolean>>;
  compact?: boolean;
  /** POI 호버 요약 카드의 지표 1줄(우선순위·점수)에 쓴다. 없으면 재해유형으로 대체한다. */
  priorityAreas?: PriorityArea[];
  /** 팝업의 '질의에 참조 추가' 배선용. 미연결이어도 동작이 깨지지 않도록 optional 이다. */
  onSelectFeature?(item: AgentContextItem): void;
}
/** 칩 행에 노출하는 대표 하천 소스. 나머지 소스(비교용 Seed·중심선)는 레이어 메뉴에서 켠다 —
 *  `.map-layer-chips` 는 nowrap·overflow:hidden 이라 소스 수만큼 칩을 늘리면 기존 칩이 잘린다. */
const PRIMARY_RIVER_SOURCE = 'ngii-realwidth';
const core = [
  { name: '하천', code: riverLayerId(PRIMARY_RIVER_SOURCE) },
  { name: '위험지구', code: 'L1' },
  { name: '행정경계', code: 'L3' },
  { name: '침수흔적', code: 'L-FLOOD-TRACE' },
  { name: '붕괴위험지역', code: 'L-RISK-COLLAPSE' },
  { name: '위험저수지', code: 'L-RISK-RESERVOIR' },
  { name: '풍수해개선지구', code: 'L-RISK-STORM' },
  // 홍수위험지역·위험저수지·풍수해개선지구 mock 은 2026-08-19 지도에서 뺐다. 실제 Geometry·속성 계약
  // 전 임의 표출하지 않는다는 규칙(v1.0·v1.1)대로 시드·API 계약만 두고 화면에는 올리지 않는다.
  // 관측소는 전국 자료다. 시범서비스 대상이 전국이고 검증만 3개 지역이라 지역별로 자르지 않는다.
  { name: '수위관측소', code: 'L-STATION-WL' },
  { name: '강수량관측소', code: 'L-STATION-RF' },
];
const PENDING_LAYERS = ['피해위치', '대피소'];
const LAYER_LABEL: Record<string, string> = {
  L1: '위험지구', L2: '하천', L3: '행정경계',
  FLOOD_TRACE: '침수흔적', 'L-FLOOD-TRACE': '침수흔적',
  'L-RISK-COLLAPSE': '붕괴위험지역', 'L-RISK-RESERVOIR': '위험저수지', 'L-RISK-STORM': '풍수해개선지구',
  'L-STATION-WL': '수위관측소', 'L-STATION-RF': '강수량관측소',
};
/** 전국 관측소 레이어(수위·강수량). 이 자료만 계획문서 판독물이 아니라 공공 API 원본이다. */
const isStationLayer = (layerId: string) => layerId === 'L-STATION-WL' || layerId === 'L-STATION-RF';
const layerLabel = (layerId: string) =>
  (isRiverLayerId(layerId) ? riverSourceById(riverSourceIdOf(layerId))?.label : undefined) ?? LAYER_LABEL[layerId] ?? layerId;
/** 소스가 실제로 무엇으로 그려지고 있는지. 'WMS인 줄 알았는데 로컬 Seed였다'가 없게 팝업에 그대로 적는다. */
const DELIVERY_LABEL: Record<RiverSourceState['delivery'], string> = {
  wms: 'VWorld WMS (서버 렌더)',
  geojson: '로컬 GeoJSON (오프라인 추출)',
  unavailable: '표시 불가',
};
/** 레이어 메뉴의 상태 칸은 폭이 좁다. 긴 설명은 팝업이 맡고 여기서는 공급경로만 짧게 적는다. */
const DELIVERY_SHORT: Record<RiverSourceState['delivery'], string> = { wms: 'WMS', geojson: 'Seed', unavailable: '불가' };

const list = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => str(item)).filter((item): item is string => Boolean(item)) : []);
function sourceEvidence(properties: Record<string, unknown>): ReferenceEvidence | null {
  const source = properties.source;
  if (source && typeof source === 'object') return source as ReferenceEvidence;
  return null;
}

/** 레이어별 공통·부가 표기. 없는 항목은 '미확보'로 두고 있는 것처럼 채우지 않는다. */
function facts(selection: MapFeatureSelection, district: DistrictReference | null, river: RiverReference | null, riverState: RiverSourceState | null): Fact[] {
  const properties = selection.properties;
  const rows: Fact[] = [{ label: '레이어', value: layerLabel(selection.layerId) }];
  if (selection.layerId === 'L1') {
    rows.push(...districtFactRows(district, properties));
  } else if (isRiverLayerId(selection.layerId)) {
    const source = riverSourceById(riverSourceIdOf(selection.layerId));
    // 자료의 성격을 먼저 말한다. 실폭·하천구역·중심선은 베이스맵과 맞는 모습이 서로 다르다.
    if (source) rows.push({ label: '자료성격', value: `${SEMANTIC_LABEL[source.semantic]} · ${SEMANTIC_ALIGNMENT_NOTE[source.semantic]}` });
    rows.push({ label: '공급경로', value: riverState ? DELIVERY_LABEL[riverState.delivery] : MISSING });
    rows.push({ label: '자료출처', value: orMissing(source?.sourceOrg) });
    // 소하천구역은 rivers.json 의 하천 제원과 연결되지 않는다(별개 자료다).
    // 계획서 제원 칸을 전부 '미확보'로 채우는 대신 그 자료가 실제로 가진 항목만 적는다.
    if (source?.semantic === 'sochun') {
      rows.push({ label: '소하천명', value: orMissing(properties.stream_name) });
      rows.push({ label: '고시일', value: orMissing(properties.notified_on) });
      rows.push({ label: '관리번호(MNUM)', value: orMissing(properties.MNUM) });
      rows.push({ label: '원문 표기', value: orMissing(properties.alias_raw ?? properties.remark_raw) });
      rows.push({ label: '행정구역', value: orMissing(properties.admin_name ?? properties.admin_code) });
      rows.push({ label: '좌표(위도, 경도)', value: `${selection.lonLat[1].toFixed(5)}, ${selection.lonLat[0].toFixed(5)}` });
      return rows;
    }
    // 국가기본도 실폭·경계에는 등급 속성이 없어 중심선에서 공간조인해 붙였다(river_class_source).
    // 계획문서의 하천등급(rivers.json grade)과 출처가 다르므로 붙여서 보여준다.
    rows.push({ label: '하천등급', value: orMissing(river?.grade ?? properties.river_class ?? properties.grade ?? properties.cat_nam) });
    if (properties.river_class_source) rows.push({ label: '등급 판정근거', value: String(properties.river_class_source) });
    // 시군구 파일 배정은 화면 표출용 행정경계 클리핑이다 — 하천 관리 관할(관리청·좌안/우안 구간)은
    // 고시·계획문서가 정하는 별개 축이라, 지역 표시를 관할로 읽는 오독을 여기서 막는다.
    rows.push({ label: '자료상태', value: '시군구 표시는 행정경계 기준 화면 표출이며 하천 관리 관할(관리청·좌안/우안)이 아닙니다' });
    rows.push({ label: '유역면적', value: river?.basin_area_km2 ? `${river.basin_area_km2} km²` : MISSING });
    rows.push({ label: '연장', value: river?.length_km ? `${river.length_km} km` : MISSING });
    rows.push({ label: '계획빈도', value: orMissing(river?.design_frequency_yr) });
    rows.push({ label: '시점', value: orMissing(river?.start_point) });
    rows.push({ label: '종점', value: orMissing(river?.end_point) });
    rows.push({ label: '계획명', value: orMissing(river?.plan_name ?? (properties.source as Record<string, unknown> | undefined)?.plan_name) });
  } else if (selection.layerId === 'L3') {
    rows.push({ label: '행정코드', value: orMissing(properties.admin_code) });
    rows.push({ label: '경계자료', value: orMissing(properties.source) });
  } else if (selection.layerId.startsWith('L-RISK-')) {
    rows.push({ label: '위험유형', value: orMissing(properties.risk_type) });
    rows.push({ label: '주소', value: orMissing(properties.address) });
    rows.push({ label: '연번', value: orMissing(properties.serial) });
    rows.push({ label: '자료상태', value: '점 위치 자료 · 출처·공개등급 확인 필요' });
  } else if (selection.layerId === 'L-FLOOD-TRACE' || selection.layerId === 'FLOOD_TRACE') {
    // 행안부 침수흔적도(실자료). 원자료 필드를 그대로 보여 준다 — 등급(1~6)의 뜻은 명세를 받기 전까지 값 그대로다.
    rows.push({ label: '재난명', value: orMissing(properties.disaster_name) });
    rows.push({ label: '침수 기간', value: properties.occurred_at ? `${properties.occurred_at}${properties.ended_at && properties.ended_at !== properties.occurred_at ? ` ~ ${properties.ended_at}` : ''}` : MISSING });
    rows.push({ label: '침수 원인', value: orMissing(properties.cause_detail) });
    rows.push({ label: '침수심', value: properties.flood_depth_m != null ? `${properties.flood_depth_m} m` : MISSING });
    rows.push({ label: '침수면적', value: properties.flood_area_m2 != null ? `${Number(properties.flood_area_m2).toLocaleString()} m²` : MISSING });
    rows.push({ label: '등급(원자료 FLDN_GRD)', value: orMissing(properties.flood_grade) });
    rows.push({ label: '자료상태', value: '실자료 · 행안부 침수흔적도' });
    rows.push({ label: '출처', value: orMissing(properties.source) });
    rows.push({ label: '수집시각', value: orMissing(properties.collected_at) });
  } else if (selection.layerId === 'L-STATION-WL' || selection.layerId === 'L-STATION-RF') {
    // 관측값이 아니라 관측소의 '제원'이다. 그 구분을 맨 위에 적는다.
    rows.push({ label: '자료성격', value: '관측소 제원(위치·소속)입니다. 이 화면의 수위·강우 값이 아닙니다.' });
    rows.push({ label: '관측소코드', value: orMissing(properties.station_code) });
    rows.push({ label: '관측소종류', value: orMissing(properties.station_type) });
    rows.push({ label: '운영상태', value: properties.operating === false ? '폐쇄' : '운영' });
    rows.push({ label: '관측방식', value: orMissing(properties.observation_kind) });
    rows.push({ label: '하천', value: orMissing(properties.river_name) });
    rows.push({ label: '수계', value: orMissing(properties.basin) });
    rows.push({ label: '유역면적', value: properties.basin_area_km2 ? `${properties.basin_area_km2} km²` : MISSING });
    rows.push({ label: '관리기관', value: orMissing(properties.manager) });
    rows.push({ label: '주소', value: orMissing(properties.address) });
    rows.push({ label: '관측개시', value: orMissing(properties.opened_at) });
    rows.push({ label: '자료출처', value: orMissing(properties.source) });
    rows.push({ label: '수집일', value: orMissing(properties.fetched_at) });
  } else {
    rows.push({ label: '위치', value: orMissing(properties.location ?? properties.admin_name) });
  }
  rows.push({ label: '행정구역', value: orMissing(district?.admin_name ?? river?.admin_name ?? properties.admin_name ?? properties.admin_code) });
  rows.push({ label: '좌표(위도, 경도)', value: `${selection.lonLat[1].toFixed(5)}, ${selection.lonLat[0].toFixed(5)}` });
  return rows;
}

/** 마우스 오버 텍스트 태그의 내용. 형상마다 '이름 + 무슨 자료인지'까지만 적고 나머지는 클릭 팝업이 맡는다 —
 *  커서를 따라다니는 태그에 표를 담으면 정작 가리키려던 지도를 가린다. */
function hoverTag(hover: MapFeatureHover): { title: string; kind: string; detail: string } | null {
  const properties = hover.properties;
  const source = isRiverLayerId(hover.layerId) ? riverSourceById(riverSourceIdOf(hover.layerId)) : undefined;
  if (source?.semantic === 'sochun') {
    return {
      // 이름이 원자료에서 읽히지 않은 구역이 있다. 그때는 이름을 지어내지 않고 자료명만 보인다.
      title: str(properties.stream_name) ?? '이름 미상 소하천구역',
      kind: '소하천구역',
      detail: [str(properties.notified_on) && `고시 ${String(properties.notified_on)}`, str(properties.alias_raw)].filter(Boolean).join(' · '),
    };
  }
  if (source) {
    const name = str(properties.RIVER_NM) ?? str(properties.river_name) ?? str(properties.name);
    return {
      title: name ?? source.label,
      kind: SEMANTIC_LABEL[source.semantic],
      detail: [str(properties.river_class), str(properties.admin_code)].filter(Boolean).join(' · '),
    };
  }
  const name = str(properties.name) ?? str(properties.district_name) ?? hover.id;
  if (!name) return null;
  return { title: name, kind: layerLabel(hover.layerId), detail: str(properties.location) ?? str(properties.admin_name) ?? '' };
}

/** POI 마커 1개(Figma `location_icon`, 38×48.857 프레임). 상시 라벨은 붙이지 않는다 —
 *  지역명은 호버 요약 카드가 맡는다. 상시 라벨은 좁은 지도에서 서로와 팝업을 침범한다.
 *
 *  치수는 CSS(`--map-poi-size`, 기본 20px · 선택 28px · tier B 28/36px)가 정한다. viewBox 비율이
 *  38:48.857 이므로 height:auto 가 25.7 / 36px 을 그대로 만든다.
 *  원본이 BOOLEAN_OPERATION 이라 지오메트리가 추출되지 않았다. 치수·색은 원본 값이고
 *  경로만 재구성한 것이므로, 운영 반영 시 디자이너가 export 한 SVG 로 교체한다. */
function PoiPin() {
  return (
    <svg className="map-poi-icon" viewBox="0 0 38 48.857" aria-hidden="true" focusable="false">
      <path d="M19 48.857C19 48.857 38 26.5 38 19A19 19 0 1 0 0 19C0 26.5 19 48.857 19 48.857Z" fill="rgb(45,86,247)" />
      <circle cx="19" cy="18.857" r="11" fill="#fff" />
    </svg>
  );
}

export function MapPanel({ adminCode, mapRegion, onRegionChange, focusTarget, highlightedFeatureId, initialVisible, compact = false, priorityAreas, onSelectFeature }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<VWorldMapHandle | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const referenceCache = useRef<Map<string, Promise<PlanReference>>>(new Map());
  const focusedRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [highlightNotice, setHighlightNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<{ state: MapConnectionState; message: string }>({ state: 'connecting', message: '지도 초기화 중' });
  const [baseMap, setBaseMap] = useState<BaseMapType>('base');
  const [selection, setSelection] = useState<MapFeatureSelection | null>(null);
  const [pois, setPois] = useState<MapPoiPlacement[]>([]);
  const [hoverPoiId, setHoverPoiId] = useState<string | null>(null);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  // 지도가 보고 있는 지역. 앱 지역(adminCode)과 별개로 움직인다 — 부산·인제·영천은 위험지구
  // 시드가 없어 앱 지역이 될 수 없지만 하천 공간자료는 있다. 앱 지역이 바뀌면 지도도 따라간다.
  const [region, setRegion] = useState(() => dataCodeOfApp(adminCode));
  // 지역 목록은 전국 시군구다(전처리가 만든 river_region_catalog.json). 받아 오기 전에도
  // 지도는 초기 지역으로 동작하므로, 목록이 없다고 화면을 막지 않는다.
  const [regions, setRegions] = useState<MapRegion[]>([]);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [hover, setHover] = useState<MapFeatureHover | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState<RiverSearchEntry[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  // 검색 결과로 이동할 때, 해당 지역 GeoJSON 이 아직 안 받아졌을 수 있다. 받아진 뒤 한 번 더 강조한다.
  const [pendingHighlight, setPendingHighlight] = useState<string | null>(null);
  const highlightSeqRef = useRef(0);
  const [detail, setDetail] = useState<{ district: DistrictReference | null; river: RiverReference | null }>({ district: null, river: null });
  const [riverStates, setRiverStates] = useState<RiverSourceState[]>([]);
  const [visible, setVisible] = useState<Record<string, boolean>>({
    L1: true, L3: true, 'L-FLOOD-TRACE': false, 'L-RISK-COLLAPSE': false, 'L-RISK-RESERVOIR': false, 'L-RISK-STORM': false,
    'L-STATION-WL': false, 'L-STATION-RF': false,
    ...Object.fromEntries(RIVER_LAYER_SOURCES.map((source) => [riverLayerId(source.id), source.defaultVisible])),
    ...initialVisible,
  });

  const closePopup = useCallback(() => {
    setSelection(null);
    mapRef.current?.setPopupAnchor(null);
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    let active = true;
    createVWorldMap(ref.current, adminCode, (state, message) => active && setStatus({ state, message }))
      .then((handle) => {
        if (!active) { handle.destroy(); return; }
        mapRef.current = handle;
        handle.onFeatureClick((hit) => {
          if (!active) return;
          setSelection(hit);
          setDetail({ district: null, river: null });
        });
        handle.onPoiChange((points) => { if (active) setPois(points); });
        handle.onRiverStateChange((states) => { if (active) setRiverStates(states); });
        handle.onFeatureHover((point) => { if (active) setHover(point); });
        setMapReady(true);
      })
      .catch((mapError: unknown) => setError(mapError instanceof Error ? mapError.message : '지도 초기화 실패'));
    return () => { active = false; mapRef.current?.destroy(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    let alive = true;
    loadMapRegions()
      .then((list) => { if (alive) { setRegions(list); setRegionError(null); } })
      .catch(() => { if (alive) setRegionError('지역 목록을 받지 못했습니다. 새로고침 후 다시 시도하세요.'); });
    return () => { alive = false; };
  }, []);

  // 상단에서 지역을 바꾸면 지도가 따라간다. 상단 값이 없을 때만 앱 지역을 따른다.
  useEffect(() => { setRegion(mapRegion ?? dataCodeOfApp(adminCode)); }, [mapRegion, adminCode]);
  /** 지도 안에서 지역을 바꿀 때는 이걸 쓴다. 지도 상태와 상단 선택기를 함께 옮긴다. */
  const changeRegion = useCallback((code: string) => { setRegion(code); onRegionChange?.(code); }, [onRegionChange]);
  // 하천 목록에서 고른 하천으로 이동. 좌표는 파생값(형상 bbox 중심)이라 화면에 값으로 쓰지 않는다.
  useEffect(() => {
    if (!focusTarget || !mapReady) return;
    mapRef.current?.focusLonLat(focusTarget.lonLat, focusTarget.zoom ?? 13);
  }, [focusTarget?.key, mapReady]);
  // 검색 결과로 지역을 옮기며 하천 조각에 맞출 때는 경계 fit 을 건너뛴다(skipBoundaryFitRef).
  // 둘 다 fit 하면 뒤에 끝나는 경계 fit 이 하천 fit 을 덮어 마포구 한강을 골랐는데 마포구 전체가 보인다.
  const skipBoundaryFitRef = useRef(false);
  useEffect(() => {
    const skip = skipBoundaryFitRef.current;
    skipBoundaryFitRef.current = false;
    // mapReady 전 호출은 mapRef 가 null 이라 조용히 유실된다 — deps 에 mapReady 를 넣어
    // 지도가 준비되면 반드시 한 번 다시 반영한다. 이게 빠지면 초기 진입 타이밍에 따라
    // 어댑터가 초기 코드(앱 코드 45190)로 하천을 찾다 '이 지역 자료 없음' 으로 남는다.
    mapRef.current?.setRegion(region, mapRegionIn(regions, region)?.center, !skip);
    closePopup(); setHoverPoiId(null); setHover(null);
  }, [region, regions, mapReady, closePopup]);
  useEffect(() => {
    if (!highlightedFeatureId) { setHighlightNotice(null); return; }
    if (!mapReady || !mapRef.current) return;
    // 지도 Action은 존재하는 GeoJSON ID만 실행: 없는 ID는 비차단 안내로 처리하고 흐름을 유지한다.
    if (mapRef.current.highlightFeature(highlightedFeatureId)) { setHighlightNotice(null); return; }
    setHighlightNotice(`'${highlightedFeatureId}' 위치는 현재 지도 공간자료에 없어 지도 이동을 건너뛰었습니다. 목록 정보는 계속 확인할 수 있습니다.`);
    // 형상 없는 지구(메타 표본 대산교 등)는 참조자료의 하천명으로 **실존하는 하천 형상**에 대신
    // 맞춘다 — 하천 검색 결과 클릭과 같은 경로(gotoSearchResult)를 그대로 태운다. 좌표를 만들어
    // 넣지 않으며, 측점(33+1920 등)→좌표 변환도 하지 않는다. 지구의 실좌표는 T3Q 실데이터가
    // 채울 값이라 여기서 창작하면 나중에 실자료와 구분할 수 없다.
    let alive = true;
    (async () => {
      try {
        const [reference, index] = await Promise.all([loadPlanReference(null), loadRiverSearchIndex()]);
        if (!alive) return;
        const row = reference.districts.find((item) => item.district_code === highlightedFeatureId);
        // '방동천(소하천)' 처럼 참조자료의 하천명엔 구분 꼬리가 붙는다 — 색인은 맨이름이므로 벗겨 맞춘다.
        const riverName = str(row?.river_name)?.replace(/\(.*?\)\s*$/, '').trim();
        if (!row || !riverName) return;
        const entry = index.find((item) => item.name === riverName && entryInRegion(item, row.admin_code) && item.nav);
        if (!entry) return; // 카탈로그 밖 하천(소하천 미등재 등)은 좌표가 없다 — 기존 안내 유지.
        gotoSearchResult(entry);
        const where = str(row.location);
        setHighlightNotice(`'${str(row.district_name) ?? highlightedFeatureId}' 지구의 형상·좌표는 표본 자료에 없어 하천 '${riverName}' 구간으로 대신 이동했습니다.${where ? ` 위치 설명: ${where} (측점 좌표는 표본에 제공되지 않음).` : ''}`);
      } catch { /* 참조자료를 못 받으면 기존 안내를 유지한다. */ }
    })();
    return () => { alive = false; };
  }, [highlightedFeatureId, mapReady]);

  // 위험지구·하천은 계획문서 판독 참고자료(districts/rivers)를 붙여 상세 요약까지 표시한다. 결측은 정상이며 조용히 1차 요약만 남긴다.
  useEffect(() => {
    if (!selection || (selection.layerId !== 'L1' && !isRiverLayerId(selection.layerId))) return;
    const code = str(selection.properties.admin_code) ?? adminCode;
    // 계획문서 판독 참고자료는 위험지구 시드가 있는 3개 지역에만 있다. 나머지 지역에서 요청하면
    // 매번 404 를 받고 캐시를 지우는 왕복만 생긴다 — 그 자료가 없는 것이 정상인 지역이다.
    if (!mapRegionIn(regions, code)?.hasPlanSeed) { setDetail({ district: null, river: null }); return; }
    let alive = true;
    let pending = referenceCache.current.get(code);
    if (!pending) { pending = loadPlanReference(code); referenceCache.current.set(code, pending); }
    pending
      .then((reference) => {
        if (!alive) return;
        // 국가기본도 하천 피처는 자체 id(TN_RIVER_BT:…)를 쓰므로 rivers.json 의 river_id 와
        // 직접 맞지 않는다. 전처리에서 붙여 둔 river_id 속성으로 연결한다.
        const riverId = str(selection.properties.river_id) ?? selection.id;
        setDetail({
          district: reference.districts.find((row) => row.district_code === selection.id) ?? null,
          river: reference.rivers.find((row) => row.river_id === riverId) ?? null,
        });
      })
      .catch(() => { referenceCache.current.delete(code); if (alive) setDetail({ district: null, river: null }); });
    return () => { alive = false; };
  }, [selection, adminCode]);

  // 검색 색인은 검색을 처음 열 때만 받는다(약 420 KB). 초기 지도 로드에 얹지 않는다.
  useEffect(() => {
    if (!searchOpen || searchIndex) return;
    let alive = true;
    loadRiverSearchIndex()
      .then((entries) => { if (alive) { setSearchIndex(entries); setSearchError(null); } })
      .catch(() => { if (alive) setSearchError('하천 검색 색인을 불러오지 못했습니다. 지도 조작은 계속 사용할 수 있습니다.'); });
    return () => { alive = false; };
  }, [searchOpen, searchIndex]);

  // 검색 결과의 형상은 해당 소스 파일을 받은 뒤에야 존재한다. 자료가 도착할 때마다 한 번씩 시도한다.
  useEffect(() => {
    if (!pendingHighlight || !mapReady) return;
    if (mapRef.current?.highlightFeature(pendingHighlight)) setPendingHighlight(null);
  }, [pendingHighlight, mapReady, riverStates]);

  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closePopup(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selection, closePopup]);

  // 팝업이 열린 뒤 한 번만 초점을 옮겨 Esc·닫기·읽기 순서를 보장한다.
  useEffect(() => {
    if (!selection) { focusedRef.current = null; return; }
    if (focusedRef.current === selection.id) return;
    focusedRef.current = selection.id;
    popupRef.current?.focus({ preventScroll: true });
  }, [selection]);

  function toggle(code: string) {
    const next = !visible[code];
    setVisible((current) => ({ ...current, [code]: next }));
    if (isRiverLayerId(code)) mapRef.current?.setRiverSourceVisible(riverSourceIdOf(code), next);
    else mapRef.current?.setLayerVisible(code, next);
    if (selection && !next && selection.layerId === code) closePopup();
  }
  /** 검색 결과 1건으로 이동한다. 지역·레이어를 먼저 맞추고, 좌표로 이동한 뒤 형상 강조를 예약한다. */
  function gotoSearchResult(entry: RiverSearchEntry, toAdmin?: string) {
    if (!entry.nav) return;
    // 다른 지역 결과를 골랐으면 그 지역으로 옮긴다 — 상단 선택기까지. 검색이 시군구로 거르므로 다른
    // 지역 것은 '전국에서 찾기' 를 눌러 **일부러** 고른 것이다. 강남구를 보다 동작구 반포천을 골랐으면
    // 동작구 자료를 띄우는 것이 맞다. 소하천은 속한 시군구(admin)로, 국가·지방하천은 지나는 시군구 중
    // 첫 번째(admins[0])로 간다 — 한강처럼 여러 곳을 지나면 어느 하나를 골라야 하고, 이미 고른
    // 시군구를 지나면 그대로 둔다.
    // toAdmin 은 결과 항목 아래 시군구 칩으로 고른 목적지다. 한강처럼 24곳을 지나는 하천은 어디로 갈지
    // 사용자가 골라야 한다 — 첫 번째로 자동 이동하면 보려던 구간이 아닐 수 있다.
    let target = region;
    if (toAdmin) target = toAdmin;
    else if (entry.scope === 'region' && entry.admin && entry.admin !== region) target = entry.admin;
    else if (entry.scope === 'nationwide' && !entryInRegion(entry, region) && entry.admins?.[0]) target = entry.admins[0];
    if (target !== region) {
      // 국가·지방하천이면 도착할 조각으로 맞출 것이므로 경계 fit 은 건너뛴다.
      if (entry.scope === 'nationwide' && entry.feature_id) skipBoundaryFitRef.current = true;
      changeRegion(target);
    }
    // 소하천은 그 소스를 켠다. 국가·지방하천은 전용 레이어가 없고 국가기본도 경계·실폭 조각으로 맞추므로
    // 둘 다 꺼져 있으면 경계를 켠다 — 검색이 경계를 기준으로 가는데 경계가 꺼져 있으면 갈 곳이 없다.
    const code = riverSourceById(entry.source_id) ? riverLayerId(entry.source_id) : '';
    if (code && !visible[code]) {
      setVisible((current) => ({ ...current, [code]: true }));
      mapRef.current?.setRiverSourceVisible(entry.source_id, true);
    }
    if (entry.scope === 'nationwide') {
      const boundary = riverLayerId('ngii-boundary');
      const realwidth = riverLayerId('ngii-realwidth');
      if (!visible[boundary] && !visible[realwidth]) {
        setVisible((current) => ({ ...current, [boundary]: true }));
        mapRef.current?.setRiverSourceVisible('ngii-boundary', true);
      }
    }
    // 국가·지방하천은 옮긴 시군구의 국가기본도 경계·실폭 조각으로 맞춘다. nav 는 전국 bbox 중심이라
    // 한강을 강남구에서 찾았는데 경기 광주 산속으로 간다. 조각은 파일이 도착해야 잡히므로
    // pendingHighlight 로 걸고, 그때까지는 좌표로 먼저 간다. 이미 실려 있으면 highlightFeature 가
    // 바로 맞추고 true 를 돌려준다 — 그러면 nav 로 안 간다.
    if (entry.scope === 'nationwide' && entry.feature_id) {
      const key = `RIVERCODE:${entry.feature_id}`;
      if (target === region && mapRef.current?.highlightFeature(key)) { setPendingHighlight(null); return; }
      // 같은 하천을 다른 시군구 칩으로 연달아 고르면 key 가 같아 상태가 안 바뀐다. 꼬리표로 바꿔 준다.
      highlightSeqRef.current += 1;
      setPendingHighlight(`${key}#${highlightSeqRef.current}`);
      // 지역을 옮기는 중이면 좌표로 먼저 가지 않는다 — 조각이 도착하면 그쪽으로 맞춘다. 좌표(하천 내부점)는
      // 다른 시군구일 수 있어 먼저 가 버리면 화면이 엉뚱한 데 갔다가 돌아온다.
      if (target === region) mapRef.current?.focusLonLat(entry.nav, 15);
      return;
    }
    // 형상은 아직 안 받아졌을 수 있으므로 좌표로 먼저 옮긴다. 강조는 자료가 도착하면 붙는다.
    mapRef.current?.focusLonLat(entry.nav, entry.nav_kind === 'actual' ? 16 : 15);
    setPendingHighlight(entry.feature_id || null);
  }

  function toggleBaseMap() {
    const next: BaseMapType = baseMap === 'base' ? 'satellite' : 'base';
    setBaseMap(next);
    mapRef.current?.setBaseMap(next);
  }
  /** POI 클릭은 지도 클릭과 같은 상세 팝업을 연다(`detailOpen = true`). 기본값은 닫힘이다 —
   *  항상 열어 두면 267px 폭 지도에서 팝업이 POI·레이어 칩·요약 카드와 공존할 수 없다. */
  function openPoi(poi: MapPoiPlacement) {
    setSelection({ id: poi.id, layerId: poi.layerId, geometryType: 'Point', coordinate: poi.coordinate, lonLat: poi.lonLat, properties: poi.properties });
    setDetail({ district: null, river: null });
    mapRef.current?.setPopupAnchor(poi.coordinate);
  }

  const district = detail.district;
  const river = detail.river;
  const title = selection ? (str(district?.district_name ?? river?.name ?? selection.properties.name) ?? selection.id ?? '선택 지점') : '';
  const badge = selection ? (str(district?.disaster_type ?? selection.properties.disaster_type ?? selection.properties.grade) ?? layerLabel(selection.layerId) ?? '참고정보') : '';
  const badges = selection ? list(selection.properties.display_badges) : [];
  const evidence = evidenceText(district?.evidence ?? river?.profile_evidence ?? (selection ? sourceEvidence(selection.properties) : null));
  const selectedRiverState = selection && isRiverLayerId(selection.layerId)
    ? riverStates.find((state) => state.id === riverSourceIdOf(selection.layerId)) ?? null
    : null;
  const contextItem: AgentContextItem | null = selection && (selection.layerId === 'L1' || isRiverLayerId(selection.layerId))
    ? { kind: selection.layerId === 'L1' ? 'district' : 'river', id: selection.id, label: title, detail: str(district?.disaster_type ?? selection.properties.disaster_type ?? river?.grade ?? selection.properties.grade) ?? undefined, admin_code: str(selection.properties.admin_code) ?? adminCode }
    : null;

  const hoverPoi = hoverPoiId ? pois.find((poi) => poi.id === hoverPoiId) ?? null : null;
  // 요약 카드의 지표는 딱 1개다. 우선 확인지역이면 순위·점수, 아니면 계획문서 판독 재해유형.
  const hoverMetric = useMemo(() => {
    if (!hoverPoi) return null;
    const area = priorityAreas?.find((item) => item.spatial_object_id === hoverPoi.id);
    // 메타 표본 지구는 순위·점수(우리 산정값)를 보이지 않는다 — 재해유형 등 표본 원자료로 대체.
    if (area && !isMetaDemoId(area.spatial_object_id)) return { label: '우선순위', value: `${area.rank}위 · ${area.score}점` };
    const type = str(hoverPoi.properties.disaster_type);
    if (type) return { label: '재해유형', value: type };
    return { label: '자료', value: '계획문서 판독 참고정보' };
  }, [hoverPoi, priorityAreas]);

  const activeLayerCount = core.filter((item) => visible[item.code]).length;
  const currentRegion = mapRegionIn(regions, region);
  const sidoList = useMemo(() => groupBySido(regions), [regions]);
  const currentSido = currentRegion?.sido ?? sidoList[0]?.[0] ?? '';
  const sggList = useMemo(
    () => sidoList.find(([sido]) => sido === currentSido)?.[1] ?? [],
    [sidoList, currentSido],
  );
  // 시군구로 거른 결과가 기본이다. 사용자가 '전국에서 찾기' 를 누르면 거르지 않는다.
  // 검색어나 지역이 바뀌면 다시 시군구로 좁힌다 — 전국 모드가 눌러붙어 있으면 다음 검색이 또 섞인다.
  const [searchNationwide, setSearchNationwide] = useState(false);
  useEffect(() => { setSearchNationwide(false); }, [query, region]);
  const search = useMemo(
    () => (searchIndex ? searchRivers(searchIndex, query, region, 40, searchNationwide) : { items: [], total: 0, elsewhere: 0 }),
    [searchIndex, query, region, searchNationwide],
  );
  const results = search.items;
  const tag = hover ? hoverTag(hover) : null;

  return (
    <section className={`map-panel ${compact ? 'compact' : ''}`} aria-labelledby="map-title" aria-describedby="map-accessible-summary">
      <h2 id="map-title" className="sr-only">VWorld 지도와 공간정보</h2>
      <p id="map-accessible-summary" className="sr-only">지도와 같은 우선 확인지역 정보는 오른쪽 현재 판단 목록에서도 확인할 수 있고, 목록 카드의 지역명 버튼으로 해당 지점으로 이동하며 상세보기 버튼으로 같은 상세 정보를 창으로 열 수 있습니다. 지도 위 위험지구 표시를 클릭해도 같은 정보 창이 열립니다.</p>
      <div ref={ref} className="map-canvas" aria-hidden="true" />

      {/* 중단 띠 · 위험지구 POI 핀. 팝업 띠(상단 우측) 아래에 놓인다. */}
      {visible.L1 ? pois.map((poi) => {
        const name = str(poi.properties.name) ?? poi.id;
        const active = poi.id === highlightedFeatureId || poi.id === selection?.id;
        return (
          <button
            key={poi.id}
            type="button"
            className={`map-poi ${active ? 'selected' : ''}`}
            style={{ left: poi.x, top: poi.y }}
            aria-label={`${name} 위험지구 상세 보기`}
            aria-describedby={hoverPoiId === poi.id ? 'map-poi-summary' : undefined}
            onMouseEnter={() => setHoverPoiId(poi.id)}
            onMouseLeave={() => setHoverPoiId((current) => (current === poi.id ? null : current))}
            onFocus={() => setHoverPoiId(poi.id)}
            onBlur={() => setHoverPoiId((current) => (current === poi.id ? null : current))}
            onClick={() => openPoi(poi)}
          >
            <PoiPin />
          </button>
        );
      }) : null}

      {/* 커서를 따라다니는 텍스트 태그. 지도 캔버스는 aria-hidden 이라 이 태그도 보조기술에 노출하지
          않는다 — 같은 내용을 검색 목록과 클릭 팝업이 접근 가능한 경로로 이미 제공한다. */}
      {tag ? (
        <div className="map-hover-tag" style={{ left: hover?.x, top: hover?.y }} aria-hidden="true">
          <span className="map-hover-tag-title">{tag.title}</span>
          <span className="map-hover-tag-kind">{tag.kind}</span>
          {tag.detail ? <span className="map-hover-tag-detail">{tag.detail}</span> : null}
        </div>
      ) : null}

      {/* 상단 좌측 띠 · 연결상태 필(고정 폭, 말줄임 금지) */}
      <div className={`map-connection ${status.state}`} role="status"><span className="status-dot" aria-hidden="true" />{status.message}</div>
      {error ? <div className="map-error" role="alert">{error}</div> : null}
      {highlightNotice ? <div className="map-highlight-notice" role="status" aria-live="polite">{highlightNotice}</div> : null}

      {/* 상단 우측 띠 · 베이스맵 전환.
          버튼은 1개다. 일반/영상 2개 버튼을 두면 연결상태 필과 한 띠에 들어가지 않아
          부족분이 전부 필 문구에서 빠지고 자료성격 표기가 사라진다.
          단, 인계문서 D-4-2(585행)가 베이스맵의 `aria-pressed` 를 검증 대상으로 기록하므로
          '액션 버튼'이 아니라 '토글 버튼'으로 둔다 — 라벨은 대상(영상지도)을 고정으로 가리키고
          현재 상태는 aria-pressed 가 전달한다. 라벨이 상태에 따라 바뀌면 aria-pressed 와
          이중으로 상태를 말해 서로 모순된다. */}
      <div className="map-basemap-switch">
        <button type="button" aria-pressed={baseMap === 'satellite'} onClick={toggleBaseMap}>영상지도</button>
      </div>

      {/* 좌하단 · 하천 검색과 지도 지역 이동.
          지역 선택기를 여기에 두는 이유는 대상지역 6곳 중 3곳(부산·인제·영천)이 앱 지역이 될 수
          없기 때문이다 — 위험지구·우선 확인지역 시드가 없어 대시보드 목록이 통째로 비게 된다.
          지도 안에서만 이동시키면 하천 자료는 보면서 나머지 화면은 그대로 유지된다. */}
      {searchOpen ? (
        <div className="map-search-panel" id="map-search-panel">
          <div className="map-search-region">
            <label htmlFor="map-sido-select">시도</label>
            <select
              id="map-sido-select"
              value={currentSido}
              disabled={!regions.length}
              onChange={(event) => {
                // 시도를 바꾸면 그 시도의 첫 시군구로 옮긴다. 빈 상태로 두면 지도가 어디를 보는지 알 수 없다.
                const first = sidoList.find(([sido]) => sido === event.target.value)?.[1]?.[0];
                if (first) changeRegion(first.admin);
              }}
            >
              {sidoList.map(([sido]) => <option key={sido} value={sido}>{sido}</option>)}
            </select>
            <label htmlFor="map-region-select">시군구</label>
            <select
              id="map-region-select"
              value={region}
              disabled={!regions.length}
              onChange={(event) => changeRegion(event.target.value)}
            >
              {sggList.map((item) => (
                <option key={item.admin} value={item.admin}>{item.sgg}{item.hasPlanSeed ? '' : ' (하천자료만)'}</option>
              ))}
            </select>
          </div>
          {regionError ? <p className="map-search-note" role="status">{regionError}</p> : null}
          {currentRegion && !currentRegion.hasPlanSeed ? (
            <p className="map-search-note" role="status">이 지역은 하천 공간자료만 있습니다. 위험지구·우선 확인지역은 {mapRegionIn(regions, dataCodeOfApp(adminCode))?.name ?? '앱에서 선택한 지역'} 기준으로 유지됩니다.</p>
          ) : null}
          <div className="map-search-field">
            <label htmlFor="map-river-search">하천명 검색</label>
            <div className="map-search-input-row">
              <input
                id="map-river-search"
                type="search"
                value={query}
                placeholder="예: 요천, 안양천, 신기천"
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape' && query) { event.preventDefault(); setQuery(''); } }}
              />
              {/* 한 번 찾은 뒤 다른 하천을 찾으려면 검색어를 지우고 전국 모드도 풀어야 한다. 둘을 한 번에 되돌린다.
                  type=search 의 기본 ✕ 는 브라우저마다 있고 없고 해서 따로 둔다. */}
              {query ? (
                <button
                  type="button"
                  className="map-search-clear"
                  aria-label="검색어 지우기"
                  title="검색어 지우기 (Esc)"
                  onClick={() => { setQuery(''); setSearchNationwide(false); document.getElementById('map-river-search')?.focus(); }}
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
          {searchError ? <p className="map-search-note" role="alert">{searchError}</p> : null}
          {!searchIndex && !searchError ? <p className="map-search-note" role="status">검색 색인 받는 중</p> : null}
          {searchIndex && query.trim() ? (
            <>
              <p className="map-search-count" role="status" aria-live="polite">
                {search.total
                  ? `${searchNationwide ? '전국 ' : `${currentRegion?.short ?? '이 지역'} `}${search.total.toLocaleString('ko-KR')}건${search.total > results.length ? ` (상위 ${results.length}건 표시)` : ''}`
                  : searchNationwide ? '일치하는 하천이 없습니다.' : `${currentRegion?.short ?? '이 지역'}에 일치하는 하천이 없습니다.`}
                {/* 같은 이름이 다른 시군구에 있으면 그 사실을 말하고 전국으로 넘어갈 길을 둔다. 조용히 숨기면 '없다'로 읽힌다. */}
                {!searchNationwide && search.elsewhere > 0 ? (
                  <> · 다른 지역에 {search.elsewhere.toLocaleString('ko-KR')}건 <button type="button" className="map-search-link" onClick={() => setSearchNationwide(true)}>전국에서 찾기</button></>
                ) : null}
              </p>
              <ul className="map-search-results">
                {results.map((entry) => {
                  const other = !entryInRegion(entry, region);
                  // 국가·지방하천은 여러 시군구를 지난다. 어느 것인지 알 수 있게 지나는 시군구를 적는다.
                  const passes = entry.scope === 'nationwide' && entry.admins?.length
                    ? entry.admins.map((code) => mapRegionIn(regions, code)?.short ?? code)
                    : [];
                  // 지나는 시군구가 둘 이상이면 항목 아래에 시군구 칩을 다 펼친다. 칩을 누르면 그 시군구로
                  // 간다. 항목 본체를 누르면 현재 지역을 지나는 경우 현재 지역, 아니면 조각이 가장 많은 곳이다.
                  const passList = entry.scope === 'nationwide' && (entry.admins?.length ?? 0) > 1 ? entry.admins ?? [] : [];
                  const passesText = passList.length ? '' : passes.join('·');
                  return (
                    <li key={`${entry.source_id}:${entry.admin}:${entry.feature_id || entry.name}:${entry.kind}`}>
                      <button
                        type="button"
                        disabled={!entry.nav}
                        // 좌표가 없는 건은 '왜 못 가는지'를 말한다. 조용히 비활성화하면 고장으로 읽힌다.
                        title={entry.nav ? undefined : entry.no_coordinate_reason ?? '지도로 이동할 좌표가 없습니다.'}
                        onClick={() => gotoSearchResult(entry)}
                      >
                        <span className="map-search-name">{entry.name}</span>
                        <span className="map-search-meta">
                          {entry.kind}
                          {entry.scope === 'region' && other ? ` · ${mapRegionIn(regions, entry.admin)?.short ?? entry.admin}` : ''}
                          {passesText ? ` · ${passesText}` : ''}
                          {passList.length ? ` · ${passList.length}개 시군구 통과` : ''}
                          {entry.nav ? '' : ' · 좌표 없음'}
                        </span>
                        {entry.detail ? <span className="map-search-detail">{entry.detail}</span> : null}
                      </button>
                      {passList.length ? (
                        <ul className="map-search-passes" aria-label={`${entry.name}이 지나는 시군구`}>
                          {passList.map((code) => {
                            const here = code === region;
                            return (
                              <li key={code}>
                                <button
                                  type="button"
                                  className={`map-search-pass${here ? ' here' : ''}`}
                                  aria-current={here ? 'true' : undefined}
                                  title={here ? '지금 보는 시군구' : `${mapRegionIn(regions, code)?.name ?? code}로 이동`}
                                  onClick={() => gotoSearchResult(entry, code)}
                                >
                                  {mapRegionIn(regions, code)?.short ?? code}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {/* 상단 우측 띠(클릭 시) · 상세 팝업. 오버레이가 없는 우측에 두어 연결상태·레이어 칩을 덮지 않는다. */}
      {selection ? (
        <div
          ref={popupRef}
          className={`map-feature-popup ${selection.layerId === 'L1' ? 'district' : ''}`}
          role="dialog"
          aria-labelledby="map-popup-title"
          tabIndex={-1}
        >
          <header className="map-popup-head">
            <div className="map-popup-headings">
              <h3 id="map-popup-title">{title}</h3>
              <p className="map-popup-badges">
                <span className="map-popup-badge">{badge}</span>
                {badges.map((item) => <span key={item} className="map-popup-flag">{item}</span>)}
              </p>
            </div>
            <button type="button" className="map-popup-close" aria-label="지도 정보 창 닫기" onClick={closePopup}>✕</button>
          </header>
          <div className="map-popup-body">
            <FactList rows={facts(selection, district, river, selectedRiverState)} />
            {district ? <DistrictDetailSections district={district} /> : null}
            {river?.warning_reference_station ? (
              <section className="map-popup-section">
                <h4>계획서 기준지점</h4>
                <p>{[str(river.warning_reference_station.name), str(river.warning_reference_station.station_no), str(river.warning_reference_station.note)].filter(Boolean).join(' · ') || MISSING}</p>
              </section>
            ) : null}
            {str(selection.properties.source_note) ? <p className="map-popup-source">비고 · {String(selection.properties.source_note)}</p> : null}
            {/* 관측소는 계획문서 판독물도 Mock/Seed 도 아니다. '근거' 절과 면책문구를 자료성격에 맞춘다. */}
            {isStationLayer(selection.layerId) ? null : (
              <section className="map-popup-section">
                <h4>근거</h4>
                <p className="map-popup-source">{evidence ?? MISSING}</p>
              </section>
            )}
            {/* 3줄짜리 면책문구는 스크롤 본문 끝에 둔다. 푸터에 두면 고정 높이를 먹어 본문이 무너진다. */}
            <p className="map-popup-disclaimer">
              {isStationLayer(selection.layerId)
                ? '관측소 위치·소속 정보이며 관측값이 아닙니다. 수위·강우 실측값은 별도 Provider 연계를 거쳐야 표시됩니다.'
                : '본 요약은 관리대장·계획문서 판독 및 Mock/Seed 기반 참고 정보이며, 공식 위험등급 판정이나 피해예측이 아닙니다.'}
            </p>
          </div>
          {contextItem && onSelectFeature ? (
            <footer className="map-popup-foot">
              <button type="button" className="map-popup-action" onClick={() => onSelectFeature(contextItem)}>질의에 참조 추가</button>
            </footer>
          ) : null}
        </div>
      ) : null}

      {/* 좌하단 띠 · POI 호버 요약 카드. 핀을 따라다니지 않고 지도 좌하단 고정 지점에 뜬다 —
          핀에 붙이면 좁은 지도에서 카드가 지도 밖으로 잘린다. */}
      {hoverPoi && hoverMetric ? (
        <div className="map-poi-summary" id="map-poi-summary" role="tooltip">
          <div className="map-poi-summary-body">
            <span className="map-poi-summary-name">{str(hoverPoi.properties.name) ?? hoverPoi.id}</span>
            <span className="map-poi-summary-address">{str(hoverPoi.properties.location) ?? str(hoverPoi.properties.admin_name) ?? MISSING}</span>
          </div>
          <div className="map-poi-summary-metric">
            <span>{hoverMetric.label}</span>
            <strong>{hoverMetric.value}</strong>
          </div>
        </div>
      ) : null}

      {/* 하단 띠 · 레이어 칩 행(하나의 flex 행). 칩 영역만 클리핑하고 개수 버튼은 그 밖에 둔다 —
          숨겨진 칩을 대변하는 컨트롤이 자기도 숨으면 사용자는 단서가 없다. */}
      <div className="map-layer-bar">
        <div className="map-layer-chips" role="group" aria-label="지도 레이어 표시 설정">
          {core.map((item) => <button key={item.code} type="button" className={`chip ${visible[item.code] ? 'active' : ''}`} aria-pressed={visible[item.code]} onClick={() => toggle(item.code)}>{item.name}</button>)}
          {PENDING_LAYERS.map((name) => <button key={name} type="button" className="chip" disabled title="후속 Provider 연결 대상">{name}</button>)}
        </div>
        {/* 검색 진입점은 칩 클리핑 밖에 둔다. 칩 행 안에 넣으면 지역·레이어에 따라 잘려 사라진다. */}
        <button type="button" className="map-layer-count" aria-expanded={searchOpen} aria-controls="map-search-panel" onClick={() => setSearchOpen((open) => !open)}>
          하천 검색
        </button>
        <button type="button" className="map-layer-count" aria-expanded={layerMenuOpen} aria-controls="map-layer-menu" onClick={() => setLayerMenuOpen((open) => !open)}>
          레이어 {activeLayerCount}
        </button>
      </div>
      {layerMenuOpen ? (
        <div className="map-layer-menu" id="map-layer-menu">
          <p className="map-layer-menu-title">지도 레이어 {activeLayerCount}/{core.length} 표시 중</p>
          <ul>
            {core.map((item) => (
              <li key={item.code}>
                <button type="button" aria-pressed={visible[item.code]} onClick={() => toggle(item.code)}>
                  <span>{item.name}</span><span className="map-layer-menu-state">{visible[item.code] ? '표시' : '숨김'}</span>
                </button>
              </li>
            ))}
            {PENDING_LAYERS.map((name) => (
              <li key={name}><button type="button" disabled><span>{name}</span><span className="map-layer-menu-state">후속 Provider 연결 대상</span></button></li>
            ))}
          </ul>
          {/* 하천은 의미가 다른 소스를 겹쳐 봐야 정합을 판단할 수 있어 별도 묶음으로 둔다.
              칩 행에는 대표 소스 1개만 나가고, 비교·검증용 소스는 여기서 켠다. */}
          <p className="map-layer-menu-title map-layer-menu-group">하천 소스 · 겹쳐서 정합 비교</p>
          <ul>
            {RIVER_LAYER_SOURCES.map((source) => {
              const code = riverLayerId(source.id);
              const state = riverStates.find((item) => item.id === source.id);
              const blocked = source.status === 'unverified' || state?.delivery === 'unavailable';
              return (
                <li key={source.id}>
                  <button
                    type="button"
                    aria-pressed={blocked ? undefined : visible[code]}
                    disabled={blocked}
                    title={blocked ? source.note : `${SEMANTIC_LABEL[source.semantic]} · ${SEMANTIC_ALIGNMENT_NOTE[source.semantic]}`}
                    onClick={() => toggle(code)}
                  >
                    <span>{source.label}</span>
                    <span className="map-layer-menu-state">
                      {blocked
                        ? (source.status === 'unverified' ? '소스 미확정' : state?.message || '표시 불가')
                        /* 공급경로만 적으면 '받는 중'·'국가기본도 N건' 같은 실제 상태가 묻힌다. */
                        : `${visible[code] ? '표시' : '숨김'}${state ? ` · ${state.message || DELIVERY_SHORT[state.delivery]}` : ''}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
