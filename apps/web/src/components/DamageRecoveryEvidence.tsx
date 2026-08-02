// 과거 피해·대응·복구 사례 카드.
// 담당 공무원이 바로 읽을 수 있도록 금액·서술·이력·출처를 정리해 보여주고,
// 계약 검증용 원시 응답 구조(JSON)는 카드별 "응답 구조 보기" 버튼 → 공용 DetailModal 로 분리한다.
// 값은 행정안전부 재해대장 등 과거 확정 집계이며 현재 피해예측이 아니다(원값 그대로 표기, 임의 환산·보정 없음).
import { useCallback, useState } from 'react';
import type { SimilarEvent } from '../types/contracts';
import { DetailModal } from './DetailModal';
import { FactList, MISSING, orMissing, str } from './DistrictDetail';

/** 이력 항목 중 표시할 문장이 만들어지는 행만 남긴다(빈 행으로 목록을 채우지 않는다). */
function historyItems(items: Array<Record<string, unknown>>) {
  return items.filter((item) => Boolean(str(item.action) ?? str(item.description)));
}

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** 재해대장 금액은 천원 단위 원값이다. 읽기 쉽도록 억원 환산을 병기하되 원값을 반드시 함께 남긴다. */
function thousandWon(value: unknown): string {
  const amount = num(value);
  if (amount === null) return MISSING;
  return `${(amount / 100000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억원 (${amount.toLocaleString('ko-KR')}천원)`;
}

// 이력 상태코드는 화면에서 우리말로 읽히게 한다. 정의에 없는 값은 원문 그대로 두어 임의로 바꾸지 않는다.
const HISTORY_STATUS: Record<string, string> = { completed: '완료', in_progress: '진행중', planned: '예정', cancelled: '취소' };

/** 대응·복구 이력 1건을 한 줄 문장으로 정리한다(담당기관·상태·소요시간은 있을 때만 덧붙인다). */
function historyText(row: Record<string, unknown>): string {
  const primary = str(row.action) ?? str(row.description) ?? MISSING;
  const status = str(row.status);
  const extras = [
    str(row.responsible_agency),
    status ? HISTORY_STATUS[status] ?? status : null,
    row.duration_hours !== undefined && row.duration_hours !== null ? `소요 ${orMissing(row.duration_hours)}시간` : null,
  ].filter(Boolean);
  return extras.length ? `${primary} · ${extras.join(' · ')}` : primary;
}

const QUANTITY_LABEL: Array<[string, string]> = [
  ['human', '인명'],
  ['public_facility', '공공시설'],
  ['private_facility', '사유시설'],
  ['agriculture', '농업'],
];

/** 시연 Seed 사례의 정량 항목(건수·면적 등)을 라벨·값 쌍으로 펼친다. 값이 없으면 행을 만들지 않는다. */
function quantityRows(damage: Record<string, unknown>): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  for (const [key, label] of QUANTITY_LABEL) {
    const value = damage[key];
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      const text = value
        .map((item) => {
          if (!item || typeof item !== 'object') return orMissing(item);
          const row = item as Record<string, unknown>;
          const amount = row.count ?? row.value;
          const category = str(row.category) ?? MISSING;
          return amount === undefined || amount === null ? category : `${category} ${orMissing(amount)}${str(row.unit) ?? ''}`;
        })
        .filter(Boolean)
        .join(' / ');
      if (text) rows.push({ label, value: text });
    } else if (typeof value === 'object') {
      const text = Object.entries(value as Record<string, unknown>)
        .map(([key2, value2]) => `${key2 === 'evacuees' ? '대피인원' : key2} ${orMissing(value2)}${key2 === 'evacuees' ? '명' : ''}`)
        .join(' / ');
      if (text) rows.push({ label, value: text });
    } else {
      rows.push({ label, value: orMissing(value) });
    }
  }
  return rows;
}

type FacilityRow = {
  facility_type?: unknown;
  row_count?: unknown;
  damage_local?: unknown;
  recovery_local?: unknown;
  damage_central?: unknown;
  recovery_central?: unknown;
};

