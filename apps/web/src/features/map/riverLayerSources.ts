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

export type RiverSemantic = 'channel' | 'zone' | 'sochun' | 'label';
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

/** 지자체별로 파일이 나뉜 소스의 URL 틀. `{admin}` 자리에 행정코드가 들어간다.
 *  전국 자료를 지자체 단위로 잘라 둔 것이라 지역을 바꾸면 다시 받아야 한다. */
export const RIVER_DATA_URL_TOKEN = '{admin}';
export const riverDataUrl = (template: string, adminCode: string) =>
  template.replace(RIVER_DATA_URL_TOKEN, adminCode);

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
  /** 지자체별 정적 GeoJSON 파일의 URL 틀. 있으면 지역이 바뀔 때마다 해당 파일을 받는다.
   *  파일이 크므로 **켤 때 처음 받는다**(초기 로드에 얹지 않는다). */
  dataUrlTemplate?: string;
  /** 레이어 메뉴의 좁은 상태 칸에 '무엇이 몇 건'인지 적을 때 쓰는 짧은 자료명. */
  datasetShort?: string;
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
  sochun: '소하천구역',
  label: '하천명',
};

/** 각 의미가 베이스맵과 어떻게 보이는 것이 정상인지. 팝업·토글 설명에 쓴다 —
 *  '하천구역이 영상과 안 맞는다'는 오해를 화면에서 미리 막는다. */
export const SEMANTIC_ALIGNMENT_NOTE: Record<RiverSemantic, string> = {
  channel: '항공영상의 수면과 겹치는 것이 정상입니다.',
  zone: '제방·둔치를 포함하므로 항공영상의 물길보다 넓게 표시되는 것이 정상입니다.',
  sochun: '소하천정비법상 고시된 소하천구역입니다. 국가·지방하천과 별개 자료이므로 국가기본도 하천과 겹치지 않는 것이 정상입니다.',
  label: '하천명 표기점. 하천 형상이 아니라 이름을 찍는 자리다',
};

