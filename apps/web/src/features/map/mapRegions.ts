/** 지도에서 고를 수 있는 지역 목록. **전국 시군구**다.
 *
 *  목록은 `river_region_catalog.json`(전처리 산출물)에서 받는다 — 소하천구역 자료가 실제로 있는
 *  시군구만 담겨 있으므로, 고를 수는 있는데 지도에 아무것도 없는 항목이 생기지 않는다.
 *
 *  **앱 지역(대시보드 adminCode)과 지도 지역은 다르다.** 위험지구·우선 확인지역 시드가 있는 곳은
 *  의왕·구미·남원 3곳뿐이고 그 계약은 건드리지 않는다. 나머지 시군구는 지도 안에서만 이동하며,
 *  '이 지역은 하천 공간자료만 있습니다' 안내를 띄운다. 그렇게 하지 않으면 시드가 없는 지역에서
 *  '현재 판단' 목록이 통째로 빈 화면이 된다.
 */

export interface MapRegion {
  /** 지도 자료 파일명에 쓰는 코드. `/reference/rivers/*_{admin}.geojson` 의 그 코드다. */
  admin: string;
  /** '경기도 의왕시' 처럼 시도까지 붙인 이름. */
  name: string;
  sido: string;
  sgg: string;
  /** 짧은 이름. 폭이 좁은 자리에 쓴다. */
  short: string;
  /** 지도 초기 중심(경도, 위도). 형상 bbox 중심이라 자료가 가진 좌표가 아니다 — 화면 이동 전용. */
  center: [number, number];
  /** 위험지구·우선 확인지역 시드가 있는지. 없으면 지도 전용 지역이다. */
  hasPlanSeed: boolean;
  /** 앱 지역코드가 자료 코드와 다른 경우의 앱 코드(남원: 앱 45190 · 자료 52190). */
  appAdmin?: string;
}

/** 시드가 있어 대시보드 전체가 동작하는 지역. 자료 코드가 앱 코드와 다른 곳은 여기서 잇는다. */
const SEED_REGIONS: Record<string, { appAdmin: string; center: [number, number] }> = {
  // 기존 3곳은 `VWorldMapAdapter` 가 쓰던 중심좌표를 그대로 둔다 — 위험지구가 모여 있는 곳이라
  // 화면을 열었을 때 보여야 할 것이 보인다. bbox 중심으로 바꾸면 그 성질이 사라진다.
  '41430': { appAdmin: '41430', center: [126.968, 37.344] },
  '47190': { appAdmin: '47190', center: [128.344, 36.119] },
  // 남원은 2024년 전북특별자치도 출범 뒤 공간자료가 52190 을 쓴다. 앱 시드는 45190 그대로다.
  '52190': { appAdmin: '45190', center: [127.390, 35.416] },
};

/** 앱 지역코드 → 지도 자료 코드. 남원만 다르다. */
export const dataCodeOfApp = (appAdmin: string): string =>
  Object.entries(SEED_REGIONS).find(([, v]) => v.appAdmin === appAdmin)?.[0] ?? appAdmin;

/** 앱 지역이 목록에 없을 때 지도가 처음 여는 지역(의왕). */
export const DEFAULT_MAP_REGION = '41430';

interface CatalogRow {
  code: string;
  sido: string | null;
  sgg: string | null;
  sochun_count: number;
  center: [number, number] | null;
}

const CATALOG_URL = '/reference/rivers/river_region_catalog.json';
let pending: Promise<MapRegion[]> | null = null;

/** 지역 목록을 한 번만 받는다. 실패한 약속은 버려 다시 시도할 수 있게 한다. */
export function loadMapRegions(): Promise<MapRegion[]> {
  if (!pending) {
    pending = fetch(CATALOG_URL, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ regions: CatalogRow[] }>;
      })
      .then((payload) => (payload.regions ?? [])
        .filter((row) => row.sido && row.sgg && row.center)
        .map((row): MapRegion => {
          const seed = SEED_REGIONS[row.code];
          return {
            admin: row.code,
            sido: row.sido as string,
            sgg: row.sgg as string,
            name: `${row.sido} ${row.sgg}`,
            short: row.sgg as string,
            center: seed?.center ?? (row.center as [number, number]),
            hasPlanSeed: Boolean(seed),
            appAdmin: seed?.appAdmin,
          };
        })
        .sort((a, b) => a.sido.localeCompare(b.sido, 'ko-KR') || a.sgg.localeCompare(b.sgg, 'ko-KR')))
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

export const mapRegionIn = (regions: MapRegion[], admin: string): MapRegion | undefined =>
  regions.find((region) => region.admin === admin);

/** 시도 → 그 시도의 시군구. 2단 선택기에 쓴다. */
export function groupBySido(regions: MapRegion[]): Array<[string, MapRegion[]]> {
  const map = new Map<string, MapRegion[]>();
  for (const region of regions) {
    const list = map.get(region.sido);
    if (list) list.push(region);
    else map.set(region.sido, [region]);
  }
  return [...map.entries()];
}
