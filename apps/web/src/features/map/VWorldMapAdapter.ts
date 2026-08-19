import OlMap from 'ol/Map';
import View from 'ol/View';
import GeoJSON from 'ol/format/GeoJSON';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import type { FeatureLike } from 'ol/Feature';
import type Layer from 'ol/layer/Layer';
import type BaseLayer from 'ol/layer/Base';
import { lineStyle, palette, pointStyle } from './mapStyles';
import { DEFAULT_MAP_REGION, dataCodeOfApp } from './mapRegions';
import { createRiverLayers, type RiverLayerRegistry, type RiverSourceState } from './riverLayers';
import { isRiverLayerId, riverLayerId } from './riverLayerSources';

const DEFAULT_CENTER: [number, number] = [127.39, 35.416];
// 전국 시군구 중심좌표는 river_region_catalog.json 에 있고 MapPanel 이 들고 있다. 어댑터는
// 지도를 만들 때 쓸 초기 좌표만 알면 되므로, 시드가 있는 3곳만 여기 둔다(그 외는 호출자가 준다).
const SEED_CENTERS: Record<string, [number, number]> = {
  '41430': [126.968, 37.344],
  '47190': [128.344, 36.119],
  '52190': [127.390, 35.416],
};
export type MapConnectionState = 'seed-only' | 'connecting' | 'connected' | 'error';
export type BaseMapType = 'base' | 'satellite';
/** 지도에서 클릭한 POI 1건. 팝업 렌더는 React가 담당하므로 화면표현 없이 원본 속성만 전달한다. */
export interface MapFeatureSelection {
  id: string;
  layerId: string;
  geometryType: string;
  coordinate: number[];
  lonLat: [number, number];
  properties: Record<string, unknown>;
}
/** 베이스맵 위에 HTML 마커(`.map-poi`)로 그릴 위험지구 POI 1건과 그 화면 픽셀 위치.
 *  캔버스 벡터가 아니라 DOM 요소로 그려야 호버·포커스·클릭을 브라우저 기본 동작으로 처리할 수 있다. */
export interface MapPoiPlacement {
  id: string;
  layerId: string;
  /** 지도 좌상단 기준 픽셀. 핀의 '끝'이 이 좌표에 오도록 배치한다. */
  x: number;
  y: number;
  coordinate: number[];
  lonLat: [number, number];
  properties: Record<string, unknown>;
}
/** 커서가 올라간 피처 1건과 그 화면 픽셀 위치. 텍스트 태그를 커서 옆에 띄우는 데 쓴다. */
export interface MapFeatureHover {
  id: string;
  layerId: string;
  /** 지도 좌상단 기준 픽셀. */
  x: number;
  y: number;
  properties: Record<string, unknown>;
}

export interface VWorldMapHandle {
  map: OlMap;
  setRegion(code: string, center?: [number, number]): void;
  highlightFeature(id: string): boolean;
  /** 검색 결과로 이동한다. 형상이 아직 안 받아진 소스도 있으므로 좌표만으로 먼저 이동시킨다. */
  focusLonLat(lonLat: [number, number], zoom?: number): void;
  setLayerVisible(layerCode: string, visible: boolean): void;
  /** 하천 소스(실폭·중심선·비교용 Seed 등) 개별 표시 토글. */
  setRiverSourceVisible(sourceId: string, visible: boolean): void;
  /** 하천 소스가 실제로 무엇으로 공급되고 있는지(WMS/로컬 Seed/불가) 구독한다. */
  onRiverStateChange(handler: (states: RiverSourceState[]) => void): () => void;
  setBaseMap(type: BaseMapType): void;
  /** 피처 클릭 구독. 빈 지도를 클릭하면 null을 전달한다. 해제 함수를 반환한다. */
  onFeatureClick(handler: (selection: MapFeatureSelection | null) => void): () => void;
  /** 커서 아래 피처 구독(마우스 오버 텍스트 태그용). 피처가 없으면 null을 전달한다.
   *  캔버스 벡터는 DOM 요소가 아니라 마우스 이벤트를 직접 받지 못하므로 어댑터가 대신 알려준다. */
  onFeatureHover(handler: (hover: MapFeatureHover | null) => void): () => void;
  /** 팝업 기준좌표 지정(null이면 클릭 강조 해제). */
  setPopupAnchor(coordinate: number[] | null): void;
  /** 위험지구 POI 마커의 화면 위치 변화를 구독한다(이동·확대·레이어 토글). 해제 함수를 반환한다. */
  onPoiChange(handler: (points: MapPoiPlacement[]) => void): () => void;
  destroy(): void;
}

