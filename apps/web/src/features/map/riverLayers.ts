import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import ImageWMS from 'ol/source/ImageWMS';
import VectorSource from 'ol/source/Vector';
import type BaseLayer from 'ol/layer/Base';
import type Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import { lineStyle, palette } from './mapStyles';
import {
  RIVER_LAYER_SOURCES,
  riverLayerId,
  type RiverLayerSource,
} from './riverLayerSources';

/** 소스 1건의 현재 공급 경로. 화면에 '무엇이 실제로 그려지고 있는지'를 그대로 말하기 위해 보관한다. */
export type RiverDelivery = 'wms' | 'geojson' | 'unavailable';
export interface RiverSourceState {
  id: string;
  delivery: RiverDelivery;
  visible: boolean;
  message: string;
}

export interface RiverLayerRegistry {
  /** 지도에 추가할 레이어들(하천 소스 순서대로). */
  layers: BaseLayer[];
  setVisible(sourceId: string, visible: boolean): void;
  isVisible(sourceId: string): boolean;
  /** 베이스맵 전환 시 벡터 배색을 다시 계산한다. */
  redraw(): void;
  /** highlightFeature(하천 id) 가 여전히 동작하도록 벡터 소스를 노출한다. */
  featureSources(): VectorSource[];
  /** 해당 하천 id 를 담고 있는 소스를 표시 상태로 올린다. 숨겨진 레이어로 이동하면 아무것도 안 보인다. */
  revealFeature(id: string): boolean;
  states(): RiverSourceState[];
  onStateChange(handler: (states: RiverSourceState[]) => void): () => void;
  /** WMS 래스터는 피처 히트가 안 되므로 클릭 지점을 GetFeatureInfo로 되묻는다. */
  queryWms(coordinate: number[], resolution: number): Promise<{ source: RiverLayerSource; properties: Record<string, unknown> } | null>;
  destroy(): void;
}

interface StyleContext { selected: string | null; clicked: string | null; satellite: boolean }

function styleForRiver(source: RiverLayerSource, feature: FeatureLike, context: StyleContext) {
  const { color, satelliteColor, width, fill, satelliteFill, dash } = source.style;
  const id = String(feature.getId() ?? feature.get('id') ?? '');
  const active = Boolean(id) && (id === context.selected || id === context.clicked);
  const tone = palette(context.satellite);
  if (active) return lineStyle(tone.activeLine, tone.activeCasing, width + 1.6, tone.activeFill, dash);
  return lineStyle(context.satellite ? satelliteColor : color, tone.casing, width, context.satellite ? satelliteFill : fill, dash);
}

/** VWorld 는 DOMAIN 파라미터를 키에 등록된 서비스 URL 과 대조한다.
 *  등록되지 않은 출처(예: localhost)로 요청하면 INCORRECT_KEY 로 거절한다 —
 *  키가 유효해도 그렇다. 배포 환경에서는 origin 이 곧 등록 도메인이라 그대로 맞지만,
 *  로컬 개발에서는 등록 도메인을 VITE_VWORLD_SERVICE_DOMAIN 으로 알려줘야 한다. */
