import { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { createVWorldMap, type BaseMapType, type MapConnectionState, type VWorldMapHandle } from './VWorldMapAdapter';

interface Props { adminCode: string; highlightedFeatureId?: string | null; initialVisible?: Partial<Record<string, boolean>>; compact?: boolean; }
const core = [
  { name: '하천', code: 'L2' },
  { name: '위험지구', code: 'L1' },
  { name: '행정경계', code: 'L3' },
  { name: '침수흔적', code: 'L-FLOOD-TRACE' },
  { name: '홍수위험지역 (Mock)', code: 'L-FLOOD-RISK-AREA' },
  { name: '위험저수지 (Mock)', code: 'L-DANGEROUS-RESERVOIR' },
  { name: '풍수해개선지구 (Mock)', code: 'L-STORM-FLOOD-IMPROVEMENT' },
];

export function MapPanel({ adminCode, highlightedFeatureId, initialVisible, compact = false }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<VWorldMapHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [highlightNotice, setHighlightNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<{ state: MapConnectionState; message: string }>({ state: 'connecting', message: '지도 초기화 중' });
  const [baseMap, setBaseMap] = useState<BaseMapType>('base');
  const [visible, setVisible] = useState<Record<string, boolean>>({ L1: true, L2: true, L3: true, 'L-FLOOD-TRACE': false, 'L-FLOOD-RISK-AREA': false, 'L-DANGEROUS-RESERVOIR': false, 'L-STORM-FLOOD-IMPROVEMENT': false, ...initialVisible });

  useEffect(() => {
    if (!ref.current) return;
    let active = true;
    createVWorldMap(ref.current, adminCode, (state, message) => active && setStatus({ state, message }))
      .then((handle) => {
        if (!active) { handle.destroy(); return; }
        mapRef.current = handle;
        setMapReady(true);
      })
      .catch((mapError: unknown) => setError(mapError instanceof Error ? mapError.message : '지도 초기화 실패'));
    return () => { active = false; mapRef.current?.destroy(); mapRef.current = null; };
  }, []);

  useEffect(() => mapRef.current?.setRegion(adminCode), [adminCode]);
  useEffect(() => {
    if (!highlightedFeatureId) { setHighlightNotice(null); return; }
    if (!mapReady || !mapRef.current) return;
    // 지도 Action은 존재하는 GeoJSON ID만 실행: 없는 ID는 비차단 안내로 처리하고 흐름을 유지한다.
    if (mapRef.current.highlightFeature(highlightedFeatureId)) setHighlightNotice(null);
    else setHighlightNotice(`'${highlightedFeatureId}' 위치는 현재 지도 공간자료에 없어 지도 이동을 건너뛰었습니다. 목록 정보는 계속 확인할 수 있습니다.`);
  }, [highlightedFeatureId, mapReady]);

  function toggle(code: string) {
    const next = !visible[code];
    setVisible((current) => ({ ...current, [code]: next }));
    mapRef.current?.setLayerVisible(code, next);
  }
  function changeBaseMap(type: BaseMapType) {
    setBaseMap(type);
    mapRef.current?.setBaseMap(type);
  }

  return (
    <section className={`map-panel ${compact ? 'compact' : ''}`} aria-labelledby="map-title" aria-describedby="map-accessible-summary">
      <h2 id="map-title" className="sr-only">VWorld 지도와 공간정보</h2>
      <p id="map-accessible-summary" className="sr-only">지도와 같은 우선 확인지역 정보는 오른쪽 현재 판단 목록에서도 확인하고 지도에서 보기 버튼으로 이동할 수 있습니다.</p>
      <div ref={ref} className="map-canvas" aria-hidden="true" />
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