interface StyleContext { selected: string | null; clicked: string | null; satellite: boolean }

function featureKey(feature: FeatureLike) {
  return String(feature.getId() ?? feature.get('id') ?? feature.get('district_code') ?? feature.get('trace_id') ?? feature.get('feature_id') ?? '');
}

function styleFor(feature: FeatureLike, context: StyleContext) {
  const layer = String(feature.get('layer') ?? '');
  // 위험지구(L1)는 캔버스 원이 아니라 HTML POI 마커로 그린다. 둘 다 그리면 같은 지점에
  // 원과 핀이 겹쳐 두 개의 대상처럼 읽힌다. 클릭·호버도 마커가 직접 받는다.
  if (layer === 'L1') return [];
  const id = featureKey(feature);
  const active = Boolean(id) && (id === context.selected || id === context.clicked);
  const provisional = Boolean(feature.get('provisional'));
  const sat = context.satellite;
  const { casing, activeCasing, activeLine } = palette(sat);
  // 관측소는 url 소스로 늦게 실려 'layer' 속성을 미리 심을 수 없다. 속성으로 판별한다.
  // 전국 2천여 점이 깔리므로 다른 POI 보다 작게 그려 위험지구 핀을 가리지 않게 한다.
  const stationCode = feature.get('station_code');
  if (stationCode) {
    const rain = String(feature.get('station_type') ?? '').includes('강수');
    // 폐쇄된 관측소는 지우지 않고 흐리게 남긴다 — 과거 사례를 볼 때 필요하다.
    const idle = feature.get('operating') === false;
    const tone = rain ? (sat ? '#b0bec5' : '#607d8b') : (sat ? '#40c4ff' : '#0277bd');
    return pointStyle(active ? 8 : 4, active ? activeLine : idle ? (sat ? '#78909c' : '#9e9e9e') : tone, active ? activeCasing : casing, '#ffffff');
  }
  if (layer === 'L-DANGEROUS-RESERVOIR') {
    return pointStyle(active ? 10 : 7, active ? activeLine : sat ? '#00e676' : '#00897b', active ? activeCasing : casing, '#ffffff');
  }
  if (layer === 'L1' || feature.getGeometry()?.getType() === 'Point') {
    return pointStyle(active ? 10 : 6, active ? activeLine : sat ? '#ffea00' : 'rgba(220,76,70,.9)', active ? activeCasing : casing, '#ffffff');
  }
  if (layer === 'FLOOD_TRACE' || layer === 'L-FLOOD-RISK-AREA') {
    return lineStyle(active ? activeLine : sat ? '#ff9e2c' : '#1e88e5', active ? activeCasing : casing, active ? 4 : 2.4, active ? (sat ? 'rgba(255,45,149,.28)' : 'rgba(255,152,0,.25)') : sat ? 'rgba(255,158,44,.26)' : 'rgba(30,136,229,.22)', [8, 4]);
  }
  if (layer === 'L-STORM-FLOOD-IMPROVEMENT') {
    return lineStyle(active ? activeLine : sat ? '#d18cff' : '#7b1fa2', active ? activeCasing : casing, active ? 4 : 2.4, active ? (sat ? 'rgba(255,45,149,.22)' : 'rgba(255,152,0,.18)') : sat ? 'rgba(209,140,255,.2)' : 'rgba(123,31,162,.12)', [5, 4]);
  }
  // 하천(L2)은 여기서 그리지 않는다. 소스별로 나뉘어 riverLayers 가 전담한다.
  const base = sat ? '#ffffff' : provisional ? '#9b6b32' : '#1769aa';
  return lineStyle(active ? activeLine : base, active ? activeCasing : casing, active ? 4 : 2.2, active ? (sat ? 'rgba(255,45,149,.2)' : 'rgba(255,152,0,.18)') : sat ? 'rgba(255,255,255,.1)' : 'rgba(23,105,170,.07)');
}

