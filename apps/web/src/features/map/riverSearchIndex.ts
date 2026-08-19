/** 하천 검색 색인. `scripts/build_river_search_index.py` 산출물을 읽어 이름으로 찾는다.
 *
 *  형상 GeoJSON 은 시군구당 최대 3.6 MB 라 검색 때마다 받을 수 없다. 이름과 찾아갈 좌표만 담은
 *  색인을 **검색을 처음 열 때 한 번** 받고 그 뒤로는 브라우저 캐시에 맡긴다.
 *  전국 23,540건이라 원본은 5.9 MB 지만 gzip 으로 523 KB 다.
 */

export interface RiverSearchEntry {
  name: string;
  /** 사람이 읽는 자료 구분('소하천구역' · '국가하천' · '지방하천'). */
  kind: string;
  /** 결과를 클릭했을 때 켜야 할 하천 소스 id. */
  source_id: string;
  /** 이 하천이 속한 시군구코드. 전국 하천(scope='nationwide')은 빈 문자열이다. */
  admin: string;
  /** region: 시군구에 속함 · nationwide: 여러 시군구에 걸쳐 지역에 배정하지 않음 */
  scope: 'region' | 'nationwide';
  /** nationwide 하천이 지나는 시군구코드 전부. 청계천이 전국에 14개라 이것 없이는 어느 것인지 고를 수 없다. */
  admins?: string[];
  /** 지도 피처 id. 좌표만 있고 피처가 없는 항목은 빈 문자열이다. */
  feature_id: string;
  /** 화면 이동 전용 좌표(경도, 위도). 없으면 지도로 이동할 수 없다. */
  nav: [number, number] | null;
  /** actual: 원자료 좌표 · extent: 형상 bbox 중심(자료값 아님) · none: 이동 불가 */
  nav_kind: 'actual' | 'extent' | 'none';
  detail: string;
  no_coordinate_reason?: string;
}

interface RiverSearchIndex {
  entries: RiverSearchEntry[];
}

import { dataUrl } from './dataUrl';

const INDEX_URL = '/reference/rivers/river_search_index.json';
let pending: Promise<RiverSearchEntry[]> | null = null;

export function loadRiverSearchIndex(): Promise<RiverSearchEntry[]> {
  if (!pending) {
    pending = fetch(dataUrl(INDEX_URL), { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<RiverSearchIndex>;
      })
      .then((payload) => payload.entries ?? [])
      .catch((error) => {
        // 다음 검색에서 다시 시도할 수 있게 실패한 약속은 버린다.
        pending = null;
        throw error;
      });
  }
  return pending;
}

/** 이 항목이 그 시군구의 것인가. 소하천은 admin, 국가·지방하천은 지나는 시군구(admins)로 본다. */
export function entryInRegion(entry: RiverSearchEntry, admin: string): boolean {
  if (!admin) return true;
  if (entry.admin === admin) return true;
  return Boolean(entry.admins?.includes(admin));
}

/** 이름 부분일치. 고른 시군구로 **거른다.** 같은 이름의 하천이 전국에 흔해서(청계천 14개) 정렬만으로는
 *  어느 것인지 고를 수 없다 — 종로구에서 청계천을 찾았는데 의왕·남원 청계천이 함께 나오면 오류로 읽힌다.
 *  거른 밖에 몇 건이 더 있는지(`elsewhere`)를 함께 돌려주어 화면이 "다른 지역에 N건" 을 말하고
 *  전국 검색으로 넘어갈 수 있게 한다. nationwide=true 면 거르지 않고 현재 지역을 앞세운다.
 *  전국이 23,540건이라 상한(limit)을 넘으면 잘리는데, 그 사실을 화면이 말하도록 총 건수도 준다. */
export function searchRivers(
  entries: RiverSearchEntry[], query: string, admin: string, limit = 40, nationwide = false,
): { items: RiverSearchEntry[]; total: number; elsewhere: number } {
  const needle = query.trim();
  if (!needle) return { items: [], total: 0, elsewhere: 0 };
  const byName = entries.filter((entry) => entry.name.includes(needle));
  const inRegion = byName.filter((entry) => entryInRegion(entry, admin));
  const pool = nationwide || !admin ? byName : inRegion;
  const rank = (entry: RiverSearchEntry) =>
    (entryInRegion(entry, admin) ? 0 : entry.scope === 'nationwide' ? 1 : 2);
  const sorted = [...pool].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank) return byRank;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name, 'ko-KR');
  });
  return { items: sorted.slice(0, limit), total: sorted.length, elsewhere: byName.length - inRegion.length };
}
