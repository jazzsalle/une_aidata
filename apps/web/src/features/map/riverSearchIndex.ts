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

const INDEX_URL = '/reference/rivers/river_search_index.json';
let pending: Promise<RiverSearchEntry[]> | null = null;

export function loadRiverSearchIndex(): Promise<RiverSearchEntry[]> {
  if (!pending) {
    pending = fetch(INDEX_URL, { cache: 'force-cache' })
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

/** 이름 부분일치. 현재 지역 → 전국 하천 → 나머지 순으로 돌려준다.
 *  다른 지역 결과를 지우지 않는다 — 지역을 잘못 고른 채로 찾는 경우가 실제로 흔하다.
 *  전국이 23,540건이라 상한(limit)을 넘으면 잘리는데, 그 사실을 화면이 말하도록 총 건수도 준다. */
export function searchRivers(
  entries: RiverSearchEntry[], query: string, admin: string, limit = 40,
): { items: RiverSearchEntry[]; total: number } {
  const needle = query.trim();
  if (!needle) return { items: [], total: 0 };
  const matched = entries.filter((entry) => entry.name.includes(needle));
  const rank = (entry: RiverSearchEntry) =>
    (entry.admin === admin ? 0 : entry.scope === 'nationwide' ? 1 : 2);
  matched.sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank) return byRank;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name, 'ko-KR');
  });
  return { items: matched.slice(0, limit), total: matched.length };
}
