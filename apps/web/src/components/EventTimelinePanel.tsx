import { useEffect, useState } from 'react';

/** 사건 타임라인 패널 — 재난 마스터ID(KDSA)를 축으로 시점별 연결 자료를 편다.
 *
 *  재난메타 정의서 v0.96 「참고4」의 2022 수도권 집중호우 예시를 전사한 표본이다. 부처·형식이
 *  다른 자료(경보·관측·보고·선포·AI 데이터셋)가 전부 사건참조(aboutEvent)로 한 ID 에 묶이는
 *  구조 — 실 T3Q 연계 때 이 축으로 자료가 온다는 예고를 겸한다. POC 내부 event_id(EVT::)와
 *  형식이 달라 매핑 노트를 함께 보여 준다. */

interface TimelineItem { at: string; stage: string; title: string; element_binding: string; qname: string }
interface TimelineSeed {
  notice?: string;
  event: {
    event_master_id: string; id_rule: string; event_name: string; region: string;
    legal_region_code_10: string; hazard_codes: string[]; poc_event_id_note: string;
  };
  timeline: TimelineItem[];
}

const stageTone: Record<string, string> = { 경보: '⚠', 관측: '📈', 공간: '🗺', 보고: '📄', 선포: '📢', 'AI 데이터': '🤖' };

export function EventTimelinePanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TimelineSeed | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/seed/meta_demo_event_timeline_seed.json')
      .then((response) => (response.ok ? (response.json() as Promise<TimelineSeed>) : Promise.reject(new Error(String(response.status)))))
      .then((payload) => { if (alive) setData(payload); })
      .catch(() => { if (alive) setError('사건 타임라인 시드를 받지 못했습니다.'); });
    return () => { alive = false; };
  }, []);

  return (
    <section className="event-timeline" aria-labelledby="event-timeline-title">
      <div className="section-heading-row">
        <h2 id="event-timeline-title">
          <button type="button" className="panel-toggle" aria-expanded={open} aria-controls="event-timeline-body" onClick={() => setOpen(!open)}>
            사건 마스터ID 연결 자료 (시점별) <span className="meta-demo-badge">표본</span>
          </button>
        </h2>
        <span>재난메타 정의서 v0.96 예시 전사 · 실제 등록 사건 아님</span>
      </div>
      {open && data ? (
        <div id="event-timeline-body" className="event-timeline-body">
          <div className="event-timeline-head">
            <p><strong className="meta-demo-text">{data.event.event_master_id}</strong> · {data.event.event_name}</p>
            <p className="event-timeline-sub">
              채번 규칙 {data.event.id_rule} · 지역 {data.event.region}(법정동 {data.event.legal_region_code_10}) ·
              재난유형 {data.event.hazard_codes.join(' · ')}
            </p>
          </div>
          <ol className="event-timeline-list">
            {data.timeline.map((item) => (
              <li key={`${item.at}-${item.stage}`}>
                <time dateTime={item.at}>{new Date(item.at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}</time>
                <span className="event-timeline-stage">{stageTone[item.stage] ?? '•'} {item.stage}</span>
                <span className="meta-demo-text">{item.title}</span>
                <small>{item.element_binding} · {item.qname}</small>
              </li>
            ))}
          </ol>
          <p className="event-timeline-note">{data.event.poc_event_id_note}</p>
        </div>
      ) : null}
      {open && error ? <p role="alert" className="inline-error">{error}</p> : null}
    </section>
  );
}
