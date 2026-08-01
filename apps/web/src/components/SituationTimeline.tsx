import type { CurrentSituation } from '../types/contracts';

export function SituationTimeline({ situation }: { situation: CurrentSituation | null }) {
  return (
    <section className="dashboard-timeline" aria-labelledby="timeline-title">
      <div className="section-heading-row">
        <h2 id="timeline-title">현재 상황 타임라인</h2>
        <span>관측시각 기준 · 공식/입력/시나리오 상태 구분</span>
      </div>
      <div className="timeline-list">
        {(situation?.observations ?? []).map((item, index) => (
          <article key={`${item.type}-${index}`}>
            <time dateTime={item.observed_at}>{new Date(item.observed_at).toLocaleTimeString('ko-KR')}</time>
            <strong>{item.name ?? item.type}</strong>
            <span>{String(item.value)} {item.unit ?? ''}</span>
            <small>{item.official_data ? '공식 관측' : '입력/시나리오'}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
