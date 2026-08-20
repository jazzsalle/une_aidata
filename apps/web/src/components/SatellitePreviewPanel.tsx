import { useEffect, useMemo, useState } from 'react';
import type { SatelliteAsset, SatelliteEvidenceSet } from '../types/contracts';
import { loadSatelliteAssets, loadSatelliteEvidenceSets } from '../services/apiClient';

/** 위성 근거 미리보기 — 대시보드에서 PRE/EVENT/POST 위성 타일 3장을 읽기 전용으로 보여 준다.
 *
 *  비교 도구·보고서 반영·증거세트 선택은 `/evidence` 페이지의 일이다(3개 상위 페이지 분리
 *  규칙 — 여기서 전부 복제하면 사실상 탭 통합이 된다). 이 패널은 "침수흔적 레이어와 같은 사건
 *  축의 위성 근거가 있다"는 것을 메인에서 알리고 `/evidence` 로 보내는 미리보기다.
 *  `SatelliteComparison` 은 고정 DOM id 를 쓰므로 재사용하지 않고 카드만 따로 그린다(id 없음). */

const PHASES = [
  { code: 'PRE', title: 'PRE(사전)' },
  { code: 'EVENT', title: 'EVENT(발생)' },
  { code: 'POST', title: 'POST(사후)' },
];

export function SatellitePreviewPanel() {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<SatelliteAsset[]>([]);
  const [evidenceSet, setEvidenceSet] = useState<SatelliteEvidenceSet | null>(null);

  useEffect(() => {
    if (!open || assets.length) return;
    let alive = true;
    // 열 때 받는다 — 접힌 패널이 이미지 6장을 미리 받게 두지 않는다.
    Promise.all([loadSatelliteAssets('DEMO-EXT'), loadSatelliteEvidenceSets()])
      .then(([assetRows, sets]) => {
        if (!alive) return;
        setEvidenceSet(sets[0] ?? null);
        setAssets(assetRows);
      })
      .catch(() => { /* 시드 폴백까지 실패하면 카드가 비어 보인다 — 아래 빈 상태 문구가 말한다. */ });
    return () => { alive = false; };
  }, [open, assets.length]);

  const eventId = evidenceSet?.event_id ?? 'POC-FLOOD-IMAGE-SAMPLE-001';
  const cards = useMemo(() => PHASES.map((phase) => ({
    ...phase,
    asset: assets.find((item) => item.event_id === eventId && item.phase === phase.code && item.asset_kind === 'SATELLITE') ?? null,
  })), [assets, eventId]);

  return (
    <section className="satellite-preview" aria-labelledby="satellite-preview-title">
      <div className="section-heading-row">
        <h2 id="satellite-preview-title">
          <button type="button" className="panel-toggle" aria-expanded={open} aria-controls="satellite-preview-body" onClick={() => setOpen(!open)}>
            위성 근거 미리보기
          </button>
        </h2>
        <span>침수흔적 레이어와 같은 사건 축 · 비교·보고서 반영은 피해·변화 근거 페이지에서</span>
      </div>
      {open ? (
        <div id="satellite-preview-body" className="satellite-preview-body">
          <div className="satellite-preview-grid">
            {cards.map((card) => (
              <figure key={card.code}>
                {card.asset?.image_url
                  ? <img width="128" height="128" src={card.asset.image_url} alt={`${card.title} 홍수 시연용 위성영상 타일 미리보기`} />
                  : <span className="satellite-preview-empty">타일 없음</span>}
                <figcaption>
                  <strong>{card.title}</strong>
                  <span>{card.asset ? new Date(card.asset.acquired_at).toLocaleDateString('ko-KR') : '-'}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="satellite-preview-note">
            공유 시연 자료(shared_demo)이며 대상지역 촬영분이 아닙니다. PRE·EVENT 비교, 수계마스크,
            보고서 반영은 <a href="/evidence">피해·변화 근거</a>에서 합니다.
          </p>
        </div>
      ) : null}
    </section>
  );
}
