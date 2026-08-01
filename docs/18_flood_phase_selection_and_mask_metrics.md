# 홍수 Phase Selection 및 수계마스크 픽셀 상대변화

## Phase Selection
- PRE: 사건 시작 이전 후보 중 `event_start_at - 12 days` 목표일과 최소 편차
- EVENT: `event_start_at`~`event_end_at + 2 days` 안에서 품질과 사건 중간시각 근접성
- POST: EVENT 구간 이후 후보 중 `event_end_at + 12 days` 목표일과 최소 편차

API: `POST /api/v1/satellite-assets/select`

## 픽셀 상대변화
`GET /api/v1/satellite-assets/metrics?event_id=...`는 256×256 이진 마스크의 흰색 픽셀 수·비율·PRE 대비 순증감을 반환한다. 이 값은 지리면적이나 피해예측 값이 아니다.
