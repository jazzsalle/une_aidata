# 홍수 PRE/EVENT/POST 256×256 Seed 타일

- PRE: 사건 시작일 -12일 기준
- EVENT: 재난 시작일부터 종료일 +2일 이내
- POST: EVENT 구간과 겹치지 않도록 재난 종료일 +12일 기준
- 위성영상과 수계마스크는 VWorld 2D 베이스맵 위에 오버레이하지 않고 `/evidence`에서 독립 256×256 타일 카드로 표시한다.
- PRE/POST는 사용자 첨부 참고영상, EVENT는 PRE/POST를 동일 크기로 정합 후 보간해 만든 POC Seed이다.
- 대상지역은 부산·인제·영천이 아니며 `official_data=false`, `data_status=mock`, `shared_demo=true`로 표시한다.
- 향후 쓰리디랩스 정식 영상·마스크가 제공되면 동일 메타데이터 계약으로 교체한다.
