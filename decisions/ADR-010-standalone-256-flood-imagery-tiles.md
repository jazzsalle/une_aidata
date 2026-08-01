# ADR-010 홍수 PRE/EVENT/POST 독립 256×256 타일

## 결정
- 위성영상과 수계마스크는 VWorld 2D 지도에 오버레이하지 않는다.
- `/evidence` 페이지에 PRE/EVENT/POST 3단계, 위성영상·수계마스크 2종을 각각 256×256 독립 타일로 표시한다.
- PRE는 사건 시작일 -12일, EVENT는 재난 시작~종료 +2일 이내, POST는 재난 종료일 +12일 기준이다.
- 현재 표본은 부산·인제·영천 대상자료가 아니며 모든 자산은 `official_data=false`, `data_status=mock`, `shared_demo=true`이다.
- EVENT 영상·마스크는 PRE/POST 첨부자료를 동일 크기로 정합한 뒤 보간하여 생성한 Seed이다.
- 정식 쓰리디랩스 자료 수령 시 파일과 메타데이터만 교체하고 UI 계약은 유지한다.
