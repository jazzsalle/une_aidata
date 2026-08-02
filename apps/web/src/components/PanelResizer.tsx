import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';

/** 좌측 패널 폭 저장 키 (기존 localStorage 관례: `une-disaster-*`) */
export const LEFT_PANEL_WIDTH_KEY = 'une-disaster-dashboard-left-width';

const MIN_WIDTH = 280;          // 좌측 패널 하한
const HARD_MAX_WIDTH = 760;     // 좌측 패널 절대 상한
const MAP_MIN_WIDTH = 420;      // .dashboard-grid 지도 컬럼 minmax() 하한
const RESIZER_WIDTH = 26;       // .panel-resizer 컬럼 폭
const GAP_RESERVE = 60;         // --sp-gap(최대 20px) × 3
const STEP = 16;                // 화살표 키·버튼 1회 조절량
const BIG_STEP = 64;            // Shift + 화살표 키 조절량
const SAVE_DELAY_MS = 120;

function rightPanelWidth(viewportWidth: number) {
  // .dashboard-grid 3번째 컬럼 clamp(350px, 23.5vw, 560px)와 동일한 계산
  return Math.min(560, Math.max(350, viewportWidth * 0.235));
}

/** 지도 컬럼이 하한(420px) 아래로 찌그러지지 않는 범위에서 좌측 패널 최대폭을 구한다. */
export function maxLeftPanelWidth(gridWidth: number, viewportWidth: number) {
  const room = gridWidth - rightPanelWidth(viewportWidth) - MAP_MIN_WIDTH - RESIZER_WIDTH - GAP_RESERVE;
  return Math.round(Math.max(MIN_WIDTH, Math.min(HARD_MAX_WIDTH, viewportWidth * 0.45, room)));
}

function readStoredWidth(): number | null {
  try {
    const raw = localStorage.getItem(LEFT_PANEL_WIDTH_KEY);
    if (!raw) return null;
    const value = Number(raw);
    // 범위를 벗어난 저장값은 무시하고 기본 폭(clamp)으로 폴백한다.
    if (!Number.isFinite(value) || value < MIN_WIDTH || value > HARD_MAX_WIDTH) return null;
    return Math.round(value);
  } catch {
    return null;
  }
}

let saveTimer: number | undefined;
function scheduleSave(value: number | null) {
  if (typeof window === 'undefined') return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      if (value === null) localStorage.removeItem(LEFT_PANEL_WIDTH_KEY);
      else localStorage.setItem(LEFT_PANEL_WIDTH_KEY, String(value));
    } catch {
      /* 저장 실패는 화면 동작을 막지 않는다. */
    }
  }, SAVE_DELAY_MS);
}

export interface LeftPanelControl {
  gridRef: RefObject<HTMLDivElement | null>;
  /** `--left-panel-w` 주입용 inline style (사용자 지정 폭이 없으면 비어 있음) */
  style: CSSProperties;
  /** 사용자가 지정한 폭. null이면 CSS 기본값 clamp(300px, 19vw, 460px)을 사용한다. */
  width: number | null;
  /** 실제 적용 중인 좌측 패널 폭(px) */
  current: number;
  min: number;
  max: number;
  apply(next: number): void;
  reset(): void;
}

