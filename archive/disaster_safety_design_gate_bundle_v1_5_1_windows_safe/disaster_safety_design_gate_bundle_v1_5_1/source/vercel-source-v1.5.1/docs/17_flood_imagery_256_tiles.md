# 홍수 위성영상·수계마스크 256×256 타일 상세설계

## 시간 구간
- PRE: `event_start_at - 12 days`
- EVENT: `event_start_at <= acquired_at <= event_end_at + 2 days`
- POST: EVENT와 중복되지 않도록 `event_end_at + 12 days`

## 화면
`/evidence`에서 3열 단계 카드로 표시하며 각 단계는 위성영상 1개와 수계마스크 1개를 포함한다. 지도는 VWorld 2D를 유지하며 영상은 지도 레이어로 등록하지 않는다.

## 파일
`apps/web/public/seed/imagery/sample-flood/tiles/` 아래 6개 256×256 PNG를 사용한다. 원본 첨부자료는 `source/`에 보존한다.

## 안전표시
대상지역 외 표본, 공식자료 아님, EVENT 생성 Seed, 피해예측 아님, 쓰리디랩스 교체 예정 문구를 화면·메타데이터에 표시한다.
