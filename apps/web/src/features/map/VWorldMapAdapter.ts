import OlMap from 'ol/Map';
import View from 'ol/View';
import GeoJSON from 'ol/format/GeoJSON';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';
import { fromLonLat, toLonLat } from 'ol/proj';
import type { FeatureLike } from 'ol/Feature';
import type Layer from 'ol/layer/Layer';

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
export interface VWorldMapHandle {
  map: OlMap;
  setRegion(code: string): void;
  highlightFeature(id: string): boolean;
  setLayerVisible(layerCode: string, visible: boolean): void;
  setBaseMap(type: BaseMapType): void;
  /** 피처 클릭 구독. 빈 지도를 클릭하면 null을 전달한다. 해제 함수를 반환한다. */
  onFeatureClick(handler: (selection: MapFeatureSelection | null) => void): () => void;
  /** 팝업 기준좌표 지정(null이면 팝업 종료 + 클릭 강조 해제). */
  setPopupAnchor(coordinate: number[] | null): void;
  /** 기준좌표의 화면 픽셀 변화를 구독한다(지도 이동·확대 시 팝업 추종). 해제 함수를 반환한다. */
  onPopupAnchorMove(handler: (pixel: [number, number] | null) => void): () => void;
  destroy(): void;
}

interface StyleContext { selected: string | null; clicked: string | null; satellite: boolean }

function featureKey(feature: FeatureLike) {
  return String(feature.getId() ?? feature.get('id') ?? feature.get('district_code') ?? feature.get('trace_id') ?? feature.get('feature_id') ?? '');
}

// 선(면 경계)은 casing(바깥 테두리) + 본선 2겹으로 그려 영상지도·일반지도 모두에서 배경과 분리되게 한다.
function lineStyle(color: string, casing: string, width: number, fill?: string, dash?: number[]) {
  return [
    new Style({ stroke: new Stroke({ color: casing, width: width + 3, lineDash: dash, lineCap: 'round', lineJoin: 'round' }) }),
    new Style({ stroke: new Stroke({ color, width, lineDash: dash, lineCap: 'round', lineJoin: 'round' }), fill: fill ? new Fill({ color: fill }) : undefined }),
  ];
}
// 점은 casing 원판 위에 본체 원을 얹어 밝은 영상 위에서도 윤곽이 남게 한다.
function pointStyle(radius: number, color: string, casing: string, ring: string) {
  return [
    new Style({ image: new CircleStyle({ radius: radius + 3, fill: new Fill({ color: casing }) }) }),
    new Style({ image: new CircleStyle({ radius, fill: new Fill({ color }), stroke: new Stroke({ color: ring, width: 1.6 }) }) }),
  ];
}

function styleFor(feature: FeatureLike, context: StyleContext) {
  const layer = String(feature.get('layer') ?? '');
  const id = featureKey(feature);
  const active = Boolean(id) && (id === context.selected || id === context.clicked);
  const provisional = Boolean(feature.get('provisional'));
  const sat = context.satellite;
  // 영상지도: 어두운 casing + 형광 계열 본선 / 일반지도: 흰 casing + 짙은 본선. 선택상태는 두 모드 모두 색·굵기·casing이 함께 바뀐다.
  const casing = sat ? 'rgba(10,12,16,.92)' : 'rgba(255,255,255,.92)';
  const activeCasing = sat ? '#ffffff' : 'rgba(46,26,0,.55)';
  const activeLine = sat ? '#ff2d95' : '#ff8c00';
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
  if (layer === 'L2') {
    return lineStyle(active ? activeLine : sat ? '#00e5ff' : '#1769aa', active ? activeCasing : casing, active ? 4 : 2.4, active ? (sat ? 'rgba(255,45,149,.26)' : 'rgba(255,152,0,.18)') : sat ? 'rgba(0,229,255,.24)' : 'rgba(23,105,170,.07)');
  }
  const base = sat ? '#ffffff' : provisional ? '#9b6b32' : '#1769aa';
  return lineStyle(active ? activeLine : base, active ? activeCasing : casing, active ? 4 : 2.2, active ? (sat ? 'rgba(255,45,149,.2)' : 'rgba(255,152,0,.18)') : sat ? 'rgba(255,255,255,.1)' : 'rgba(23,105,170,.07)');
}

