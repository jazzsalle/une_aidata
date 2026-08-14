/** 지도에서 볼 수 있는 대상지역 6곳.
 *
 *  이 목록은 **지도 전용**이다. 앱 전체의 지역(대시보드 `adminCode`)은 위험지구·우선 확인지역
 *  시드가 있는 3곳(의왕·구미·남원)뿐이고, 그 계약은 건드리지 않는다. 부산·인제·영천은 하천
 *  공간자료만 있고 위험지구 시드가 없으므로, 앱 지역 선택기를 늘리는 대신 지도 안에서만 이동한다.
 *  그렇게 하지 않으면 그 3곳에서는 '현재 판단' 목록이 통째로 빈 화면이 된다.
 *
 *  `scripts/river_regions.py` 와 같은 표를 프런트에서 이행한다. 지역을 늘릴 때 두 곳을 함께 고친다.
 */

export interface MapRegion {
  /** 앱 행정코드. `/reference/rivers/*_{admin}.geojson` 파일명이 이 코드다. */
  admin: string;
  name: string;
  /** 짧은 이름. 폭이 좁은 지역 선택기에 쓴다. */
  short: string;
  /** 지도 초기 중심(경도, 위도). */
  center: [number, number];
  /** 이 지역에 위험지구·우선 확인지역 시드가 있는지. 없으면 지도 전용 지역이다. */
  hasPlanSeed: boolean;
  /** 행정코드가 원자료와 다른 경우의 실제 원자료 코드. 표기용이며 조회에 쓰지 않는다. */
  sourceNote?: string;
}

export const MAP_REGIONS: MapRegion[] = [
  { admin: '41430', name: '경기도 의왕시', short: '의왕', center: [126.968, 37.344], hasPlanSeed: true },
  { admin: '47190', name: '경상북도 구미시', short: '구미', center: [128.344, 36.119], hasPlanSeed: true },
  { admin: '45190', name: '전북특별자치도 남원시', short: '남원', center: [127.390, 35.416], hasPlanSeed: true, sourceNote: '공간자료 원본 코드 52190(전북특별자치도 출범 후 개편)' },
  { admin: '47230', name: '경상북도 영천시', short: '영천', center: [128.926, 36.000], hasPlanSeed: false },
  { admin: '51810', name: '강원특별자치도 인제군', short: '인제', center: [128.249, 38.038], hasPlanSeed: false },
  { admin: '26', name: '부산광역시', short: '부산', center: [129.127, 35.253], hasPlanSeed: false, sourceNote: '광역시 전체. 북구(26320)는 소하천 자료가 0건이라 구 단위로는 표시할 것이 없다.' },
];

export const mapRegionOf = (admin: string): MapRegion | undefined =>
  MAP_REGIONS.find((region) => region.admin === admin);

/** 앱 지역이 이 목록에 없을 때 지도가 처음 여는 지역. */
export const DEFAULT_MAP_REGION = '41430';
