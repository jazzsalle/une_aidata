# 개발 인계서 v0.9

## 목표
홍수 PRE/EVENT/POST 6개 자산을 증거세트 단위로 등록하고 출처·무결성·대상지역 불일치·쓰리디랩스 교체지점을 추적한다.

## 구현
- `satellite_evidence_sets_seed.json`
- `SatelliteEvidenceSetProvider`와 Static/ThreeDLabs 구현 경계
- `GET /api/v1/satellite-evidence-sets`
- `/evidence` 증거세트 선택·Manifest 다운로드·체크섬 표
- Report Context의 evidence_set_id·provenance_version·target_region_match
- checksum·256×256·오버레이 금지 Smoke Test

## 검증
`python3 scripts/smoke_satellite_evidence_sets.py`

## 다음 단계
1. 회사 환경에서 npm install/typecheck/build
2. Vercel Preview 배포
3. VWorld 2D 신규키·도메인 검증
4. 쓰리디랩스 정식 후보자료로 신규 evidence set 작성·Contract Test
5. UNE RAG 및 공공 기상·수문 실응답 Fixture 적용