// 2026-08-08: 기존 `seed-wkmstrm`(geo.json L2 = VWorld LT_C_WKMSTRM)을 목록에서 제거했다.
// 사유는 정합이다 — 영상지도 위 실측에서 그 형상은 일반화가 거칠고 남서로 밀려 물가선을
// 벗어났고, 같은 지점에서 국가기본도 실폭하천은 물가선을 그대로 따라갔다.
// 두 자료의 정점 거리는 요천 중앙값 11.7 m · 안양천 13.1 m 였다.
export const RIVER_LAYER_SOURCES: RiverLayerSource[] = [
  {
    id: 'vworld-wms-wkmstrm',
    label: '실폭하천 (VWorld WMS 직결)',
    semantic: 'channel',
    kind: 'wms',
    status: 'unverified',
    sourceOrg: '한강홍수통제소 / VWorld',
    url: 'https://api.vworld.kr/req/wms',
    layerName: 'lt_c_wkmstrm',
    styleName: 'lt_c_wkmstrm',
    projection: 'EPSG:3857',
    requiresVWorldKey: true,
    defaultVisible: false,
    style: { color: '#d81b60', satelliteColor: '#ff2d95', width: 2, dash: [6, 4] },
    geojson: { property: 'layer', value: 'L2' },
    // 서버 응답 자체는 정상(HTTP 200, image/png)이지만 브라우저에서는 쓸 수 없다.
    note: 'VWorld WMS 는 Access-Control-Allow-Origin 을 보내지 않아(WMTS 는 보낸다) OpenLayers 10 의 fetch 기반 이미지 로더에서 ORB 로 차단된다. 키·등록도메인 문제가 아니라 VWorld 서버 설정 문제다. 서버측 프록시를 두면 우회되지만, 렌더되는 형상이 seed-wkmstrm 과 동일하므로 정합 개선 효과는 없다. DOMAIN 은 등록 서비스 URL 이어야 하며 localhost 는 거절된다(VITE_VWORLD_SERVICE_DOMAIN 참고).',
  },
  {
    id: 'ngii-realwidth',
    label: '실폭하천 (국가기본도)',
    semantic: 'channel',
    kind: 'geojson',
    status: 'active',
    sourceOrg: '국토지리정보원 국가기본도 (TN_RIVER_BT)',
    url: '',
    layerName: '',
    styleName: '',
    projection: 'EPSG:3857',
    requiresVWorldKey: false,
    // 대표 하천 소스다. 칩 행의 `하천` 이 이 소스를 켜고 끈다.
    defaultVisible: true,
    style: { color: '#1769aa', satelliteColor: '#00e5ff', width: 2.2, fill: 'rgba(23,105,170,.10)', satelliteFill: 'rgba(0,229,255,.22)' },
    dataUrlTemplate: `/reference/rivers/TN_RIVER_BT_${RIVER_DATA_URL_TOKEN}.geojson`,
    datasetShort: '국가기본도',
    // 폭이 좁은 구간은 이 자료에 폴리곤으로 들어오지 않는다(중심선에만 있다).
    note: '국가기본도 실폭하천(폴리곤). 기존 seed-wkmstrm 과 겹쳐 보면 두 자료의 차이를 눈으로 확인할 수 있다. 실측 기준 두 자료의 정점 거리는 요천 중앙값 11.7 m · 안양천 13.1 m 로 벌어져 있다. 폭이 좁은 구간은 폴리곤이 없을 수 있다.',
  },
  {
    id: 'ngii-boundary',
    label: '하천경계 (국가기본도)',
    semantic: 'zone',
    kind: 'geojson',
    status: 'active',
    sourceOrg: '국토지리정보원 국가기본도 (TN_RIVER_BNDRY)',
    url: '',
    layerName: '',
    styleName: '',
    projection: 'EPSG:3857',
    requiresVWorldKey: false,
    defaultVisible: false,
    style: { color: '#7b1fa2', satelliteColor: '#d18cff', width: 2, fill: 'rgba(123,31,162,.08)', satelliteFill: 'rgba(209,140,255,.18)', dash: [5, 4] },
    dataUrlTemplate: `/reference/rivers/TN_RIVER_BNDRY_${RIVER_DATA_URL_TOKEN}.geojson`,
    datasetShort: '국가기본도',
    // river.go.kr 의 '법정 하천구역'과 같은 자료가 아니다. 국가기본도가 도시하는 하천경계다.
    note: '국가기본도 하천경계(폴리곤). 제방·둔치를 포함하므로 실폭보다 넓다. RIMGIS 의 법정 하천구역과는 다른 자료이므로 법정 경계로 인용하지 않는다.',
  },
  {
    id: 'river-network-label',
    label: '하천명 (국가·지방하천)',
    semantic: 'label',
    kind: 'geojson',
    status: 'active',
    sourceOrg: '국가수자원관리종합시스템 하천망도 (하천명·등급)',
    url: '',
    layerName: '',
    styleName: '',
    projection: 'EPSG:3857',
    requiresVWorldKey: false,
    defaultVisible: true,
    style: { color: '#0d47a1', satelliteColor: '#82b1ff', width: 1 },
    // 형상 파일이 아니라 카탈로그(JSON)를 읽는다. 좌표는 하천당 라벨점 1개다.
    dataUrlTemplate: '/reference/rivers/river_network_catalog.json',
    datasetShort: '하천명',
    note: '국가·지방하천 3,856건의 하천명. 형상이 아니라 하천마다 라벨점 1개이며, 그 점은 하천망도 폴리곤의 내부점을 전처리에서 계산한 파생값이다(label_point_kind=derived_interior). 소하천 이름은 소하천구역 레이어가 직접 그린다.',
  },
  {
    id: 'lsmd-sochun',
    label: '소하천구역',
    semantic: 'sochun',
    kind: 'geojson',
    status: 'active',
    sourceOrg: '국토교통부 소하천구역(연속주제) LSMD_CONT_UJ301',
    url: '',
    layerName: '',
    styleName: '',
    projection: 'EPSG:3857',
    requiresVWorldKey: false,
    defaultVisible: false,
    style: { color: '#2e7d32', satelliteColor: '#69f0ae', width: 1.8, fill: 'rgba(46,125,50,.12)', satelliteFill: 'rgba(105,240,174,.22)' },
    dataUrlTemplate: `/reference/rivers/LSMD_SOCHUN_${RIVER_DATA_URL_TOKEN}.geojson`,
    datasetShort: '소하천구역',
    // 하천명은 지자체마다 ALIAS/REMARK 중 어디에 들어 있는지가 다르다. 전처리가 읽어낸 것만 stream_name 으로 붙어 있고
    // 읽히지 않은 건에는 아예 없다 — 이름을 추정해 채우지 않았다.
    note: '소하천정비법상 고시 소하천구역(폴리곤). 원본 EPSG:5186 을 4326 으로 재투영하고 2 m 단순화했다. 대상 6개 지역 1,531건(의왕 110·구미 159·남원 454·영천 115·인제 643·부산 50). 하천명(stream_name)은 원문 ALIAS/REMARK 에서 읽힌 건에만 있다.',
  },
  {
    id: 'river-zone',
    label: '법정 하천구역 (RIMGIS)',
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
