import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import 'ol/ol.css';
import { createVWorldMap, type BaseMapType, type MapConnectionState, type MapFeatureSelection, type VWorldMapHandle } from './VWorldMapAdapter';
import { loadPlanReference } from '../../services/apiClient';
// 위험지구 상세 렌더·표기 규칙은 '현재 판단' 상세보기 모달과 공용 컴포넌트를 재사용한다.
import { DistrictDetailSections, FactList, MISSING, districtFactRows, evidenceText, orMissing, str, type Fact } from '../../components/DistrictDetail';
import type { DistrictReference, PlanReference, ReferenceEvidence, RiverReference } from '../../types/planReference';
import type { AgentContextItem } from '../../types/uiContext';

interface Props {
  adminCode: string;
  highlightedFeatureId?: string | null;
  initialVisible?: Partial<Record<string, boolean>>;
  compact?: boolean;
  /** 팝업의 '질의에 참조 추가' 배선용. 미연결이어도 동작이 깨지지 않도록 optional 이다. */
  onSelectFeature?(item: AgentContextItem): void;
}
const core = [
  { name: '하천', code: 'L2' },
  { name: '위험지구', code: 'L1' },
  { name: '행정경계', code: 'L3' },
  { name: '침수흔적', code: 'L-FLOOD-TRACE' },
  { name: '홍수위험지역 (Mock)', code: 'L-FLOOD-RISK-AREA' },
  { name: '위험저수지 (Mock)', code: 'L-DANGEROUS-RESERVOIR' },
  { name: '풍수해개선지구 (Mock)', code: 'L-STORM-FLOOD-IMPROVEMENT' },
];
const LAYER_LABEL: Record<string, string> = {
  L1: '위험지구', L2: '하천', L3: '행정경계',
  FLOOD_TRACE: '침수흔적', 'L-FLOOD-TRACE': '침수흔적',
  'L-FLOOD-RISK-AREA': '홍수위험지역 (Mock)', 'L-DANGEROUS-RESERVOIR': '위험저수지 (Mock)', 'L-STORM-FLOOD-IMPROVEMENT': '풍수해개선지구 (Mock)',
};
const POPUP_GAP = 14;
/** 말풍선 배치: 앵커 위(above)·아래(below)·옆(side, 꼬리 없음). */
type PopupPlace = 'above' | 'below' | 'side';

const list = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => str(item)).filter((item): item is string => Boolean(item)) : []);
function sourceEvidence(properties: Record<string, unknown>): ReferenceEvidence | null {
  const source = properties.source;
  if (source && typeof source === 'object') return source as ReferenceEvidence;
  return null;
}

/** 레이어별 공통·부가 표기. 없는 항목은 '미확보'로 두고 있는 것처럼 채우지 않는다. */
function facts(selection: MapFeatureSelection, district: DistrictReference | null, river: RiverReference | null): Fact[] {
  const properties = selection.properties;
  const rows: Fact[] = [{ label: '레이어', value: LAYER_LABEL[selection.layerId] ?? selection.layerId ?? MISSING }];
  if (selection.layerId === 'L1') {
    rows.push(...districtFactRows(district, properties));
  } else if (selection.layerId === 'L2') {
    rows.push({ label: '하천등급', value: orMissing(river?.grade ?? properties.grade) });
    rows.push({ label: '유역면적', value: river?.basin_area_km2 ? `${river.basin_area_km2} km²` : MISSING });
    rows.push({ label: '연장', value: river?.length_km ? `${river.length_km} km` : MISSING });
    rows.push({ label: '계획빈도', value: orMissing(river?.design_frequency_yr) });
    rows.push({ label: '시점', value: orMissing(river?.start_point) });
    rows.push({ label: '종점', value: orMissing(river?.end_point) });
    rows.push({ label: '계획명', value: orMissing(river?.plan_name ?? (properties.source as Record<string, unknown> | undefined)?.plan_name) });
  } else if (selection.layerId === 'L3') {
    rows.push({ label: '행정코드', value: orMissing(properties.admin_code) });
    rows.push({ label: '경계자료', value: orMissing(properties.source) });
  } else if (selection.layerId === 'L-FLOOD-TRACE' || selection.layerId === 'FLOOD_TRACE') {
    rows.push({ label: '발생일', value: orMissing(properties.occurred_at) });
    rows.push({ label: '연계 사건', value: orMissing(properties.event_id) });
    rows.push({ label: '자료상태', value: orMissing(properties.data_status) });
  } else if (selection.layerId === 'L-FLOOD-RISK-AREA') {
    rows.push({ label: '표기 등급', value: orMissing(properties.risk_grade) });
    rows.push({ label: '관련 하천', value: orMissing(properties.river_name) });
    rows.push({ label: '작성근거', value: orMissing(properties.basis) });
    rows.push({ label: '기준일', value: orMissing(properties.reference_date) });
  } else if (selection.layerId === 'L-DANGEROUS-RESERVOIR') {
    rows.push({ label: '시설유형', value: orMissing(properties.facility_type) });
    rows.push({ label: '표기 등급', value: orMissing(properties.risk_grade) });
    rows.push({ label: '관리기관', value: orMissing(properties.management_org) });
    rows.push({ label: '최근 점검', value: orMissing(properties.last_inspected_at) });
  } else if (selection.layerId === 'L-STORM-FLOOD-IMPROVEMENT') {
    rows.push({ label: '사업상태', value: orMissing(properties.project_status) });
    rows.push({ label: '사업기간', value: orMissing(properties.project_period) });
    rows.push({ label: '대책요약', value: orMissing(properties.mitigation_summary) });
  } else {
    rows.push({ label: '위치', value: orMissing(properties.location ?? properties.admin_name) });
  }
  rows.push({ label: '행정구역', value: orMissing(district?.admin_name ?? river?.admin_name ?? properties.admin_name ?? properties.admin_code) });
  rows.push({ label: '좌표(위도, 경도)', value: `${selection.lonLat[1].toFixed(5)}, ${selection.lonLat[0].toFixed(5)}` });
  return rows;
}

