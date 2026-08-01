# ADR-012 위성 증거세트 등록·출처·교체 추적

## 결정
PRE/EVENT/POST 위성영상과 수계마스크 6개 자산을 개별 파일이 아니라 `SatelliteEvidenceSet` 단위로 관리한다.

## 이유
- 사건 시작·종료와 Phase Selection 정책을 함께 보존해야 한다.
- 대상지역 외 Seed, 생성 EVENT, 공식자료 여부를 자산과 보고서에 일관되게 전달해야 한다.
- 쓰리디랩스 정식자료 교체 시 화면 계약을 바꾸지 않고 Provider와 Manifest만 교체해야 한다.
- 파일 크기·256×256 규격·SHA-256 무결성을 검증해야 한다.

## 결과
- `/api/v1/satellite-evidence-sets` 제공
- `/evidence`에서 증거세트 선택, Manifest 다운로드, 체크섬 확인
- 보고서 Context에 evidence_set_id, provenance_version, target_region_match 저장
- 지도 오버레이 금지와 피해예측 금지 유지
