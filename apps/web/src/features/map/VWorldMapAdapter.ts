import OlMap from 'ol/Map';
import View from 'ol/View';
import GeoJSON from 'ol/format/GeoJSON';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import type { FeatureLike } from 'ol/Feature';

const DEFAULT_CENTER: [number, number] = [127.39, 35.416];
const CENTERS: Record<string, [number, number]> = {
  '41430': [126.968, 37.344],
  '47190': [128.344, 36.119],
  '45190': DEFAULT_CENTER,
};
export type MapConnectionState = 'seed-only' | 'connecting' | 'connected' | 'error';
export type BaseMapType = 'base' | 'satellite';
export interface VWorldMapHandle {
  map: OlMap;
  setRegion(code: string): void;
  highlightFeature(id: string): boolean;
  setLayerVisible(layerCode: string, visible: boolean): void;
  setBaseMap(type: BaseMapType): void;
  destroy(): void;
}

function styleFor(feature: FeatureLike, selected: string | null) {
  const layer = String(feature.get('layer') ?? '');
  const id = String(feature.getId() ?? feature.get('id') ?? feature.get('trace_id') ?? '');
  const active = id === selected;
  const provisional = Boolean(feature.get('provisional'));
  if(layer==='L-DANGEROUS-RESERVOIR') return new Style({image:new CircleStyle({radius:active?10:7,fill:new Fill({color:active?'#ff9800':'#00897b'}),stroke:new Stroke({color:'#fff',width:2})})});
  if (layer === 'L1' || feature.getGeometry()?.getType() === 'Point') {
    return new Style({ image: new CircleStyle({ radius: active ? 10 : 6, fill: new Fill({ color: active ? 'rgba(255,152,0,.95)' : 'rgba(220,76,70,.82)' }), stroke: new Stroke({ color: '#fff', width: active ? 3 : 2 }) }) });
  }
  if (layer === 'FLOOD_TRACE' || layer === 'L-FLOOD-RISK-AREA') {
    return new Style({ stroke: new Stroke({ color: active ? '#ff8c00' : '#1e88e5', width: active ? 4 : 2, lineDash: [8, 4] }), fill: new Fill({ color: active ? 'rgba(255,152,0,.25)' : 'rgba(30,136,229,.22)' }) });
  }
  if(layer==='L-STORM-FLOOD-IMPROVEMENT') return new Style({stroke:new Stroke({color:active?'#ff8c00':'#7b1fa2',width:active?4:2,lineDash:[5,4]}),fill:new Fill({color:active?'rgba(255,152,0,.18)':'rgba(123,31,162,.12)'})});
  return new Style({ stroke: new Stroke({ color: active ? '#ff8c00' : provisional ? '#9b6b32' : '#1769aa', width: active ? 4 : 2 }), fill: new Fill({ color: active ? 'rgba(255,152,0,.18)' : 'rgba(23,105,170,.07)' }) });
}

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
  for (const code of ['L1', 'L2', 'L3']) {
    const source = new VectorSource({ features: raw.filter((feature) => String(feature.get('layer')) === code) });
    const layer = new VectorLayer({ properties: { layerId: code }, source, style: (feature) => styleFor(feature, selected) });
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
    const layer = new VectorLayer({ properties: { layerId: 'L-FLOOD-TRACE' }, source, visible: false, style: (feature) => styleFor(feature, selected) });
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
    const layer=new VectorLayer({properties:{layerId},source,visible:false,style:(feature)=>styleFor(feature,selected)});
    sources.set(layerId,source);vectors.set(layerId,layer);mapLayers.push(layer);
  }

  const center = CENTERS[adminCode] ?? DEFAULT_CENTER;
  const map = new OlMap({ target, layers: mapLayers, view: new View({ center: fromLonLat(center), zoom: 11 }), controls: [] });
  return {
    map,
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
      baseLayer?.setVisible(type === 'base');
      satelliteLayer?.setVisible(type === 'satellite');
      if (!key) onState?.('seed-only', 'VWorld 키 미설정: 공간 Seed만 표시');
      else onState?.('connecting', `VWorld ${type === 'satellite' ? '영상' : '일반'}지도 전환 중`);
    },
    destroy() { map.setTarget(undefined); },
  };
}
