# Development Handoff v1.2

## 기준
- T3Q 외부 기술연계 없음
- 런타임 `MOCK_ONLY`
- 기존 v1.1 기능·Seed·위성·보고서·접근성 자산을 전부 유지

## 신규
- Mock Event/Passage/Relation 계약
- CQ 5문 Mock 검색 UI·API
- 홍수위험지역·위험저수지·풍수해개선지구 Mock 지도 레이어
- Mock 카탈로그·공간 API·시나리오 API

## 개발 확인
1. `npm run typecheck:functions`
2. `python3 scripts/smoke_t3q_mock_contract.py`
3. `python3 scripts/smoke_mock_spatial_layers.py`
4. `python3 scripts/smoke_t3q_search_preview.py`
5. 의존성 설치 후 Web typecheck/build/Playwright

## 금지
Mock 위치·위험등급·피해정보를 실제 T3Q/공식자료 또는 피해예측으로 표시하지 않는다.
