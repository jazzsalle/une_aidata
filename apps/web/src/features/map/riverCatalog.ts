/** 국가·지방하천 목록. `scripts/build_river_network_catalog.py` 산출물을 읽는다.
 *
 *  형상은 담겨 있지 않다 — 하천마다 코드·이름·등급과 화면 이동용 좌표뿐이다.
 *  `label_point` 는 지도에 이름을 찍는 자리(폴리곤 내부점)이고, `nav`/`bbox` 는 화면 이동용이다.
 *  둘 다 파생값이라 화면에 위치값으로 표시하지 않는다.
 */

export interface NetworkRiver {
  river_code: string;
  river_name: string;
  /** '국가하천' | '지방하천' */
  river_class: string;
  bbox: [number, number, number, number];
  nav: [number, number];
  label_point: [number, number];
  /** 이 하천이 지나는 시군구코드. 하천을 자르지 않으므로 여러 개일 수 있다. */
  admin_codes?: string[];
}

interface Catalog {
  rivers?: NetworkRiver[];
}

const CATALOG_URL = '/reference/rivers/river_network_catalog.json';
let pending: Promise<NetworkRiver[]> | null = null;

/** 한 번만 받는다. 실패한 약속은 버려 다시 시도할 수 있게 한다. */
export function loadNetworkRivers(): Promise<NetworkRiver[]> {
  if (!pending) {
    pending = fetch(CATALOG_URL, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<Catalog>;
      })
      .then((payload) => payload.rivers ?? [])
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

/** 이 시군구를 지나는 하천만 고른다. 배정이 아직 없으면(구 카탈로그) 빈 목록을 준다. */
export const riversInRegion = (rivers: NetworkRiver[], admin: string): NetworkRiver[] =>
  rivers.filter((river) => river.admin_codes?.includes(admin));
