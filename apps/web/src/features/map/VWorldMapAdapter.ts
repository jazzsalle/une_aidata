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
import { createRiverLayers, type RiverLayerRegistry, type RiverSourceState } from './riverLayers';
import { isRiverLayerId, riverLayerId } from './riverLayerSources';

const DEFAULT_CENTER: [number, number] = [127.39, 35.416];
const CENTERS: Record<string, [number, number]> = {
  '41430': [126.968, 37.344],
  '47190': [128.344, 36.119],
  '45190': DEFAULT_CENTER,
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
export interface VWorldMapHandle {
  map: OlMap;
  setRegion(code: string): void;
  highlightFeature(id: string): boolean;
  setLayerVisible(layerCode: string, visible: boolean): void;
  /** 하천 소스(실폭·중심선·비교용 Seed 등) 개별 표시 토글. */
  setRiverSourceVisible(sourceId: string, visible: boolean): void;
  /** 하천 소스가 실제로 무엇으로 공급되고 있는지(WMS/로컬 Seed/불가) 구독한다. */
  onRiverStateChange(handler: (states: RiverSourceState[]) => void): () => void;
  setBaseMap(type: BaseMapType): void;
  /** 피처 클릭 구독. 빈 지도를 클릭하면 null을 전달한다. 해제 함수를 반환한다. */
  onFeatureClick(handler: (selection: MapFeatureSelection | null) => void): () => void;
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
const HIT_PRIORITY: Record<string, number> = { L1: 0, 'L-DANGEROUS-RESERVOIR': 0, FLOOD_TRACE: 1, 'L-FLOOD-TRACE': 1, 'L-FLOOD-RISK-AREA': 1, 'L-STORM-FLOOD-IMPROVEMENT': 1, L2: 2, L3: 3 };
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
  const rivers: RiverLayerRegistry = createRiverLayers({ features: raw, styleContext, key });
  mapLayers.push(...rivers.layers);
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
  for(const [layerId,response] of mockLayerResponses){
    if(!response.ok) continue;
    const features=new GeoJSON().readFeatures(await response.json(),{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
    features.forEach(feature=>{feature.set('layer',layerId);feature.set('provisional',true);const id=feature.get('feature_id')??feature.get('id');if(id)feature.setId(String(id));});
    const source=new VectorSource({features});
    const layer=new VectorLayer({properties:{layerId},source,visible:false,style:(feature)=>styleFor(feature,styleContext())});
    sources.set(layerId,source);vectors.set(layerId,layer);mapLayers.push(layer);
  }

  const center = CENTERS[adminCode] ?? DEFAULT_CENTER;
  const map = new OlMap({ target, layers: mapLayers, view: new View({ center: fromLonLat(center), zoom: 11 }), controls: [] });

  const clickHandlers = new Set<(selection: MapFeatureSelection | null) => void>();
  const poiHandlers = new Set<(points: MapPoiPlacement[]) => void>();
  let anchorCoordinate: number[] | null = null;
  let poiSignature = '';

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
    map.getViewport().style.cursor = map.hasFeatureAtPixel(event.pixel, { hitTolerance: 6 }) ? 'pointer' : '';
  });
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
    onPoiChange(handler) { poiHandlers.add(handler); handler(collectPoi()); return () => { poiHandlers.delete(handler); }; },
    setPopupAnchor(coordinate) {
      anchorCoordinate = coordinate ? coordinate.slice(0, 2) : null;
      if (!coordinate && clicked) { clicked = null; vectors.forEach((vector) => vector.changed()); rivers.redraw(); }
    },
    setRegion(code) { map.getView().animate({ center: fromLonLat(CENTERS[code] ?? DEFAULT_CENTER), zoom: 11, duration: 350 }); },
    highlightFeature(id) {
      // 하천은 표시 중인 소스에 따라 벡터가 숨어 있을 수 있으므로 먼저 해당 소스를 켠다.
      rivers.revealFeature(id);
      for (const source of [...sources.values(), ...rivers.featureSources()]) {
        const feature = source.getFeatureById(id) ?? source.getFeatures().find((candidate) => String(candidate.get('id') ?? candidate.get('district_code') ?? candidate.get('trace_id') ?? '') === id);
        if (feature) {
          selected = id;
          vectors.forEach((vector) => vector.changed());
          rivers.redraw();
          const extent = feature.getGeometry()?.getExtent();
          if (extent) map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 15, duration: 350 });
          return true;
        }
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
    destroy() { clickHandlers.clear(); poiHandlers.clear(); rivers.destroy(); map.setTarget(undefined); },
  };
}
