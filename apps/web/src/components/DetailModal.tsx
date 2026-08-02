// 접근 가능한 상세 팝업(모달). 열 때 초점 이동, Esc·닫기 버튼·배경 클릭 닫기, 초점 가둠을 제공하고
// 닫힌 뒤 원래 트리거로의 초점 복귀는 호출부(onClose)가 담당한다.
// 지도 팝업과 같은 시각언어를 쓰도록 `map-popup-*` 클래스를 그대로 재사용한다.
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface Props {
  title: string;
  badge?: string | null;
  /** 닫기 버튼 aria-label. 화면 문맥에 맞춰 호출부가 지정한다. */
  closeLabel?: string;
  footNote?: string;
  onClose(): void;
  children: ReactNode;
}

export function DetailModal({ title, badge, closeLabel = '상세 정보 창 닫기', footNote, onClose, children }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // 열릴 때 대화상자 자체로 초점을 옮기고, 닫힐 때 열기 전 요소(트리거)로 초점을 되돌린다.
  // 언마운트 정리(cleanup)가 DOM 제거 전에 동기 실행되도록 layout effect 를 쓴다.
  useLayoutEffect(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => { restoreRef.current?.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const node = dialogRef.current;
      if (!node) return;
      if (event.key === 'Escape') {
        // 캡처 단계에서 먼저 처리해 뒤쪽 지도 팝업 Esc 처리와 겹치지 않게 한다.
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) { event.preventDefault(); node.focus(); return; }
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (!active || active === node || active === first || !node.contains(active)) { event.preventDefault(); last.focus(); }
      } else if (!active || active === last || !node.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div className="detail-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="detail-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="map-popup-head detail-modal-head">
          <h3 id={titleId}>{title}</h3>
          {badge ? <span className="map-popup-badge">{badge}</span> : null}
          <button type="button" className="map-popup-close" aria-label={closeLabel} onClick={onClose}>✕</button>
        </header>
        <div className="map-popup-body detail-modal-body">{children}</div>
        {footNote ? (
          <footer className="map-popup-foot detail-modal-foot">
            <p className="map-popup-disclaimer">{footNote}</p>
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
