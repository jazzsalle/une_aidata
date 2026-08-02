// 위험지구(자연재해저감 종합계획 판독자료) 상세 표출 공용 컴포넌트.
// 지도 POI 팝업(`MapPanel`)과 '현재 판단' 카드의 상세보기 모달이 이 파일 하나만 재사용한다.
// 값은 계획문서 판독 결과이므로 결측(null)이 정상이며 화면에서는 '미확보'로 표기하고 임의로 채우지 않는다.
import type { DistrictReference, ReferenceEvidence } from '../types/planReference';

export const MISSING = '미확보';
export type Fact = { label: string; value: string };

export const str = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  const text = String(value).trim();
  return text ? text : null;
};
export const orMissing = (value: unknown) => str(value) ?? MISSING;

/** 백만원 단위 계획 사업비를 억원 병기로 표기한다(계획문서 표기값이며 산정·예측값이 아니다). */
export function money(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return `${(value / 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억원 (${value.toLocaleString('ko-KR')}백만원)`;
}

export function evidenceText(evidence?: ReferenceEvidence | null): string | null {
  if (!evidence) return null;
  const title = str(evidence.doc_title) ?? str(evidence.doc);
  const page = str(evidence.page_label)
    ?? str(evidence.chapter_page)
    ?? (evidence.page ? `p.${evidence.page}` : null)
    ?? (typeof evidence.pdf_page === 'number' ? `p.${evidence.pdf_page}` : null)
    ?? (Array.isArray(evidence.pdf_page) && evidence.pdf_page.length ? `p.${evidence.pdf_page.join(', ')}` : null);
  const parts = [title, str(evidence.chapter), str(evidence.table), page].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function FactList({ rows, className = 'map-popup-facts' }: { rows: Fact[]; className?: string }) {
  return (
    <dl className={className}>
      {rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl>
  );
}

/**
 * 위험지구 1차 요약행. 지도 팝업과 상세 모달이 같은 라벨·순서를 쓰도록 한 곳에서만 만든다.
 * `properties`는 지도 GeoJSON 속성 보조값이며, 판독자료(district)가 있으면 그 값을 우선한다.
 */
export function districtFactRows(district: DistrictReference | null, properties: Record<string, unknown> = {}): Fact[] {
  return [
    { label: '위치', value: orMissing(district?.location ?? properties.location) },
    { label: '재해유형', value: [str(district?.disaster_type ?? properties.disaster_type), str(district?.disaster_subtype)].filter(Boolean).join(' · ') || MISSING },
    { label: '계획서 위험도 표기', value: orMissing(district?.grade) },
    { label: '관련 하천', value: orMissing(district?.river_name ?? properties.river_name) },
    { label: '측점', value: orMissing(district?.station) },
  ];
}

/**
 * 위험지구 상세 본문(위험요인·위험조건 임계값·저감대책·시행/사업·피해이력).
 * `evidence`를 넘기면 마지막에 근거 절을 함께 렌더한다(지도 팝업은 하천·비고와 순서를 맞추려고 자체 근거 절을 유지한다).
 */
export function DistrictDetailSections({ district, evidence }: { district: DistrictReference; evidence?: string | null }) {
  const showEvidence = evidence !== undefined;
  return (
    <>
      {district.risk_factors?.length ? (
        <section className="map-popup-section">
          <h4>위험요인</h4>
          <ul className="map-popup-list">{district.risk_factors.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ) : null}
      {district.risk_thresholds?.length ? (
        <section className="map-popup-section">
          <h4>위험조건 임계값</h4>
          <table className="map-popup-table">
            <caption className="sr-only">{district.district_name} 위험조건 임계값 — 계획서 판독값이며 발령기준이 아닙니다.</caption>
            <thead><tr><th scope="col">대상</th><th scope="col">조건</th><th scope="col">값</th><th scope="col">단위</th><th scope="col">산정근거</th></tr></thead>
            <tbody>
              {district.risk_thresholds.map((row, index) => (
                <tr key={`${row.target}-${index}`}>
                  <th scope="row">{orMissing(row.target)}</th>
                  <td>{orMissing(row.operator)}</td>
                  <td>{row.value === null || row.value === undefined ? MISSING : row.value}</td>
                  <td>{orMissing(row.unit)}</td>
                  <td>{[str(row.basis), evidenceText(row.evidence)].filter(Boolean).join(' · ') || MISSING}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {district.mitigation?.length ? (
        <section className="map-popup-section">
          <h4>저감대책</h4>
          <ul className="map-popup-list">{district.mitigation.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ) : null}
      <section className="map-popup-section">
        <h4>시행·사업</h4>
        <FactList rows={[
          { label: '시행방법', value: orMissing(district.implementation_method) },
          { label: '시행시기', value: orMissing(district.implementation_period) },
          { label: '사업상태', value: orMissing(district.project_status) },
          { label: '사업비', value: money(district.cost_million_krw) },
          { label: '계획서 예상피해액', value: money(district.expected_damage_million_krw) },
          { label: '계획 우선순위', value: orMissing(district.priority) },
          { label: '시행주체', value: orMissing(district.implementer) },
        ]} />
      </section>
      {district.damage_events?.length ? (
        <section className="map-popup-section">
          <h4>피해이력(참고 사례)</h4>
          <ul className="map-popup-list">
            {district.damage_events.map((item, index) => (
              <li key={`${item.occurred ?? 'unknown'}-${index}`}>
                <strong>{[str(item.occurred), str(item.event_name)].filter(Boolean).join(' ') || MISSING}</strong>
                {str(item.description) ? <span> — {item.description}</span> : null}
                {evidenceText(item.evidence) ? <small className="map-popup-source">근거 · {evidenceText(item.evidence)}</small> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {showEvidence ? (
        <section className="map-popup-section">
          <h4>근거</h4>
          <p className="map-popup-source">{evidence ?? MISSING}</p>
        </section>
      ) : null}
    </>
  );
}