export function useResizableLeftPanel(): LeftPanelControl {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number | null>(() => readStoredWidth());
  const [max, setMax] = useState(HARD_MAX_WIDTH);
  const [current, setCurrent] = useState(MIN_WIDTH);
  const maxRef = useRef(max);
  maxRef.current = max;

  // 기본 clamp 폭일 때도 현재 폭을 알 수 있도록 실제 DOM 폭을 읽는다.
  // 3열이 아닌 구간(≤1280px)에서는 구분자가 숨겨지고 폭 변수도 쓰이지 않으므로
  // 마지막 3열 상태값을 그대로 유지한다. (창을 좁혔다 넓혀도 사용자 설정이 남는다)
  const sync = useCallback(() => {
    const grid = gridRef.current;
    if (!grid || !window.matchMedia('(min-width: 1281px)').matches) return;
    setMax(maxLeftPanelWidth(grid.clientWidth, window.innerWidth));
    const panel = grid.querySelector<HTMLElement>('.left-panel');
    if (panel) setCurrent(Math.round(panel.getBoundingClientRect().width));
  }, []);

  useLayoutEffect(() => { sync(); }, [sync, width]);
  useEffect(() => {
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [sync]);

  const apply = useCallback((next: number) => {
    const value = Math.round(Math.min(Math.max(next, MIN_WIDTH), maxRef.current));
    setWidth(value);
    scheduleSave(value);
  }, []);

  const reset = useCallback(() => {
    setWidth(null);
    scheduleSave(null);
  }, []);

  // 창 크기 축소로 허용 최대폭이 줄면 현재 폭을 함께 줄인다.
  useEffect(() => { if (width !== null && width > max) apply(max); }, [apply, max, width]);

  const style = useMemo<CSSProperties>(
    () => (width === null ? {} : ({ '--left-panel-w': `${width}px` } as CSSProperties)),
    [width],
  );

  return { gridRef, style, width, current, min: MIN_WIDTH, max, apply, reset };
}

/**
 * 좌측 패널과 지도 사이 구분자.
 * 드래그(Pointer) 외에 좁히기·넓히기·기본값 버튼과 키보드 조작을 함께 제공한다.
 * (WCAG 2.2 SC 2.5.7 드래그 동작 대체수단 / SC 2.1.1 키보드)
 */
export function PanelResizer({ control }: { control: LeftPanelControl }) {
  const { current, min, max } = control;
  const [dragging, setDragging] = useState(false);
  // 첫 pointermove가 리렌더보다 먼저 도착해도 동작하도록 드래그 상태는 ref로 판단한다.
  const dragRef = useRef({ active: false, startX: 0, startWidth: 0 });
  const valueNow = Math.min(Math.max(current, min), max);

  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add('panel-resizing');
    return () => document.body.classList.remove('panel-resizing');
  }, [dragging]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); // 텍스트 선택·지도 팬 시작을 막는다.
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { active: true, startX: event.clientX, startWidth: current };
    setDragging(true);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    control.apply(dragRef.current.startWidth + (event.clientX - dragRef.current.startX));
  }
  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  }
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? BIG_STEP : STEP;
    if (event.key === 'ArrowLeft') control.apply(current - step);
    else if (event.key === 'ArrowRight') control.apply(current + step);
    else if (event.key === 'Home') control.apply(min);
    else if (event.key === 'End') control.apply(max);
    else return;
    event.preventDefault();
  }

  return (
    <div className={`panel-resizer${dragging ? ' dragging' : ''}`}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="좌측 패널 폭 조절"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={valueNow}
        aria-valuetext={`좌측 패널 폭 ${valueNow}픽셀`}
        aria-describedby="panel-resizer-help"
        tabIndex={0}
        className="panel-resizer-handle"
        title={`좌측 패널 폭 ${valueNow}px · 좌우 드래그 또는 화살표 키로 조절`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => { dragRef.current.active = false; setDragging(false); }}
        onKeyDown={onKeyDown}
        onDoubleClick={control.reset}
      />
      <div className="panel-resizer-buttons" role="group" aria-label="좌측 패널 폭 조절 버튼">
        <button type="button" title="좌측 패널 좁히기" onClick={() => control.apply(current - STEP)}>
          <span aria-hidden="true">◀</span><span className="sr-only">좌측 패널 좁히기</span>
        </button>
        <button type="button" title="좌측 패널 넓히기" onClick={() => control.apply(current + STEP)}>
          <span aria-hidden="true">▶</span><span className="sr-only">좌측 패널 넓히기</span>
        </button>
        <button type="button" title="좌측 패널 폭 기본값으로 되돌리기" onClick={control.reset}>
          <span aria-hidden="true">↺</span><span className="sr-only">좌측 패널 폭 기본값으로 되돌리기</span>
        </button>
      </div>
      <p id="panel-resizer-help" className="sr-only">
        좌우 드래그, 좁히기·넓히기 버튼, 화살표 키로 좌측 패널 폭을 {min}픽셀에서 {max}픽셀까지 조절합니다.
        Shift와 함께 누르면 크게 조절하고 Home·End 키는 최소·최대 폭을 적용합니다.
        기본 폭으로 되돌리려면 기본값 되돌리기 버튼을 누르거나 구분자를 두 번 클릭합니다.
        조절한 폭은 이 브라우저에 저장되어 다음 방문에도 유지됩니다.
      </p>
    </div>
  );
}
