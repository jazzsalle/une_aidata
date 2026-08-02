import { useEffect, useRef } from 'react';

interface Props {
  title: string;
}

/** 페이지 제목(h1). 상단 여백을 줄이기 위해 헤더 한 줄 안에 작은 글씨로 배치하지만,
 *  라우트별 document.title 갱신과 h1 초점 이동(v0.5 UI 규칙)은 그대로 유지한다. */
export function PageHeading({ title }: Props) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    document.title = `${title} | 재난안전 AI 대응지원`;
    if (isInitialLoadRef.current) {
      // 최초 페이지 로드에서는 브라우저 기본 초점을 유지해 Tab이 skip link부터 시작하게 한다.
      isInitialLoadRef.current = false;
      return;
    }
    // SPA 라우트 변경 시에만 h1으로 초점을 이동한다.
    headingRef.current?.focus();
  }, [title]);

  return <h1 className="app-page-title" ref={headingRef} tabIndex={-1}>{title}</h1>;
}
