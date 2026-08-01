# Mock·Fallback

## 순서

1. 실 Provider 호출
2. 일시적 실패 1회 재시도
3. 유효한 최근 정상 캐시
4. Scenario/Static Seed
5. 화면에 provider, observed_at, fallback_used, limitations 표시

## 금지

- Scenario 값을 실제/공식으로 표시
- Mock 피해를 현재 피해로 표시
- Seed 위성영상을 실제 관측으로 표시
- 빈 RAG 결과에 Citation 생성
