import GeoJSON from 'ol/format/GeoJSON';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import ImageWMS from 'ol/source/ImageWMS';
import VectorSource from 'ol/source/Vector';
import type BaseLayer from 'ol/layer/Base';
import type Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import { labelStyle, lineStyle, palette, pointStyle } from './mapStyles';
import {
  RIVER_LAYER_SOURCES,
  riverDataUrl,
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
  /** 지자체별 파일로 나뉜 소스를 새 지역 자료로 바꾼다. 켜져 있는 소스만 받는다. */
  setRegion(adminCode: string): void;
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
  // Agent·보고서는 하천을 rivers.json 의 river_id(RIV-YC 등)로 가리킨다. 국가기본도 피처는
  // 자체 id 를 쓰므로 전처리에서 붙인 river_id 로도 선택 상태를 판정한다.
  const riverId = String(feature.get('river_id') ?? '');
  const marks = [context.selected, context.clicked];
  const active = (Boolean(id) && marks.includes(id)) || (Boolean(riverId) && marks.includes(riverId));
  const tone = palette(context.satellite);
  if (source.semantic === 'label') {
    const text = String(feature.get('RIVER_NM') ?? '');
    if (!text) return [];
    const ink = active ? tone.activeLine : (context.satellite ? satelliteColor : color);
    return labelStyle(text, ink, tone.casing, ink);
  }
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
  /** 지자체별 파일 소스가 처음 받을 지역. */
  adminCode: string;
}

export function createRiverLayers({ features, styleContext, key, adminCode }: CreateOptions): RiverLayerRegistry {
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

  // --- 지자체별 파일 소스 -----------------------------------------------------
  // 파일이 지역당 0.5~3.5 MB 라 지도를 열 때 전부 받으면 초기 로드를 망친다.
  // 켤 때 처음 받고, 받아 둔 지역은 다시 받지 않는다.
  let region = adminCode;
  const format = new GeoJSON();
  const cache = new Map<string, Feature[]>();
  const loadedRegion = new Map<string, string>();
  const inflight = new Set<string>();

  /** 상태 칸 문구. 0건은 실패가 아니라 '이 지역 원자료에 그런 자료가 없다'는 사실이므로 구분해 적는다. */
  function countMessage(source: RiverLayerSource, count: number) {
    const name = source.datasetShort ?? '자료';
    return count ? `${name} · ${count.toLocaleString('ko-KR')}건` : `${name} · 이 지역 해당 자료 없음`;
  }

  function buildRemoteVector(source: RiverLayerSource, visible: boolean) {
    const layer = new VectorLayer({
      properties: { layerId: riverLayerId(source.id), riverSourceId: source.id },
      source: new VectorSource(),
      visible,
      style: (feature) => styleForRiver(source, feature, styleContext()),
    });
    vectorLayers.set(source.id, layer);
    layers.push(layer);
    return layer;
  }

  async function loadRemote(source: RiverLayerSource, code: string) {
    const template = source.dataUrlTemplate;
    const layer = vectorLayers.get(source.id);
    if (!template || !layer) return;
    if (loadedRegion.get(source.id) === code) return;
    const cacheKey = `${source.id}:${code}`;
    if (inflight.has(cacheKey)) return;

    const cached = cache.get(cacheKey);
    if (cached) {
      layer.getSource()?.clear();
      layer.getSource()?.addFeatures(cached);
      loadedRegion.set(source.id, code);
      delivery.set(source.id, 'geojson');
      messages.set(source.id, countMessage(source, cached.length));
      // 표시 여부는 그 사이 바뀌었을 수 있다. 받은 시점의 요청 상태를 그대로 반영한다.
      layer.setVisible(Boolean(wanted.get(source.id)));
      emit();
      return;
    }

    inflight.add(cacheKey);
    messages.set(source.id, '자료 받는 중');
    emit();
    try {
      const response = await fetch(riverDataUrl(template, code), { cache: 'force-cache' });
      if (!response.ok) throw new Error(String(response.status));
      const parsed = format.readFeatures(await response.json(), {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      }) as Feature[];
      // 받아 둔 것은 지역이 바뀌었어도 캐시에 남긴다. 되돌아올 때 다시 받지 않는다.
      cache.set(cacheKey, parsed);
      // 큰 파일을 받는 사이 사용자가 지역을 바꿨을 수 있다.
      // 그때 그리면 이전 지역 형상이 새 지도에 남는다. 응답이 늦은 요청은 버린다.
      if (region !== code) return;
      layer.getSource()?.clear();
      layer.getSource()?.addFeatures(parsed);
      loadedRegion.set(source.id, code);
      delivery.set(source.id, 'geojson');
      messages.set(source.id, countMessage(source, parsed.length));
      layer.setVisible(Boolean(wanted.get(source.id)));
    } catch {
      // 지역이 이미 바뀐 요청의 실패는 현재 화면 상태로 보고하지 않는다.
      if (region !== code) return;
      // 이 지역 자료가 없을 수 있다(대상 3개 지자체만 반입했다). 지도를 막지 않는다.
      layer.getSource()?.clear();
      layer.setVisible(false);
      loadedRegion.delete(source.id);
      delivery.set(source.id, 'unavailable');
      messages.set(source.id, '이 지역 자료 없음');
    } finally {
      inflight.delete(cacheKey);
      emit();
    }
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

    if (source.dataUrlTemplate) {
      buildRemoteVector(source, source.defaultVisible);
      delivery.set(source.id, 'geojson');
      messages.set(source.id, '켤 때 자료를 받는다');
      if (source.defaultVisible) void loadRemote(source, region);
      continue;
    }

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
    setRegion(code) {
      if (code === region) return;
      region = code;
      for (const source of RIVER_LAYER_SOURCES) {
        if (!source.dataUrlTemplate) continue;
        // 지역이 바뀌면 이전 지역 형상은 즉시 치운다. 켜져 있는 소스만 새로 받는다.
        loadedRegion.delete(source.id);
        vectorLayers.get(source.id)?.getSource()?.clear();
        if (wanted.get(source.id)) void loadRemote(source, code);
      }
    },
    setVisible(sourceId, visible) {
      wanted.set(sourceId, visible);
      const source = RIVER_LAYER_SOURCES.find((item) => item.id === sourceId);
      if (visible && source?.dataUrlTemplate) void loadRemote(source, region);
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
        const source = layer.getSource();
        const found = source?.getFeatureById(id)
          ?? source?.getFeatures().find((candidate) => String(candidate.get('river_id') ?? '') === id);
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