// 배경(행정경계 등) 위에 겹친 POI를 먼저 잡도록 레이어 우선순위를 둔다.
const HIT_PRIORITY: Record<string, number> = { L1: 0, 'L-DANGEROUS-RESERVOIR': 0, 'L-STATION-WL': 0, 'L-STATION-RF': 0, FLOOD_TRACE: 1, 'L-FLOOD-TRACE': 1, 'L-FLOOD-RISK-AREA': 1, 'L-STORM-FLOOD-IMPROVEMENT': 1, L2: 2, L3: 3 };
// 하천 소스는 여러 개가 겹쳐 있어도 기존 L2와 같은 순위로 다룬다(위험지구·침수흔적보다 뒤, 행정경계보다 앞).
const hitRank = (layerId: string) => (isRiverLayerId(layerId) ? 2 : HIT_PRIORITY[layerId] ?? 2);

function vworldTile(key: string, type: BaseMapType, onState?: (state: MapConnectionState, message: string) => void) {
  const extension = type === 'satellite' ? 'jpeg' : 'png';
  const layerName = type === 'satellite' ? 'Satellite' : 'Base';
  const source = new XYZ({ url: `https://api.vworld.kr/req/wmts/1.0.0/${key}/${layerName}/{z}/{y}/{x}.${extension}`, crossOrigin: 'anonymous' });
  let loaded = false;
  source.on('tileloadend', () => {
    if (!loaded) {
      loaded = true;
      onState?.('connected', `VWorld ${type === 'satellite' ? '영상' : '일반'}지도 연결 정상`);
    }
  });
  source.on('tileloaderror', () => onState?.('error', `VWorld ${type === 'satellite' ? '영상' : '일반'}지도 로딩 실패: 키·등록도메인을 확인하세요.`));
  return source;
}

