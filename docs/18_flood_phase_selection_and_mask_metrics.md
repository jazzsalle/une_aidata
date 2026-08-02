# 홍수 Phase Selection (PRE/EVENT/POST)

> 파일명은 최초 등록 시점의 `18_flood_phase_selection_and_mask_metrics.md`를 유지한다. `handoff/source_design_manifest_v0.8.json`이 이 경로를 참조한다.

## 개정 이력
- 2026-08-02 개정 — "픽셀 상대변화" 절과 `GET /api/v1/satellite-assets/metrics` 설계를 제거한다. 사유: 영상분석은 영상 공급 벤더(쓰리디랩스)의 산출물 범위이며 본 서비스의 분석 범위가 아니다. 수계마스크는 표출만 한다. Phase Selection 설계는 유지한다. (ADR-011 참고)

## Phase Selection
- PRE: 사건 시작 이전 후보 중 `event_start_at - 12 days` 목표일과 최소 편차
- EVENT: `event_start_at`~`event_end_at + 2 days` 안에서 품질과 사건 중간시각 근접성
- POST: EVENT 구간 이후 후보 중 `event_end_at + 12 days` 목표일과 최소 편차

API: `POST /api/v1/satellite-assets/select`

선정 결과는 `offset_days_from_target`(목표일 대비 편차)과 `selection_reason`(선정 사유)을 화면과 API에 함께 제공한다.

## 수계마스크 취급
수계마스크는 위성영상과 같은 단계에 짝지어 256×256 독립 타일로 **표출만** 한다. 본 서비스는 마스크에서 픽셀 수·비율·상대변화 등 어떤 정량지표도 산출하지 않는다.

면적·침수심 등 정량지표가 필요하면 좌표계(EPSG)·GSD·촬영시각·산출방법·품질값을 포함한 벤더 산출물로 수령한다. 수령한 경우에도 피해예측이나 공식 위험등급으로 표현하지 않는다.
