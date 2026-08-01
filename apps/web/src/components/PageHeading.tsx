import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  description: string;
  status?: string | null;
}

export function PageHeading({ title, description, status }: Props) {
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

  return (
    <div className="page-heading">
      <div>
        <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        <p>{description}</p>
      </div>
      {status ? <p className="page-status" role="status">{status}</p> : null}
    </div>
  );
}
