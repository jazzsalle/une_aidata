import type { SimilarEvent } from '../types/contracts';

function listText(items: Array<Record<string, unknown>>, key: string) {
  return items.map((item) => String(item[key] ?? '')).filter(Boolean);
}

export function DamageRecoveryEvidence({ events, selectedEventIds = [], onToggleEvent }: { events: SimilarEvent[]; selectedEventIds?: string[]; onToggleEvent?(eventId: string): void }) {
  return (
    <section className="evidence-section" aria-labelledby="damage-title">
      <div className="section-heading-row">
        <div>
          <h2 id="damage-title">NDMS 피해·대응·복구 교체 대비 Seed</h2>
          <p>현재 피해를 예측하지 않으며 과거 사례 참고와 화면·보고서 연계 검증에만 사용합니다.</p>
        </div>
        <span className="seed-badge">실제 NDMS 자료 아님</span>
      </div>
      <div className="damage-event-grid">
        {events.map((event) => {
          const response = listText(event.response, 'action');
          const recovery = listText(event.recovery, 'action');
          const damage = event.damage as Record<string, unknown>;
          return (
            <article key={event.event_id} className="damage-event-card">
              <header>
                <div><strong>{event.event_name}</strong><small>{new Date(event.occurred_from).toLocaleDateString('ko-KR')} · {event.admin_name}</small></div>
                <span>{event.similarity_score}점</span>
              </header>
              <div className="damage-columns">
                <section><h3>피해 참고</h3><pre>{JSON.stringify(damage, null, 2)}</pre></section>
                <section><h3>대응 이력</h3><ol>{response.map((item) => <li key={item}>{item}</li>)}</ol></section>
                <section><h3>복구 이력</h3><ol>{recovery.map((item) => <li key={item}>{item}</li>)}</ol></section>
              </div>
              <footer><span>현재 피해예측 아님</span><span>담당자 검토 필요</span><span>향후 T3Q Provider 교체</span><button type="button" aria-pressed={selectedEventIds.includes(event.event_id)} onClick={()=>onToggleEvent?.(event.event_id)}>{selectedEventIds.includes(event.event_id)?'보고서 근거에서 제외':'보고서 참고사례로 반영'}</button></footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
