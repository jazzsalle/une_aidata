/** 하천 레이어 소스 카탈로그.
 *
 *  하천은 지금까지 `geo.json`의 L2 피처(오프라인 추출·재투영된 정적 시드) 하나로만 그렸다.
 *  그 결과 베이스맵과의 정합을 화면에서 확인할 방법이 없었고, 어긋나도 원인이
 *  '우리 재투영'인지 '원본 데이터셋'인지 구분할 수 없었다.
 *
 *  그래서 하천을 **의미별로 나눈 여러 소스**로 다루고 각각 on/off 한다.
 *
 *    channel    실폭(물길). 항공영상의 수면과 겹쳐야 정상이다.
 *    zone       법정 하천구역(제방·둔치 포함). 물길보다 넓으므로 영상과 안 겹치는 것이 정상이다.
 *    centerline 하천 중심선. 물길 한가운데를 지나야 정상이다.
 *
 *  `layer_catalog_seed.json`의 `L-RIVER`는 이미
 *  `provider: VWorldProvider / fallback: LocalGeoJsonProvider` 로 선언되어 있다.
 *  여기 카탈로그는 그 계약을 프런트에서 이행하는 것이고, Seed 계약을 새로 만들지 않는다.
 *
 *  소스를 추가할 때는 이 파일에 객체 하나를 더 넣는 것으로 끝나야 한다.
 *  URL·레이어명이 확정되지 않은 소스는 **빈 문자열로 두고 `unverified` 로 남긴다.**
 *  추정한 경로를 채워 넣으면 그 순간부터 그것이 확인된 사실처럼 읽힌다. */

export type RiverSemantic = 'channel' | 'zone' | 'centerline';
export type RiverSourceKind = 'wms' | 'geojson' | 'wfs';
/** active: 표시 대상 · legacy: 비교용으로만 남긴 기존 소스 · unverified: 경로/승인 미확정이라 켤 수 없음 */
export type RiverSourceStatus = 'active' | 'legacy' | 'unverified';

/** 벡터(geojson/wfs) 소스의 배색. WMS는 서버가 렌더하므로 이 값이 적용되지 않는다(투명도만 제어 가능). */
export interface RiverVectorStyle {
  color: string;
  satelliteColor: string;
  width: number;
  fill?: string;
  satelliteFill?: string;
  dash?: number[];
}

/** 정적 GeoJSON에서 특정 피처만 뽑아 쓰는 소스의 추출 규칙. */
export interface RiverGeoJsonPick {
  /** 어댑터가 이미 읽어 둔 컬렉션에서 고를 때 쓰는 속성명과 값. */
  property: string;
  value: string;
}

export interface RiverLayerSource {
  id: string;
  label: string;
  semantic: RiverSemantic;
  kind: RiverSourceKind;
  status: RiverSourceStatus;
  /** 자료를 만든 기관. 팝업의 출처 표기에 그대로 쓴다. */
  sourceOrg: string;
  /** WMS/WFS 엔드포인트. 미확정이면 빈 문자열. */
  url: string;
  /** 원격 레이어명. 미확정이면 빈 문자열. */
  layerName: string;
  /** WMS 1.3.0은 STYLES가 LAYERS와 1:1로 필요하다. 빈 문자열이면 기본 스타일. */
  styleName: string;
  /** 요청 좌표계. WMS 1.3.0의 EPSG:4326은 축 순서가 lat,lon이라 오정렬의 원인이 되므로 3857로 고정한다. */
  projection: 'EPSG:3857';
  /** VWorld 키(VITE_VWORLD_MAP_KEY)가 있어야 요청할 수 있는 소스인지. */
  requiresVWorldKey: boolean;
  defaultVisible: boolean;
  style: RiverVectorStyle;
  /** 원격 소스 실패 시, 또는 kind==='geojson'일 때 사용할 로컬 피처 추출 규칙. */
  geojson?: RiverGeoJsonPick;
  note: string;
}

/** 지도 레이어 id 접두사. L1/L2/L3 같은 기존 코드와 섞이지 않게 한다. */
export const RIVER_LAYER_PREFIX = 'RIVER:';
export const riverLayerId = (sourceId: string) => `${RIVER_LAYER_PREFIX}${sourceId}`;
export const isRiverLayerId = (layerId: string) => layerId.startsWith(RIVER_LAYER_PREFIX);
export const riverSourceIdOf = (layerId: string) => layerId.slice(RIVER_LAYER_PREFIX.length);

export const SEMANTIC_LABEL: Record<RiverSemantic, string> = {
  channel: '실폭(물길)',
  zone: '법정 하천구역',
  centerline: '중심선',
};

/** 각 의미가 베이스맵과 어떻게 보이는 것이 정상인지. 팝업·토글 설명에 쓴다 —
 *  '하천구역이 영상과 안 맞는다'는 오해를 화면에서 미리 막는다. */