export async function createVWorldMap(target: HTMLElement, adminCode: string, onState?: (state: MapConnectionState, message: string) => void): Promise<VWorldMapHandle> {
  const key = import.meta.env.VITE_VWORLD_MAP_KEY?.trim();
  const mapLayers: BaseLayer[] = [];
  let baseLayer: TileLayer<XYZ> | undefined;
  let satelliteLayer: TileLayer<XYZ> | undefined;
  if (key) {
    onState?.('connecting', 'VWorld 배경지도 연결 중');
    baseLayer = new TileLayer({ properties: { layerId: 'L-BASE-VWORLD' }, source: vworldTile(key, 'base', onState), visible: true });
    satelliteLayer = new TileLayer({ properties: { layerId: 'L-SATELLITE-VWORLD' }, source: vworldTile(key, 'satellite', onState), visible: false });
    mapLayers.push(baseLayer, satelliteLayer);
  } else {
    onState?.('seed-only', 'VWorld 키 미설정: 공간 Seed만 표시');
  }

  const [geoResponse, floodResponse, floodRiskResponse, reservoirResponse, improvementResponse] = await Promise.all([fetch('/seed/geo.json'), fetch('/seed/flood_traces_seed.geojson'), fetch('/seed/mock_flood_risk_areas.geojson'), fetch('/seed/mock_dangerous_reservoirs.geojson'), fetch('/seed/mock_storm_flood_improvement_districts.geojson')]);
  if (!geoResponse.ok) throw new Error(`GeoJSON 로드 실패: ${geoResponse.status}`);
  const raw = new GeoJSON().readFeatures(await geoResponse.json(), { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
  raw.forEach((feature) => {
    const id = feature.get('id') ?? feature.get('district_code') ?? feature.get('feature_id');
    if (id) feature.setId(String(id));
  });

  const sources = new Map<string, VectorSource>();
  const vectors = new Map<string, VectorLayer<VectorSource>>();
  let selected: string | null = null;
  let clicked: string | null = null;
  let baseMapType: BaseMapType = 'base';
  const styleContext = (): StyleContext => ({ selected, clicked, satellite: baseMapType === 'satellite' });
  // 하천(L2)은 이 루프에서 빠진다. 소스가 여러 개고 WMS/벡터가 섞이므로 riverLayers 가 전담한다.
  for (const code of ['L1', 'L3']) {
    const source = new VectorSource({ features: raw.filter((feature) => String(feature.get('layer')) === code) });
    const layer = new VectorLayer({ properties: { layerId: code }, source, style: (feature) => styleFor(feature, styleContext()) });
    sources.set(code, source);
    vectors.set(code, layer);
    mapLayers.push(layer);
  }
  const rivers: RiverLayerRegistry = createRiverLayers({ features: raw, styleContext, key, adminCode });
  mapLayers.push(...rivers.layers);

  // 시군구 경계는 시드에 3곳(의왕·구미·남원)만 있다. 그 밖의 시군구는 전국 파일(SGG_{코드})에서
  // 받아 L3 소스에 넣고, 화면을 그 경계에 맞춘다 — 줌 11 고정으로 두면 종로구는 점 몇 개로,
  // 홍천군은 화면 밖으로 나간다. 시드 3곳은 시드 경계를 그대로 쓴다(그 경계에 위험지구가 걸려 있다).
  // 시드 경계의 admin_code 는 앱 코드(남원 45190)인데 지도는 자료 코드(52190)로 지역을 부른다.
  // 자료 코드로 맞춰 두어야 남원을 골랐을 때 시드 경계를 두고 파일을 또 받지 않는다.
  const seedBoundaryCodes = new Set(raw.filter((feature) => String(feature.get('layer')) === 'L3').map((feature) => dataCodeOfApp(String(feature.get('admin_code') ?? ''))));
  const loadedBoundaries = new Set<string>(seedBoundaryCodes);
  let boundaryRequest = 0;
  async function showAdminBoundary(code: string): Promise<boolean> {
    const source = sources.get('L3');
    if (!source) return false;
    const request = ++boundaryRequest;
    if (!loadedBoundaries.has(code)) {
      try {
        const response = await fetch(`/reference/admin/SGG_${code}.geojson`);
        if (!response.ok) return false;
        const features = new GeoJSON().readFeatures(await response.json(), { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
        features.forEach((feature) => { const id = feature.get('id'); if (id) feature.setId(String(id)); });
        // 늦게 도착한 응답이 이미 다른 지역으로 넘어간 화면을 덮지 않게 한다.
        if (request !== boundaryRequest) return true;
        source.addFeatures(features);
        loadedBoundaries.add(code);
      } catch { return false; }
    }
    const own = source.getFeatures().filter((feature) => dataCodeOfApp(String(feature.get('admin_code') ?? '')) === code);
    if (!own.length) return false;
    type Box = [number, number, number, number];
    const extent = own.reduce<Box | null>((acc, feature) => {
      const box = feature.getGeometry()?.getExtent() as Box | undefined;
      if (!box) return acc;
      if (!acc) return [box[0], box[1], box[2], box[3]];
      return [Math.min(acc[0], box[0]), Math.min(acc[1], box[1]), Math.max(acc[2], box[2]), Math.max(acc[3], box[3])];
    }, null);
    if (extent) map.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 14, duration: 350 });
    return Boolean(extent);
  }
  if (floodResponse.ok) {
    const floodFeatures = new GeoJSON().readFeatures(await floodResponse.json(), { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
    floodFeatures.forEach((feature) => {
      feature.set('layer', 'FLOOD_TRACE');
      const id = feature.get('trace_id') ?? feature.get('id');
      if (id) feature.setId(String(id));
    });
    const source = new VectorSource({ features: floodFeatures });
    const layer = new VectorLayer({ properties: { layerId: 'L-FLOOD-TRACE' }, source, visible: false, style: (feature) => styleFor(feature, styleContext()) });
    sources.set('L-FLOOD-TRACE', source);
    vectors.set('L-FLOOD-TRACE', layer);
    mapLayers.push(layer);
  }

  const mockLayerResponses:Array<[string,Response]>=[
    ['L-FLOOD-RISK-AREA',floodRiskResponse],
    ['L-DANGEROUS-RESERVOIR',reservoirResponse],
    ['L-STORM-FLOOD-IMPROVEMENT',improvementResponse],
  ];
  // 전국 관측소(수위·강수량). 시범서비스 대상은 전국이고 검증만 3개 지역이므로
  // 지역별로 자르지 않고 전국 파일 하나를 쓴다. 기본은 꺼져 있고, OpenLayers 는
  // url 소스를 **레이어가 처음 그려질 때** 받으므로 켜기 전에는 요청이 나가지 않는다.
  const STATION_LAYERS: Array<[string, string]> = [
    ['L-STATION-WL', '/reference/stations/wl_stations.geojson'],
    ['L-STATION-RF', '/reference/stations/rf_stations.geojson'],
  ];
  for (const [layerId, url] of STATION_LAYERS) {
    const source = new VectorSource({ url, format: new GeoJSON() });
    const layer = new VectorLayer({ properties: { layerId }, source, visible: false, style: (feature) => styleFor(feature, styleContext()) });
    sources.set(layerId, source);
    vectors.set(layerId, layer);
    mapLayers.push(layer);
  }

  for(const [layerId,response] of mockLayerResponses){
    if(!response.ok) continue;
    const features=new GeoJSON().readFeatures(await response.json(),{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
    features.forEach(feature=>{feature.set('layer',layerId);feature.set('provisional',true);const id=feature.get('feature_id')??feature.get('id');if(id)feature.setId(String(id));});
    const source=new VectorSource({features});
    const layer=new VectorLayer({properties:{layerId},source,visible:false,style:(feature)=>styleFor(feature,styleContext())});
    sources.set(layerId,source);vectors.set(layerId,layer);mapLayers.push(layer);
  }

  const center = SEED_CENTERS[dataCodeOfApp(adminCode)] ?? SEED_CENTERS[DEFAULT_MAP_REGION] ?? DEFAULT_CENTER;
  const map = new OlMap({ target, layers: mapLayers, view: new View({ center: fromLonLat(center), zoom: 11 }), controls: [] });

  const clickHandlers = new Set<(selection: MapFeatureSelection | null) => void>();
  const poiHandlers = new Set<(points: MapPoiPlacement[]) => void>();
  const hoverHandlers = new Set<(hover: MapFeatureHover | null) => void>();
  let anchorCoordinate: number[] | null = null;
  let poiSignature = '';
  let hoverSignature = '';

  /** 같은 피처 위에서 커서가 조금 움직였을 뿐인데 매번 React 상태를 바꾸면 태그가 떨린다.
   *  대상 피처가 실제로 바뀔 때만 올린다(위치는 그 시점 좌표를 쓴다). */
  function emitHover(hover: MapFeatureHover | null) {
    const signature = hover ? `${hover.layerId}:${hover.id}` : '';
    if (signature === hoverSignature) return;
    hoverSignature = signature;
    hoverHandlers.forEach((handler) => handler(hover));
  }

  /** 화면 안(여유 24/48px)에 있는 L1 점 피처만 마커 후보로 만든다.
   *  여유값은 핀이 반쯤 걸친 상태에서도 사라지지 않게 하는 폭·높이 보정이다. */
  function collectPoi(): MapPoiPlacement[] {
    const layer = vectors.get('L1');
    const source = sources.get('L1');
    if (!layer || !source || !layer.getVisible()) return [];
    const size = map.getSize();
    const width = size?.[0];
    const height = size?.[1];
    if (typeof width !== 'number' || typeof height !== 'number') return [];
    const points: MapPoiPlacement[] = [];
    for (const feature of source.getFeatures()) {
      const geometry = feature.getGeometry();
      if (!geometry || geometry.getType() !== 'Point') continue;
      const coordinate = (geometry as unknown as { getCoordinates(): number[] }).getCoordinates().slice(0, 2);
      const pixel = map.getPixelFromCoordinate(coordinate);
      const x = pixel?.[0];
      const y = pixel?.[1];
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < -24 || y < -48 || x > width + 24 || y > height + 48) continue;
      const properties: Record<string, unknown> = { ...feature.getProperties() };
      delete properties.geometry;
      points.push({ id: featureKey(feature), layerId: 'L1', x: Math.round(x), y: Math.round(y), coordinate, lonLat: toLonLat(coordinate) as [number, number], properties });
    }
    return points;
  }

  // postrender 는 프레임마다 불리므로 위치 서명이 실제로 바뀔 때만 React 로 올린다.
  function emitPoi(force = false) {
    const points = collectPoi();
    const signature = points.map((point) => `${point.id}:${point.x}:${point.y}`).join('|');
    if (!force && signature === poiSignature) return;
    poiSignature = signature;
    poiHandlers.forEach((handler) => handler(points));
  }

  function selectionAt(pixel: number[], eventCoordinate: number[]): MapFeatureSelection | null {
    const hits: Array<{ rank: number; feature: FeatureLike; layerId: string }> = [];
    map.forEachFeatureAtPixel(pixel, (feature, layer) => {
      const layerId = String((layer as Layer | null)?.get('layerId') ?? feature.get('layer') ?? '');
      hits.push({ rank: hitRank(layerId), feature, layerId });
    }, { hitTolerance: 6 });
    hits.sort((a, b) => a.rank - b.rank);
    const best = hits[0];
    if (!best) return null;
    const { feature, layerId } = best;
    const geometry = feature.getGeometry();
    const geometryType = geometry ? String(geometry.getType()) : '';
    let coordinate: number[] = eventCoordinate.slice(0, 2);
    if (geometryType === 'Point') {
      const point = (geometry as unknown as { getCoordinates?: () => number[] }).getCoordinates?.();
      if (point && point.length >= 2) coordinate = point.slice(0, 2);
    }
    const properties: Record<string, unknown> = { ...feature.getProperties() };
    delete properties.geometry;
    const lonLat = toLonLat(coordinate) as [number, number];
    return { id: featureKey(feature), layerId, geometryType, coordinate, lonLat, properties };
  }

  map.on('postrender', () => emitPoi());
  map.on('pointermove', (event) => {
    if (event.dragging) return;
    const hit = selectionAt(event.pixel, event.coordinate);
    map.getViewport().style.cursor = hit ? 'pointer' : '';
    const [x, y] = event.pixel;
    // 위험지구(L1)는 HTML 마커가 직접 호버를 받아 요약 카드를 띄운다. 여기서 또 태그를 내보내면
    // 같은 지점에 카드와 태그가 둘 다 뜬다.
    emitHover(hit && hit.layerId !== 'L1' && typeof x === 'number' && typeof y === 'number'
      ? { id: hit.id, layerId: hit.layerId, x: Math.round(x), y: Math.round(y), properties: hit.properties }
      : null);
  });
  // 커서가 지도 밖으로 나가면 태그도 걷는다. pointermove 는 더 이상 오지 않는다.
  map.getViewport().addEventListener('pointerleave', () => emitHover(null));
  function publish(hit: MapFeatureSelection | null) {
    clicked = hit?.id || null;
    vectors.forEach((vector) => vector.changed());
    rivers.redraw();
    anchorCoordinate = hit ? hit.coordinate : null;
    clickHandlers.forEach((handler) => handler(hit));
  }

  map.on('singleclick', (event) => {
    const hit = selectionAt(event.pixel, event.coordinate);
    publish(hit);
    // WMS 하천은 래스터라 피처 히트가 없다. 빈 곳을 클릭했을 때만 GetFeatureInfo로 되물어
    // 벡터 레이어와 같은 팝업을 띄운다. 실패해도 클릭 흐름을 막지 않는다.
    if (hit) return;
    const resolution = map.getView().getResolution();
    if (typeof resolution !== 'number') return;
    const coordinate = event.coordinate.slice(0, 2);
    void rivers.queryWms(coordinate, resolution).then((found) => {
      if (!found) return;
      // 되묻는 사이 사용자가 다른 곳을 클릭했으면 결과를 버린다.
      if (anchorCoordinate || clicked) return;
      publish({
        id: String(found.properties.riv_nm ?? found.source.id),
        layerId: riverLayerId(found.source.id),
        geometryType: 'Polygon',
        coordinate,
        lonLat: toLonLat(coordinate) as [number, number],
        properties: { ...found.properties, layer: 'L2', river_source_id: found.source.id },
      });
    });
  });

  return {
    map,
    onFeatureClick(handler) { clickHandlers.add(handler); return () => { clickHandlers.delete(handler); }; },
    onFeatureHover(handler) { hoverHandlers.add(handler); return () => { hoverHandlers.delete(handler); }; },
    onPoiChange(handler) { poiHandlers.add(handler); handler(collectPoi()); return () => { poiHandlers.delete(handler); }; },
    setPopupAnchor(coordinate) {
      anchorCoordinate = coordinate ? coordinate.slice(0, 2) : null;
      if (!coordinate && clicked) { clicked = null; vectors.forEach((vector) => vector.changed()); rivers.redraw(); }
    },
    setRegion(code, moveTo) {
      // 하천자료는 시군구별 파일이라 지역이 바뀌면 자료도 바꿔야 한다.
      rivers.setRegion(code);
      // 시드 3곳은 예전처럼 중심·줌 11 로 간다(그 화면에 맞춰 시연이 짜여 있다). 그 밖은 경계를
      // 받아 그 범위에 맞춘다 — 여기서 먼저 animate 를 걸면 뒤따르는 fit 과 서로 끊어 어느 쪽도
      // 끝까지 가지 못한다. 경계를 못 받으면(파일 없음) 그때 중심으로 간다.
      if (seedBoundaryCodes.has(code)) {
        const target = moveTo ?? SEED_CENTERS[code] ?? DEFAULT_CENTER;
        map.getView().animate({ center: fromLonLat(target), zoom: 11, duration: 350 });
        void showAdminBoundary(code);
        return;
      }
      void showAdminBoundary(code).then((fitted) => {
        if (fitted) return;
        const target = moveTo ?? SEED_CENTERS[code] ?? DEFAULT_CENTER;
        map.getView().animate({ center: fromLonLat(target), zoom: 11, duration: 350 });
      });
    },
    focusLonLat(lonLat, zoom = 15) {
      map.getView().animate({ center: fromLonLat(lonLat), zoom, duration: 350 });
    },
    highlightFeature(id) {
      // 하천은 표시 중인 소스에 따라 벡터가 숨어 있을 수 있으므로 먼저 해당 소스를 켠다.
      rivers.revealFeature(id);
      for (const source of [...sources.values(), ...rivers.featureSources()]) {
        // 국가기본도 하천은 한 하천이 여러 폴리곤으로 나뉜다(요천 5개). river_id 로 가리키면
        // 그 하천에 속한 조각 전부를 잡아 합친 범위로 맞춘다 — 한 조각만 잡으면 엉뚱하게 확대된다.
        const byRiverId = source.getFeatures().filter((candidate) => String(candidate.get('river_id') ?? '') === id);
        const matches = byRiverId.length ? byRiverId : [
          source.getFeatureById(id) ?? source.getFeatures().find((candidate) => String(candidate.get('id') ?? candidate.get('district_code') ?? candidate.get('trace_id') ?? '') === id),
        ].filter((feature): feature is NonNullable<typeof feature> => Boolean(feature));
        if (!matches.length) continue;
        selected = id;
        vectors.forEach((vector) => vector.changed());
        rivers.redraw();
        type Box = [number, number, number, number];
        const extent = matches.reduce<Box | null>((acc, feature) => {
          const box = feature.getGeometry()?.getExtent() as Box | undefined;
          if (!box) return acc;
          if (!acc) return [box[0], box[1], box[2], box[3]];
          return [Math.min(acc[0], box[0]), Math.min(acc[1], box[1]), Math.max(acc[2], box[2]), Math.max(acc[3], box[3])];
        }, null);
        if (extent) map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 15, duration: 350 });
        return true;
      }
      return false;
    },
    setLayerVisible(code, visible) { vectors.get(code)?.setVisible(visible); if (code === 'L1') emitPoi(true); },
    setRiverSourceVisible(sourceId, visible) { rivers.setVisible(sourceId, visible); },
    onRiverStateChange(handler) { return rivers.onStateChange(handler); },
    setBaseMap(type) {
      baseMapType = type;
      baseLayer?.setVisible(type === 'base');
      satelliteLayer?.setVisible(type === 'satellite');
      // 영상지도에서는 벡터 색·굵기 배색을 바꾸므로 벡터 레이어를 다시 그린다.
      vectors.forEach((vector) => vector.changed());
      rivers.redraw();
      if (!key) onState?.('seed-only', 'VWorld 키 미설정: 공간 Seed만 표시');
      else onState?.('connecting', `VWorld ${type === 'satellite' ? '영상' : '일반'}지도 전환 중`);
    },
    destroy() { clickHandlers.clear(); poiHandlers.clear(); hoverHandlers.clear(); rivers.destroy(); map.setTarget(undefined); },
  };
}