// 배경(행정경계 등) 위에 겹친 POI를 먼저 잡도록 레이어 우선순위를 둔다.
const HIT_PRIORITY: Record<string, number> = { L1: 0, 'L-DANGEROUS-RESERVOIR': 0, FLOOD_TRACE: 1, 'L-FLOOD-TRACE': 1, 'L-FLOOD-RISK-AREA': 1, 'L-STORM-FLOOD-IMPROVEMENT': 1, L2: 2, L3: 3 };

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
  const mapLayers: Array<TileLayer<XYZ> | VectorLayer<VectorSource>> = [];
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
  for (const code of ['L1', 'L2', 'L3']) {
    const source = new VectorSource({ features: raw.filter((feature) => String(feature.get('layer')) === code) });
    const layer = new VectorLayer({ properties: { layerId: code }, source, style: (feature) => styleFor(feature, styleContext()) });
    sources.set(code, source);
    vectors.set(code, layer);
    mapLayers.push(layer);
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
  const anchorHandlers = new Set<(pixel: [number, number] | null) => void>();
  let anchorCoordinate: number[] | null = null;
  let anchorPixel: [number, number] | null = null;

  function emitAnchor(force = false) {
    const raw = anchorCoordinate ? map.getPixelFromCoordinate(anchorCoordinate) : null;
    const x = raw?.[0];
    const y = raw?.[1];
    const next: [number, number] | null = typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? [Math.round(x), Math.round(y)] : null;
    const previous = anchorPixel;
    const same = next === null ? previous === null : previous !== null && next[0] === previous[0] && next[1] === previous[1];
    if (same && !force) return;
    anchorPixel = next;
    anchorHandlers.forEach((handler) => handler(next));
  }

  function selectionAt(pixel: number[], eventCoordinate: number[]): MapFeatureSelection | null {
    const hits: Array<{ rank: number; feature: FeatureLike; layerId: string }> = [];
    map.forEachFeatureAtPixel(pixel, (feature, layer) => {
      const layerId = String((layer as Layer | null)?.get('layerId') ?? feature.get('layer') ?? '');
      hits.push({ rank: HIT_PRIORITY[layerId] ?? 2, feature, layerId });
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

  map.on('postrender', () => { if (anchorCoordinate) emitAnchor(); });
  map.on('pointermove', (event) => {
    if (event.dragging) return;
    map.getViewport().style.cursor = map.hasFeatureAtPixel(event.pixel, { hitTolerance: 6 }) ? 'pointer' : '';
  });
  map.on('singleclick', (event) => {
    const hit = selectionAt(event.pixel, event.coordinate);
    clicked = hit?.id || null;
    vectors.forEach((vector) => vector.changed());
    anchorCoordinate = hit ? hit.coordinate : null;
    emitAnchor(true);
    clickHandlers.forEach((handler) => handler(hit));
  });

  return {
    map,
    onFeatureClick(handler) { clickHandlers.add(handler); return () => { clickHandlers.delete(handler); }; },
    onPopupAnchorMove(handler) { anchorHandlers.add(handler); return () => { anchorHandlers.delete(handler); }; },
    setPopupAnchor(coordinate) {
      anchorCoordinate = coordinate ? coordinate.slice(0, 2) : null;
      if (!coordinate && clicked) { clicked = null; vectors.forEach((vector) => vector.changed()); }
      emitAnchor(true);
    },
    setRegion(code) { map.getView().animate({ center: fromLonLat(CENTERS[code] ?? DEFAULT_CENTER), zoom: 11, duration: 350 }); },
    highlightFeature(id) {
      for (const source of sources.values()) {
        const feature = source.getFeatureById(id) ?? source.getFeatures().find((candidate) => String(candidate.get('id') ?? candidate.get('district_code') ?? candidate.get('trace_id') ?? '') === id);
        if (feature) {
          selected = id;
          vectors.forEach((vector) => vector.changed());
          const extent = feature.getGeometry()?.getExtent();
          if (extent) map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 15, duration: 350 });
          return true;
        }
      }
      return false;
    },
    setLayerVisible(code, visible) { vectors.get(code)?.setVisible(visible); },
    setBaseMap(type) {
      baseMapType = type;
      baseLayer?.setVisible(type === 'base');
      satelliteLayer?.setVisible(type === 'satellite');
      // 영상지도에서는 벡터 색·굵기 배색을 바꾸므로 벡터 레이어를 다시 그린다.
      vectors.forEach((vector) => vector.changed());
      if (!key) onState?.('seed-only', 'VWorld 키 미설정: 공간 Seed만 표시');
      else onState?.('connecting', `VWorld ${type === 'satellite' ? '영상' : '일반'}지도 전환 중`);
    },
    destroy() { clickHandlers.clear(); anchorHandlers.clear(); map.setTarget(undefined); },
  };
}
