/** 하천 검색 색인. `scripts/build_river_search_index.py` 산출물을 읽어 이름으로 찾는다.
 *
 *  형상 GeoJSON 은 지역당 최대 3.5 MB 라 검색 때마다 받을 수 없다. 이름과 찾아갈 좌표만 담은
 *  색인(약 420 KB)을 **검색을 처음 열 때 한 번** 받고 그 뒤로는 브라우저 캐시에 맡긴다.
 */

export interface RiverSearchEntry {
  name: string;
  /** 사람이 읽는 자료 구분('소하천구역', '하천표준데이터 시점', '국가기본도 하천' 등). */
  kind: string;
  /** 결과를 클릭했을 때 켜야 할 하천 소스 id. */
  source_id: string;
  admin: string;
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

/** 이름 부분일치. 현재 지역을 먼저, 그다음 이름이 짧은(= 질의에 가까운) 순으로 돌려준다.
 *  다른 지역 결과를 지우지 않는다 — 지역을 잘못 고른 채로 찾는 경우가 실제로 흔하다. */
export function searchRivers(entries: RiverSearchEntry[], query: string, admin: string, limit = 40): RiverSearchEntry[] {
  const needle = query.trim();
  if (!needle) return [];
  const matched = entries.filter((entry) => entry.name.includes(needle));
  matched.sort((a, b) => {
    if ((a.admin === admin) !== (b.admin === admin)) return a.admin === admin ? -1 : 1;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name, 'ko-KR');
  });
  return matched.slice(0, limit);
}
