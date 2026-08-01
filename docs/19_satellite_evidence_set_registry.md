# 19. 위성 증거세트 등록·출처·교체 설계

## 객체
`SatelliteEvidenceSet`은 Event, PRE/EVENT/POST 정책, 6개 asset_id, 대상지역 여부, Provider, 출처, SHA-256, 사용제한을 묶는다.

## 교체 절차
1. 쓰리디랩스 후보자료와 메타데이터 수령
2. 사건 시작·종료시각과 촬영일 검증
3. Phase Selection Contract Test
4. 256×256 표시용 타일 생성 또는 제공 URL 연결
5. 원본·표시자산 checksum 기록
6. `official_data`, `data_status`, 공간해상도·Footprint·품질값 설정
7. 기존 evidence_set_id의 새 버전 또는 신규 세트 등록
8. `/evidence`·보고서·접근성 표 검증

## 금지
- Seed와 정식자료를 동일 버전으로 덮어쓰기
- 대상지역 불일치를 숨기기
- 생성 EVENT를 실제 촬영자료로 표시
- VWorld 2D 지도에 위성 타일 오버레이
- 픽셀 상대변화를 공식 침수면적·피해예측으로 변환