function DamageSummary({ damage }: { damage: Record<string, unknown> }) {
  const ledger = (damage.ledger_aggregate ?? null) as Record<string, unknown> | null;
  const description = str(damage.description);
  const note = str(damage.damage_note);
  const quantities = quantityRows(damage);
  const hasLedger = Boolean(ledger);

  const localDamage = ledger ? num(ledger.damage_amount_local_report) : null;
  const localRecovery = ledger ? num(ledger.recovery_cost_local_report) : null;
  const centralDamage = ledger ? num(ledger.damage_amount_central_confirmed) : null;
  const centralRecovery = ledger ? num(ledger.recovery_cost_central_confirmed) : null;
  // 지자체 보고값과 중앙 확정값이 같으면 같은 금액을 두 번 읽히게 하지 않고 한 줄로 합쳐 표기한다.
  const sameAmounts = localDamage === centralDamage && localRecovery === centralRecovery;
  const facilities = (Array.isArray(ledger?.facility_breakdown) ? ledger?.facility_breakdown : []) as FacilityRow[];
  const stageCounts = (ledger?.recovery_stage_counts ?? null) as Record<string, unknown> | null;
  const stageText = stageCounts
    ? Object.entries(stageCounts).map(([stage, count]) => `${stage} ${orMissing(count)}건`).join(' · ')
    : null;

  return (
    <section className="damage-summary">
      <h3>피해 규모</h3>
      {hasLedger ? (
        <>
          <ul className="damage-amount-list">
            <li>
              <span className="damage-amount-label">{sameAmounts ? '공공시설 피해금액 (지자체 보고·중앙 확정)' : '공공시설 피해금액 (지자체 보고)'}</span>
              <strong className="damage-amount-value">{thousandWon(localDamage)}</strong>
            </li>
            <li>
              <span className="damage-amount-label">{sameAmounts ? '복구비 (지자체 보고·중앙 확정)' : '복구비 (지자체 보고)'}</span>
              <strong className="damage-amount-value">{thousandWon(localRecovery)}</strong>
            </li>
            {sameAmounts ? null : (
              <>
                <li>
                  <span className="damage-amount-label">공공시설 피해금액 (중앙 확정)</span>
                  <strong className="damage-amount-value">{thousandWon(centralDamage)}</strong>
                </li>
                <li>
                  <span className="damage-amount-label">복구비 (중앙 확정)</span>
                  <strong className="damage-amount-value">{thousandWon(centralRecovery)}</strong>
                </li>
              </>
            )}
          </ul>
          <p className="damage-scope-note">{orMissing(ledger?.record_scope)}</p>
        </>
      ) : quantities.length ? (
        <FactList className="map-popup-facts damage-quantity-facts" rows={quantities} />
      ) : (
        <p className="damage-no-quantity">정량 피해수치 미확보 — 기록 서술만 확인됨</p>
      )}

      {description ? <p className="damage-description">{description}</p> : null}
      {!hasLedger && note ? <p className="damage-description">{note}</p> : null}

      {hasLedger ? (
        <>
          <h3>집계 출처</h3>
          <FactList
            className="map-popup-facts damage-source-facts"
            rows={[
              { label: '출처 문서', value: orMissing(ledger?.source_document) },
              { label: '매칭 재난', value: `${orMissing(ledger?.matched_disaster_year)}년 · ${orMissing(ledger?.matched_disaster_name)}` },
              { label: '대상 시군구', value: [str(ledger?.matched_sido), str(ledger?.matched_sigungu)].filter(Boolean).join(' ') || MISSING },
              { label: '집계 건수', value: ledger?.matched_row_count === undefined ? MISSING : `재해대장 ${orMissing(ledger?.matched_row_count)}건` },
              { label: '확정 단계', value: [str(ledger?.confirmation_status), stageText].filter(Boolean).join(' · ') || MISSING },
              { label: '집계 범위', value: orMissing(ledger?.aggregation_scope) },
            ]}
          />
          {facilities.length ? (
            <details className="damage-facility-details">
              <summary>시설구분별 피해·복구 내역 {facilities.length}종 보기</summary>
              <div className="table-scroll">
                <table className="comparison-table">
                  <caption>시설구분별 재해대장 집계 (금액 단위: 천원, 중앙 확정 기준)</caption>
                  <thead>
                    <tr>
                      <th scope="col">시설구분</th>
                      <th scope="col">건수</th>
                      <th scope="col">피해금액(천원)</th>
                      <th scope="col">복구비(천원)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facilities.map((row, index) => (
                      <tr key={`${str(row.facility_type) ?? 'row'}-${index}`}>
                        <th scope="row">{orMissing(row.facility_type)}</th>
                        <td>{orMissing(row.row_count)}</td>
                        <td>{num(row.damage_central ?? row.damage_local) === null ? MISSING : Number(row.damage_central ?? row.damage_local).toLocaleString('ko-KR')}</td>
                        <td>{num(row.recovery_central ?? row.recovery_local) === null ? MISSING : Number(row.recovery_central ?? row.recovery_local).toLocaleString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function DamageRecoveryEvidence({ events, selectedEventIds = [], onToggleEvent }: { events: SimilarEvent[]; selectedEventIds?: string[]; onToggleEvent?(eventId: string): void }) {
  const [structureEventId, setStructureEventId] = useState<string | null>(null);
  // 닫기 시 초점 복귀는 DetailModal 이 열기 전 초점 요소("응답 구조 보기" 버튼)로 되돌린다.
  const closeStructure = useCallback(() => setStructureEventId(null), []);
  const structureEvent = events.find((event) => event.event_id === structureEventId) ?? null;

  return (
    <section className="evidence-section" aria-labelledby="damage-title">
      <div className="section-heading-row">
        <div>
          <h2 id="damage-title">과거 피해·대응·복구 사례</h2>
          <p>같은 지역에서 있었던 과거 사건의 피해 규모·대응·복구 기록입니다. 현재 피해를 예측하지 않으며 참고자료로만 사용합니다.</p>
        </div>
        <span className="seed-badge">실제 NDMS 자료 아님</span>
      </div>
      <div className="damage-event-grid">
        {events.map((event) => {
          const response = historyItems(event.response);
          const recovery = historyItems(event.recovery);
          const damage = event.damage as Record<string, unknown>;
          const selected = selectedEventIds.includes(event.event_id);
          // 재해대장 집계가 있는 사례만 '과거 확정 집계'로 표기하고, 나머지는 시연 Seed 기록임을 밝힌다.
          const fromLedger = Boolean(damage.ledger_aggregate);
          return (
            <article key={event.event_id} className="damage-event-card">
              <header>
                <div><strong>{event.event_name}</strong><small>{new Date(event.occurred_from).toLocaleDateString('ko-KR')} · {event.admin_name}</small></div>
                <span>{event.similarity_score}점</span>
              </header>
              <div className="damage-columns">
                <DamageSummary damage={damage} />
                <section>
                  <h3>대응 이력</h3>
                  {response.length
                    ? <ol className="damage-history">{response.map((item, index) => <li key={`${event.event_id}-res-${index}`}>{historyText(item)}</li>)}</ol>
                    : <p className="damage-history-empty">대응 이력 기록 미확보</p>}
                </section>
                <section>
                  <h3>복구 이력</h3>
                  {recovery.length
                    ? <ol className="damage-history">{recovery.map((item, index) => <li key={`${event.event_id}-rec-${index}`}>{historyText(item)}</li>)}</ol>
                    : <p className="damage-history-empty">복구 이력 기록 미확보</p>}
                </section>
              </div>
              <div className="damage-card-tools">
                <button type="button" className="damage-structure-button" onClick={() => setStructureEventId(event.event_id)}>
                  응답 구조 보기
                </button>
                <span className="damage-structure-hint">데이터 연계 점검용 원시 응답 구조를 창으로 확인합니다.</span>
              </div>
              <footer>
                <span>현재 피해예측 아님</span>
                <span>{fromLedger ? '과거 확정 집계' : '시연 Seed 기록'}</span>
                <span>담당자 검토 필요</span>
                <button type="button" aria-pressed={selected} onClick={() => onToggleEvent?.(event.event_id)}>{selected ? '보고서 근거에서 제외' : '보고서 참고사례로 반영'}</button>
              </footer>
            </article>
          );
        })}
      </div>
      <p className="safety-note">표시 금액은 과거 재해대장 확정 집계이며 현재 사건의 피해예측이 아닙니다. 시군구 전체 합계라서 위험지구 단위 금액이 아니고, 담당자 검토 후 사용해야 합니다.</p>
      {structureEvent ? (
        <DetailModal
          title={`${structureEvent.event_name} 응답 구조`}
          badge="개발·계약 검증용"
          closeLabel="응답 구조 창 닫기"
          footNote="이 창은 화면 표시용 정리 이전의 원시 응답 구조를 그대로 보여주는 개발·연계계약 검증용 보기입니다. 현재는 Mock/Seed 응답이며 향후 T3Q NDMS Provider 응답으로 교체됩니다."
          onClose={closeStructure}
        >
          <section className="map-popup-section">
            <h4>사건 식별</h4>
            <FactList rows={[
              { label: 'event_id', value: orMissing(structureEvent.event_id) },
              { label: 'record_id', value: orMissing(structureEvent.record_id) },
              { label: 'data_status', value: orMissing(structureEvent.data_status) },
              { label: 'provider_id', value: orMissing(structureEvent.provider_id) },
              { label: 'official_data', value: String(structureEvent.official_data) },
              { label: 'is_prediction', value: String(structureEvent.is_prediction) },
            ]} />
          </section>
          <section className="map-popup-section">
            <h4>damage 응답 구조</h4>
            <pre className="structure-json">{JSON.stringify(structureEvent.damage, null, 2)}</pre>
          </section>
          <section className="map-popup-section">
            <h4>response · recovery 응답 구조</h4>
            <pre className="structure-json">{JSON.stringify({ response: structureEvent.response, recovery: structureEvent.recovery }, null, 2)}</pre>
          </section>
        </DetailModal>
      ) : null}
    </section>
  );
}