export function MapPanel({ adminCode, highlightedFeatureId, initialVisible, compact = false, onSelectFeature }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<VWorldMapHandle | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const referenceCache = useRef<Map<string, Promise<PlanReference>>>(new Map());
  const focusedRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [highlightNotice, setHighlightNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<{ state: MapConnectionState; message: string }>({ state: 'connecting', message: '지도 초기화 중' });
  const [baseMap, setBaseMap] = useState<BaseMapType>('base');
  const [selection, setSelection] = useState<MapFeatureSelection | null>(null);
  const [anchorPixel, setAnchorPixel] = useState<[number, number] | null>(null);
  const [placement, setPlacement] = useState<{ left: number; top: number; tail: number; mode: PopupPlace } | null>(null);
  const [detail, setDetail] = useState<{ district: DistrictReference | null; river: RiverReference | null }>({ district: null, river: null });
  const [visible, setVisible] = useState<Record<string, boolean>>({ L1: true, L2: true, L3: true, 'L-FLOOD-TRACE': false, 'L-FLOOD-RISK-AREA': false, 'L-DANGEROUS-RESERVOIR': false, 'L-STORM-FLOOD-IMPROVEMENT': false, ...initialVisible });

  const closePopup = useCallback(() => {
    setSelection(null);
    setAnchorPixel(null);
    setPlacement(null);
    mapRef.current?.setPopupAnchor(null);
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    let active = true;
    createVWorldMap(ref.current, adminCode, (state, message) => active && setStatus({ state, message }))
      .then((handle) => {
        if (!active) { handle.destroy(); return; }
        mapRef.current = handle;
        handle.onFeatureClick((hit) => {
          if (!active) return;
          setSelection(hit);
          setDetail({ district: null, river: null });
          if (!hit) { setAnchorPixel(null); setPlacement(null); }
        });
        handle.onPopupAnchorMove((pixel) => { if (active) setAnchorPixel(pixel); });
        setMapReady(true);
      })
      .catch((mapError: unknown) => setError(mapError instanceof Error ? mapError.message : '지도 초기화 실패'));
    return () => { active = false; mapRef.current?.destroy(); mapRef.current = null; };
  }, []);

  useEffect(() => { mapRef.current?.setRegion(adminCode); closePopup(); }, [adminCode, closePopup]);
  useEffect(() => {
    if (!highlightedFeatureId) { setHighlightNotice(null); return; }
    if (!mapReady || !mapRef.current) return;
    // 지도 Action은 존재하는 GeoJSON ID만 실행: 없는 ID는 비차단 안내로 처리하고 흐름을 유지한다.
    if (mapRef.current.highlightFeature(highlightedFeatureId)) setHighlightNotice(null);
    else setHighlightNotice(`'${highlightedFeatureId}' 위치는 현재 지도 공간자료에 없어 지도 이동을 건너뛰었습니다. 목록 정보는 계속 확인할 수 있습니다.`);
  }, [highlightedFeatureId, mapReady]);

  // 위험지구·하천은 계획문서 판독 참고자료(districts/rivers)를 붙여 상세 요약까지 표시한다. 결측은 정상이며 조용히 1차 요약만 남긴다.
  useEffect(() => {
    if (!selection || (selection.layerId !== 'L1' && selection.layerId !== 'L2')) return;
    const code = str(selection.properties.admin_code) ?? adminCode;
    let alive = true;
    let pending = referenceCache.current.get(code);
    if (!pending) { pending = loadPlanReference(code); referenceCache.current.set(code, pending); }
    pending
      .then((reference) => {
        if (!alive) return;
        setDetail({
          district: reference.districts.find((row) => row.district_code === selection.id) ?? null,
          river: reference.rivers.find((row) => row.river_id === selection.id) ?? null,
        });
      })
      .catch(() => { referenceCache.current.delete(code); if (alive) setDetail({ district: null, river: null }); });
    return () => { alive = false; };
  }, [selection, adminCode]);

  // 팝업이 지도 밖으로 잘리거나 클릭한 POI를 가리지 않도록 위→아래→옆 순으로 배치를 결정한다.
  useLayoutEffect(() => {
    const host = ref.current;
    const element = popupRef.current;
    if (!selection || !anchorPixel || !host || !element) { setPlacement(null); return; }
    const [anchorX, anchorY] = anchorPixel;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const hostWidth = host.clientWidth;
    const hostHeight = host.clientHeight;
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
    let mode: PopupPlace = 'above';
    let top = anchorY - height - POPUP_GAP;
    if (top < 8) {
      const below = anchorY + POPUP_GAP;
      if (below + height <= hostHeight - 8) { top = below; mode = 'below'; }
      else { mode = 'side'; top = clamp(anchorY - height / 2, 8, hostHeight - 8 - height); }
    }
    const left = mode === 'side'
      ? clamp(anchorX < hostWidth / 2 ? anchorX + POPUP_GAP : anchorX - width - POPUP_GAP, 8, hostWidth - width - 8)
      : clamp(anchorX - width / 2, 8, hostWidth - width - 8);
    setPlacement({ left: Math.round(left), top: Math.round(top), tail: Math.round(clamp(anchorX - left, 18, width - 18)), mode });
  }, [selection, anchorPixel, detail]);

  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closePopup(); };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popupRef.current?.contains(target)) return;
      if (ref.current?.contains(target)) return; // 지도 안쪽 클릭은 어댑터 singleclick 이 처리
      closePopup();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('mousedown', onPointerDown); };
  }, [selection, closePopup]);

  // 팝업이 배치된 뒤 한 번만 초점을 옮겨 Esc·닫기·읽기 순서를 보장한다.
  useEffect(() => {
    if (!selection) { focusedRef.current = null; return; }
    if (!placement || focusedRef.current === selection.id) return;
    focusedRef.current = selection.id;
    popupRef.current?.focus({ preventScroll: true });
  }, [selection, placement]);

  function toggle(code: string) {
    const next = !visible[code];
    setVisible((current) => ({ ...current, [code]: next }));
    mapRef.current?.setLayerVisible(code, next);
    if (selection && !next && selection.layerId === code) closePopup();
  }
  function changeBaseMap(type: BaseMapType) {
    setBaseMap(type);
    mapRef.current?.setBaseMap(type);
  }

  const district = detail.district;
  const river = detail.river;
  const title = selection ? (str(district?.district_name ?? river?.name ?? selection.properties.name) ?? selection.id ?? '선택 지점') : '';
  const badge = selection ? (str(district?.disaster_type ?? selection.properties.disaster_type ?? selection.properties.grade) ?? LAYER_LABEL[selection.layerId] ?? '참고정보') : '';
  const badges = selection ? list(selection.properties.display_badges) : [];
  const evidence = evidenceText(district?.evidence ?? river?.profile_evidence ?? (selection ? sourceEvidence(selection.properties) : null));
  const contextItem: AgentContextItem | null = selection && (selection.layerId === 'L1' || selection.layerId === 'L2')
    ? { kind: selection.layerId === 'L1' ? 'district' : 'river', id: selection.id, label: title, detail: str(district?.disaster_type ?? selection.properties.disaster_type ?? river?.grade ?? selection.properties.grade) ?? undefined, admin_code: str(selection.properties.admin_code) ?? adminCode }
    : null;
  const popupStyle: CSSProperties & Record<string, string | number> = {
    position: 'absolute',
    zIndex: 5,
    left: placement ? placement.left : 0,
    top: placement ? placement.top : 0,
    maxWidth: Math.max(240, (ref.current?.clientWidth ?? 480) - 16),
    maxHeight: Math.max(180, (ref.current?.clientHeight ?? 420) - 16),
    overflowY: 'auto',
    visibility: placement ? 'visible' : 'hidden',
    '--map-popup-tail-x': `${placement?.tail ?? 20}px`,
  };

  return (
    <section className={`map-panel ${compact ? 'compact' : ''}`} aria-labelledby="map-title" aria-describedby="map-accessible-summary">
      <h2 id="map-title" className="sr-only">VWorld 지도와 공간정보</h2>
      <p id="map-accessible-summary" className="sr-only">지도와 같은 우선 확인지역 정보는 오른쪽 현재 판단 목록에서도 확인할 수 있고, 목록 카드의 지역명 버튼으로 해당 지점으로 이동하며 상세보기 버튼으로 같은 상세 정보를 창으로 열 수 있습니다. 지도 위 표시를 클릭해도 요약 정보 창이 열립니다.</p>
      <div ref={ref} className="map-canvas" aria-hidden="true" />
      {selection ? (
        <div
          ref={popupRef}
          className={`map-feature-popup place-${placement?.mode ?? 'above'} ${selection.layerId === 'L1' ? 'district' : ''}`}
          style={popupStyle}
          role="dialog"
          aria-labelledby="map-popup-title"
          tabIndex={-1}
        >
          <header className="map-popup-head">
            <h3 id="map-popup-title">{title}</h3>
            <span className="map-popup-badge">{badge}</span>
            <button type="button" className="map-popup-close" aria-label="지도 정보 창 닫기" onClick={closePopup}>✕</button>
          </header>
          <div className="map-popup-body">
            {badges.length ? <p className="map-popup-flags">{badges.map((item) => <span key={item} className="map-popup-flag">{item}</span>)}</p> : null}
            <FactList rows={facts(selection, district, river)} />
            {district ? <DistrictDetailSections district={district} /> : null}
            {river?.warning_reference_station ? (
              <section className="map-popup-section">
                <h4>계획서 기준지점</h4>
                <p>{[str(river.warning_reference_station.name), str(river.warning_reference_station.station_no), str(river.warning_reference_station.note)].filter(Boolean).join(' · ') || MISSING}</p>
              </section>
            ) : null}
            {str(selection.properties.source_note) ? <p className="map-popup-source">비고 · {String(selection.properties.source_note)}</p> : null}
            <section className="map-popup-section">
              <h4>근거</h4>
              <p className="map-popup-source">{evidence ?? MISSING}</p>
            </section>
          </div>
          <footer className="map-popup-foot">
            {contextItem && onSelectFeature ? (
              <button type="button" className="map-popup-action" onClick={() => onSelectFeature(contextItem)}>질의에 참조 추가</button>
            ) : null}
            <p className="map-popup-disclaimer">본 요약은 관리대장·계획문서 판독 및 Mock/Seed 기반 참고 정보이며, 공식 위험등급 판정이나 피해예측이 아닙니다.</p>
          </footer>
          <span className="map-popup-tail" aria-hidden="true" />
        </div>
      ) : null}
      <div className={`map-connection ${status.state}`} role="status"><span className="status-dot" aria-hidden="true" />{status.message}</div>
      {error ? <div className="map-error" role="alert">{error}</div> : null}
      {highlightNotice ? <div className="map-highlight-notice" role="status" aria-live="polite">{highlightNotice}</div> : null}
      <div className="map-basemap-switch" role="group" aria-label="배경지도 선택">
        <button type="button" aria-pressed={baseMap === 'base'} onClick={() => changeBaseMap('base')}>일반지도</button>
        <button type="button" aria-pressed={baseMap === 'satellite'} onClick={() => changeBaseMap('satellite')}>영상지도</button>
      </div>
      <div className="map-layer-chips" role="group" aria-label="지도 레이어 표시 설정">
        {core.map((item) => <button key={item.code} type="button" className={`chip ${visible[item.code] ? 'active' : ''}`} aria-pressed={visible[item.code]} onClick={() => toggle(item.code)}>{item.name}</button>)}
        {['관측소', '피해위치', '대피소'].map((name) => <button key={name} type="button" className="chip" disabled title="후속 Provider 연결 대상">{name}</button>)}
      </div>
    </section>
  );
}
