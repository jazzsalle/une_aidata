import { useEffect, useMemo, useRef } from 'react';
import type { CurrentSituation } from '../types/contracts';
import type { RouteDefinition } from '../hooks/useRoute';
import { routes } from '../hooks/useRoute';
import { type MapRegion, dataCodeOfApp, groupBySido } from '../features/map/mapRegions';
import { PageHeading } from './PageHeading';

interface Props {
  route: RouteDefinition;
  situations: CurrentSituation[];
  selected: CurrentSituation | null;
  /** 전국 시군구 목록. 아직 안 받아졌으면 빈 배열이고, 그때는 지역 선택기를 비활성으로 둔다. */
  regions: MapRegion[];
  /** 지도가 보고 있는 시군구코드. */
  mapRegion: string;
  onNavigate(path: string): void;
  onSelect(id: string): void;
  onSelectRegion(code: string): void;
  onSave(): void;
}

/** 헤더에는 4개 항목만 둔다: 브랜드(+h1) · 지역 Select · 전역 내비 · 상황뷰 저장.
 *
 *  기준시각·모드·재난유형은 `<main>` 최상단 컨텍스트 줄(`SituationContextRow`)로 옮겼다.
 *  헤더에 두면 `overflow:hidden` 이 값을 문자열 중간에서 잘라 "2026-08-02 14" 같은 틀린 시각을
 *  보여준다 — 값은 절대 부분 클리핑하지 않는다.
 *
 *  축소 예산(회귀 주의): 수축 경로는 브랜드 블록의 h1 말줄임 하나뿐이다.
 *  브랜드 블록만 `flex:1 1 auto; min-width:120px`, 나머지는 전부 `flex:0 0 auto`,
 *  빈 스페이서가 내비를 오른쪽으로 밀어붙인다. */
export function AppHeader({ route, situations, selected, regions, mapRegion, onNavigate, onSelect, onSelectRegion, onSave }: Props) {
  const headerRef = useRef<HTMLElement | null>(null);
  const sidoGroups = useMemo(() => groupBySido(regions), [regions]);
  // 이 시군구에 시드 상황이 있는가. 앱 지역코드(45190)와 자료 코드(52190)가 다른 곳이 있어
  // 상황의 admin_code 를 자료 코드로 바꿔 맞춘다.
  const situationsHere = useMemo(
    () => situations.filter((item) => dataCodeOfApp(item.admin_code) === mapRegion),
    [situations, mapRegion],
  );

  // sticky 기준값은 전부 --header-h 에서 파생하므로(F-14), 실측 높이만 여기서 갱신한다.
  // 셀렉터·문구는 건드리지 않는다.
  //
  // 되먹임 주의: 헤더 자신의 높이를 --header-h 로 지정하면 안 된다(높이→변수→높이 진동).
  // `.header-row` 는 리터럴 min-height 를 쓰고, 여기서는 그 결과만 읽어 내보낸다.
  // 1px 미만 변화는 무시해 반올림 잡음으로 리렌더가 반복되지 않게 한다.
  useEffect(() => {
    const element = headerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let last = 0;
    const apply = () => {
      // ≤900px 에서 헤더는 static 이고 CSS 가 --header-h 를 0 으로 둔다. 인라인 값은 그 규칙보다
      // 우선하므로, sticky 가 아닐 때는 아예 쓰지 않고 CSS 판단에 맡긴다.
      if (getComputedStyle(element).position !== 'sticky') {
        last = 0;
        document.documentElement.style.removeProperty('--header-h');
        return;
      }
      const height = Math.round(element.getBoundingClientRect().height);
      if (height <= 0 || height === last) return;
      last = height;
      document.documentElement.style.setProperty('--header-h', `${height}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--header-h');
    };
  }, []);

  return (
    <header className="site-header" ref={headerRef}>
      <a className="skip-link" href="#main-content">본문 바로가기</a>
      <div className="header-row">
        <div className="brand-block">
          <strong>재난안전 AI 대응지원</strong>
          <span className="brand-divider" aria-hidden="true" />
          <PageHeading title={route.title} />
        </div>
        {/* 지역과 상황을 나눠 둔다. 상황 시드는 3곳뿐인데 하천 공간자료는 전국 188개 시군구에
            있어서, 하나로 묶어 두면 시드가 없는 지역을 아예 고를 수 없다. 지역만 바꾸면 지도는
            그 시군구로 가고 판단 패널은 마지막 상황을 유지한다. */}
        <label className="context-select" htmlFor="region-select">
          <span>지역</span>
          <select
            id="region-select"
            value={mapRegion}
            disabled={!regions.length}
            onChange={(event) => onSelectRegion(event.target.value)}
          >
            {sidoGroups.map(([sido, list]) => (
              <optgroup key={sido} label={sido}>
                {list.map((item) => (
                  <option key={item.admin} value={item.admin}>
                    {item.sgg}{item.hasPlanSeed ? '' : ' (하천자료만)'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="context-select" htmlFor="situation-select">
          <span>상황</span>
          <select
            id="situation-select"
            value={selected?.situation_id ?? ''}
            onChange={(event) => onSelect(event.target.value)}
          >
            {situations.map((item) => (
              <option key={item.situation_id} value={item.situation_id}>{item.admin_name}</option>
            ))}
          </select>
        </label>
        {regions.length && !situationsHere.length ? (
          <span className="context-note" role="status">이 지역은 하천자료만</span>
        ) : null}
        <span className="header-spacer" aria-hidden="true" />
        <nav className="global-nav" aria-label="주요 메뉴">
          {routes.map((item) => (
            <a
              key={item.id}
              href={item.path}
              aria-current={route.id === item.id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.path);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <button type="button" className="secondary-action" onClick={onSave}>상황뷰 저장</button>
      </div>
    </header>
  );
}

/** `<main>` 최상단 컨텍스트 줄. 헤더에서 내린 기준시각·모드·재난유형을 항목 단위로 줄바꿈한다.
 *  공간이 부족하면 항목을 통째로 내리고, 값 문자열을 중간에서 자르지 않는다. */
export function SituationContextRow({ selected }: { selected: CurrentSituation | null }) {
  const modeText = selected?.mode === 'scenario' ? '시나리오' : selected?.mode === 'hybrid' ? '공공 API + 입력' : '실시간';
  return (
    <div className="page-context-row" aria-label="현재 상황 기준">
      <div className="page-context-item">
        <span>기준시각</span>
        <strong className="page-context-time">
          {selected ? new Date(selected.reference_time).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }) : '-'}
        </strong>
      </div>
      <div className="page-context-item">
        <span>모드</span>
        <strong className={`page-context-badge mode-${selected?.mode ?? 'unknown'}`}>{modeText}</strong>
      </div>
      <div className="page-context-item">
        <span>재난유형</span>
        <strong className="page-context-badge hazard">{selected?.hazards.join(' · ') ?? '-'}</strong>
      </div>
    </div>
  );
}
