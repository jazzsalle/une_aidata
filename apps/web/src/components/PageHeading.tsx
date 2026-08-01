import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  description: string;
  status?: string | null;
}

export function PageHeading({ title, description, status }: Props) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    document.title = `${title} | 재난안전 AI 대응지원`;
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
