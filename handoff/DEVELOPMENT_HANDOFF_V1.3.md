# Development Handoff v1.3

## 실행 기본값
EVENT_PROVIDER=mock / RISK_PROVIDER=mock / OBSERVATION_PROVIDER=mock / SPATIAL_PROVIDER=mock

## 교체 순서
1. 실제 응답 Fixture 확보
2. Provider 구현
3. Mapper로 공통 Domain Model 변환
4. Provider contract test 통과
5. 환경변수 변경
6. 화면·보고서 회귀시험

## 금지
- 화면에서 T3Q/Open API 원천 필드 직접 참조
- 미확보 값을 실제값으로 합성
- `synthetic_demo`를 실제 사건으로 표시
- RAG 관련도를 사건 유사도와 혼합
