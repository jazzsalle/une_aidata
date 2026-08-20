import { useEffect, useMemo, useState } from 'react';

/** 계획보고서 지식 패널 — 보고서 유형 → 역량질문(CQ) → 답 인스턴스(passage·출처·클래스) 드릴다운.
 *
 *  T3Q 재난메타 인스턴스 표본을 "실제로 올 데이터 구조" 그대로 노출하는 자리다. Agent 창의 CQ
 *  문답과 같은 시드를 쓰므로 두 화면의 답이 항상 같다. 표본이라는 사실은 상단 범례와 구분색
 *  (.meta-demo-text)이 말한다 — 색만으로 구분하지 않는다.
 *
 *  재해연보·재난대장·산사태취약지역 등 다른 원천과의 연계는 이번 전달분에 인스턴스가 없어
 *  "연계 예정 원천" 문구로만 적는다 — 없는 데이터를 화면에 만들지 않는다. */

interface CqPassage { passage_text: string; class_iri: string; instance_kind: string; provenance: { source_file?: string | null; page?: number | null } }
interface CqEntry {
  cq_key: string; plan_type: string; set_label: string; admin_code: string; admin_name: string;
  cq_id: string; axis: string | null; question: string; answerable: boolean;
  answer_passages: CqPassage[];
}
interface CqSeed { entries: CqEntry[]; notice?: string }

const classLabel = (iri: string) => iri.split('/').pop() ?? iri;

export function PlanKnowledgePanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CqEntry[]>([]);
  const [planType, setPlanType] = useState<string>('');
  const [activeCq, setActiveCq] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/seed/meta_demo_cq_answers_seed.json')
      .then((response) => (response.ok ? (response.json() as Promise<CqSeed>) : Promise.reject(new Error(String(response.status)))))
      .then((payload) => { if (alive) setEntries(payload.entries ?? []); })
      .catch(() => { if (alive) setError('메타 표본 시드를 받지 못했습니다.'); });
    return () => { alive = false; };
  }, []);

  const planTypes = useMemo(() => [...new Set(entries.map((entry) => entry.plan_type))], [entries]);
  const currentPlan = planType || planTypes[0] || '';
  const questions = useMemo(() => entries.filter((entry) => entry.plan_type === currentPlan), [entries, currentPlan]);
  const current = questions.find((entry) => entry.cq_key === activeCq) ?? null;

  return (
    <section className="plan-knowledge" aria-labelledby="plan-knowledge-title">
      <div className="section-heading-row">
        <h2 id="plan-knowledge-title">
          <button type="button" className="panel-toggle" aria-expanded={open} aria-controls="plan-knowledge-body" onClick={() => setOpen(!open)}>
            계획보고서 지식 조회 (역량질문) <span className="meta-demo-badge">표본</span>
          </button>
        </h2>
        <span>파란 텍스트 = T3Q 메타 인스턴스 표본 · 실지역 공식자료 아님</span>
      </div>
      {open ? (
        <div id="plan-knowledge-body" className="plan-knowledge-body">
          {error ? <p role="alert" className="inline-error">{error}</p> : null}
          <div className="plan-knowledge-controls">
            <label>보고서 유형
              <select value={currentPlan} onChange={(event) => { setPlanType(event.target.value); setActiveCq(''); }}>
                {planTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <p className="plan-knowledge-set meta-demo-text">{questions[0]?.set_label ?? ''} · {questions[0]?.admin_name ?? ''}</p>
          </div>
          <ul className="plan-knowledge-questions">
            {questions.map((entry) => (
              <li key={entry.cq_key}>
                <button
                  type="button"
                  aria-expanded={activeCq === entry.cq_key}
                  disabled={!entry.answerable}
                  title={entry.answerable ? undefined : '이 질문은 전달분 인스턴스에 답 소재가 없습니다.'}
                  onClick={() => setActiveCq(activeCq === entry.cq_key ? '' : entry.cq_key)}
                >
                  <span className="plan-knowledge-cq">{entry.cq_id}</span>
                  <span className={entry.answerable ? 'meta-demo-text' : undefined}>{entry.question}</span>
                  {!entry.answerable ? <span className="plan-knowledge-empty">소재 없음</span> : null}
                </button>
              </li>
            ))}
          </ul>
          {current ? (
            <div className="plan-knowledge-answer">
              {current.answer_passages.map((passage, index) => (
                <article key={`${current.cq_key}-${index}`}>
                  <p className="meta-demo-text">{passage.passage_text}</p>
                  <p className="plan-knowledge-meta">
                    클래스 {classLabel(passage.class_iri)} · {passage.instance_kind}
                    {passage.provenance.source_file ? ` · ${String(passage.provenance.source_file).split('/').pop()}` : ''}
                    {passage.provenance.page ? ` ${passage.provenance.page}쪽` : ''}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
          <p className="plan-knowledge-footnote">
            연계 예정 원천(이번 전달분에 인스턴스 없음): 재해연보·재해연감·재난대장·산사태취약지역·홍수위험지구·지하차도.
            연결 축은 역량질문(CQ)과 사건 마스터ID 다.
          </p>
        </div>
      ) : null}
    </section>
  );
}