export const SEMANTIC_ALIGNMENT_NOTE: Record<RiverSemantic, string> = {
  channel: '항공영상의 수면과 겹치는 것이 정상입니다.',
  zone: '제방·둔치를 포함하므로 항공영상의 물길보다 넓게 표시되는 것이 정상입니다.',
  centerline: '물길 한가운데를 지나는 것이 정상입니다.',
};

export const RIVER_LAYER_SOURCES: RiverLayerSource[] = [
  {
    id: 'vworld-wms-wkmstrm',
    label: '실폭하천 (VWorld 하천망)',
    semantic: 'channel',
    kind: 'wms',
    status: 'active',
    sourceOrg: '한강홍수통제소 / VWorld',
    url: 'https://api.vworld.kr/req/wms',
    layerName: 'lt_c_wkmstrm',
    // VWorld는 STYLES 미지정 시 예외를 반환하는 경우가 있어 레이어명과 같은 값을 1차로 보낸다.
    styleName: 'lt_c_wkmstrm',
    projection: 'EPSG:3857',
    requiresVWorldKey: true,
    defaultVisible: true,
    style: { color: '#1769aa', satelliteColor: '#00e5ff', width: 2.4, fill: 'rgba(23,105,170,.07)', satelliteFill: 'rgba(0,229,255,.24)' },
    // 원격 실패·키 부재 시 기존 정적 시드로 강등한다. seed-only 모드에서도 하천이 사라지지 않게 한다.
    geojson: { property: 'layer', value: 'L2' },
    note: 'VWorld가 서버에서 EPSG:3857로 직접 렌더하므로 클라이언트 재투영 단계가 없다. geo.json L2와 같은 원천(LT_C_WKMSTRM)이라 둘을 겹쳐 보면 우리 재투영의 오차가 그대로 드러난다.',
  },
  {
    id: 'seed-l2-legacy',
    label: '실폭하천 (기존 Seed · 비교용)',
    semantic: 'channel',
    kind: 'geojson',
    status: 'legacy',
    sourceOrg: 'geo.json L2 (VWorld LT_C_WKMSTRM 오프라인 추출)',
    url: '',
    layerName: '',
    styleName: '',
    projection: 'EPSG:3857',
    requiresVWorldKey: false,
    defaultVisible: false,
    // WMS와 구분되도록 점선 + 대비색으로 그린다. 겹쳤는지 아닌지가 한눈에 보여야 한다.
    style: { color: '#d81b60', satelliteColor: '#ff2d95', width: 2, fill: undefined, satelliteFill: undefined, dash: [6, 4] },
    geojson: { property: 'layer', value: 'L2' },
    note: '오프라인 재투영(좌표 소수점 14자리)을 거친 정적 시드. VWorld WMS와의 오프셋을 확인하기 위한 대조군이며, 정합 원인이 확정되면 제거한다.',
  },
  {
    id: 'vworld-wms-centerline',
    label: '하천 중심선 (VWorld)',
    semantic: 'centerline',
    kind: 'wms',
    status: 'unverified',
    sourceOrg: 'VWorld',
    url: 'https://api.vworld.kr/req/wms',
    // GetCapabilities로 실제 코드를 확인한 뒤 채운다. 추정한 레이어명을 넣지 않는다.
    layerName: '',
    styleName: '',
    projection: 'EPSG:3857',
    requiresVWorldKey: true,
    defaultVisible: false,
    style: { color: '#00838f', satelliteColor: '#18ffff', width: 2, dash: [10, 5] },
    note: 'VWorld WMS 가이드 문서에서 확인된 수자원 레이어는 하천망(lt_c_wkmstrm)과 대·중·표준권역 3종뿐이고 중심선은 목록에 없다. 키로 GetCapabilities를 호출해 전체 레이어 목록을 받은 뒤 수자원 분류에서 실제 코드를 확인해 layerName을 채우면 status를 active로 올린다.',
  },
  {
    id: 'river-zone',
    label: '법정 하천구역',
    semantic: 'zone',
    kind: 'wfs',
    status: 'unverified',
    sourceOrg: '미확정',
    url: '',
    layerName: '',
    styleName: '',
    projection: 'EPSG:3857',
    requiresVWorldKey: false,
    defaultVisible: false,
    style: { color: '#7b1fa2', satelliteColor: '#d18cff', width: 2.4, fill: 'rgba(123,31,162,.12)', satelliteFill: 'rgba(209,140,255,.2)', dash: [5, 4] },
    note: 'river.go.kr(RIMGIS)은 공개 REST 오픈API가 확인되지 않으며 성과품 SHP 신청·다운로드 형태로 보인다. 국가공간정보포털 WMS/WFS가 대안. 제공 형태 확정 전까지 비활성으로 둔다.',
  },
];

export const riverSourceById = (id: string): RiverLayerSource | undefined =>
  RIVER_LAYER_SOURCES.find((source) => source.id === id);

/** 화면에서 켤 수 있는 소스만. unverified는 비활성 칩으로만 노출한다. */
export const selectableRiverSources = (): RiverLayerSource[] =>
  RIVER_LAYER_SOURCES.filter((source) => source.status !== 'unverified');