function serviceDomain() {
  const configured = import.meta.env.VITE_VWORLD_SERVICE_DOMAIN?.trim();
  if (configured) return configured;
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** VWorld WMS 요청 파라미터.
 *  CRS는 EPSG:3857로 고정한다 — WMS 1.3.0의 EPSG:4326은 축 순서가 lat,lon이라
 *  잘못 쓰면 우리가 지금 쫓고 있는 오정렬과 똑같은 증상이 새로 생긴다. */
function wmsSource(source: RiverLayerSource, key: string, onError: () => void) {
  const wms = new ImageWMS({
    url: source.url,
    projection: source.projection,
    // 키는 환경변수에서만 온다. 소스에 기록하지 않는다.
    params: {
      VERSION: '1.3.0',
      LAYERS: source.layerName,
      // WMS 1.3.0은 STYLES가 LAYERS와 1:1로 필요하다. VWorld는 미지정 시 예외를 내는 경우가 있다.
      STYLES: source.styleName,
      TRANSPARENT: true,
      KEY: key,
      DOMAIN: serviceDomain(),
    },
    ratio: 1,
    crossOrigin: undefined,
  });
  // 실패를 콘솔 에러로 흘리지 않는다. 지도 연결상태 필(베이스맵 configured/verified 표기)과도 분리한다.
  wms.on('imageloaderror', onError);
  return wms;
}

interface CreateOptions {
  /** 어댑터가 이미 읽어 둔 geo.json 피처. 하천 폴백을 위해 다시 fetch 하지 않는다. */
  features: Feature[];
  styleContext(): StyleContext;
  /** 실제 사용 가능한 VWorld 키. 없으면 WMS 소스를 아예 만들지 않는다. */
  key?: string;
}

export function createRiverLayers({ features, styleContext, key }: CreateOptions): RiverLayerRegistry {
  const layers: BaseLayer[] = [];
  const wmsLayers = new Map<string, ImageLayer<ImageWMS>>();
  const vectorLayers = new Map<string, VectorLayer<VectorSource>>();
  const delivery = new Map<string, RiverDelivery>();
  const messages = new Map<string, string>();
  const wanted = new Map<string, boolean>();
  const handlers = new Set<(states: RiverSourceState[]) => void>();

  function emit() {
    const snapshot = states();
    handlers.forEach((handler) => handler(snapshot));
  }

  function states(): RiverSourceState[] {
    return RIVER_LAYER_SOURCES.map((source) => ({
      id: source.id,
      delivery: delivery.get(source.id) ?? 'unavailable',
      visible: Boolean(wanted.get(source.id)),
      message: messages.get(source.id) ?? '',
    }));
  }

  /** 선언된 추출 규칙으로 로컬 피처를 고른다. 어댑터와 동일한 4326→3857 변환을 이미 거친 피처다. */
  function pick(source: RiverLayerSource) {
    if (!source.geojson) return [];
    const { property, value } = source.geojson;
    return features.filter((feature) => String(feature.get(property)) === value);
  }

  function buildVector(source: RiverLayerSource, visible: boolean) {
    const picked = pick(source);
    if (!picked.length) return undefined;
    const layer = new VectorLayer({
      properties: { layerId: riverLayerId(source.id), riverSourceId: source.id },
      source: new VectorSource({ features: picked }),
      visible,
      style: (feature) => styleForRiver(source, feature, styleContext()),
    });
    vectorLayers.set(source.id, layer);
    layers.push(layer);
    return layer;
  }

  for (const source of RIVER_LAYER_SOURCES) {
    if (source.status === 'unverified') {
      delivery.set(source.id, 'unavailable');
      messages.set(source.id, '소스 경로 미확정');
      wanted.set(source.id, false);
      continue;
    }

    const useWms = source.kind === 'wms' && Boolean(source.url) && Boolean(source.layerName) && (!source.requiresVWorldKey || Boolean(key));
    wanted.set(source.id, source.defaultVisible);

    if (useWms && key) {
      const wms = wmsSource(source, key, () => {
        // WMS가 죽으면 조용히 로컬 폴백으로 강등한다. 하천이 통째로 사라지는 것보다 낫다.
        if (delivery.get(source.id) !== 'wms') return;
        const fallback = vectorLayers.get(source.id);
        wmsLayers.get(source.id)?.setVisible(false);
        delivery.set(source.id, fallback ? 'geojson' : 'unavailable');
        messages.set(source.id, fallback ? 'WMS 실패 · 로컬 Seed로 대체' : 'WMS 실패 · 대체자료 없음');
        if (fallback && wanted.get(source.id)) fallback.setVisible(true);
        emit();
      });
      const layer = new ImageLayer({
        properties: { layerId: riverLayerId(source.id), riverSourceId: source.id },
        source: wms,
        visible: source.defaultVisible,
        opacity: 0.85,
      });
      wmsLayers.set(source.id, layer);
      layers.push(layer);
      delivery.set(source.id, 'wms');
      messages.set(source.id, 'VWorld WMS');
      // 폴백 벡터는 만들어만 두고 숨긴다. WMS 실패 시 즉시 바꿔 끼운다.
      buildVector(source, false);
      continue;
    }

    const vector = buildVector(source, source.defaultVisible);
    delivery.set(source.id, vector ? 'geojson' : 'unavailable');
    if (vector) {
      messages.set(source.id, source.kind === 'wms' ? (key ? 'WMS 미구성 · 로컬 Seed' : 'VWorld 키 미설정 · 로컬 Seed') : '로컬 Seed');
    } else {
      messages.set(source.id, '표시할 자료 없음');
      wanted.set(source.id, false);
    }
  }

  async function queryWms(coordinate: number[], resolution: number) {
    for (const source of RIVER_LAYER_SOURCES) {
      if (delivery.get(source.id) !== 'wms' || !wanted.get(source.id)) continue;
      const wms = wmsLayers.get(source.id)?.getSource();
      if (!wms) continue;
      const url = wms.getFeatureInfoUrl(coordinate, resolution, source.projection, { INFO_FORMAT: 'application/json' });
      if (!url) continue;
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const payload = await response.json();
        const first = Array.isArray(payload?.features) ? payload.features[0] : null;
        if (first?.properties) return { source, properties: first.properties as Record<string, unknown> };
      } catch {
        // GetFeatureInfo는 부가 정보다. 실패해도 클릭 흐름을 막지 않는다.
      }
    }
    return null;
  }

  return {
    layers,
    setVisible(sourceId, visible) {
      wanted.set(sourceId, visible);
      const mode = delivery.get(sourceId);
      wmsLayers.get(sourceId)?.setVisible(visible && mode === 'wms');
      vectorLayers.get(sourceId)?.setVisible(visible && mode === 'geojson');
      emit();
    },
    isVisible(sourceId) { return Boolean(wanted.get(sourceId)); },
    redraw() { vectorLayers.forEach((layer) => layer.changed()); },
    featureSources() {
      return Array.from(vectorLayers.values(), (layer) => layer.getSource()).filter((source): source is VectorSource => Boolean(source));
    },
    revealFeature(id) {
      for (const [sourceId, layer] of vectorLayers) {
        const found = layer.getSource()?.getFeatureById(id);
        if (!found) continue;
        // WMS로 공급 중인 소스는 벡터가 폴백용으로 숨어 있다. 그때는 굳이 켜지 않는다 —
        // 같은 하천이 WMS 래스터로 이미 그려져 있다.
        if (delivery.get(sourceId) !== 'geojson') return true;
        if (!wanted.get(sourceId)) {
          wanted.set(sourceId, true);
          layer.setVisible(true);
          emit();
        }
        return true;
      }
      return false;
    },
    states,
    onStateChange(handler) { handlers.add(handler); handler(states()); return () => { handlers.delete(handler); }; },
    queryWms,
    destroy() { handlers.clear(); },
  };
}
