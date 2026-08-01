# 개발 인계서 v0.5

## 구현 완료
1. 기상청 초단기실황 TypeScript Provider와 진단 Endpoint
2. 현재상황에 실제 공공 관측값 우선 병합
3. VWorld·KMA·홍수통제소·UNE RAG 연계상태 패널
4. 피해·변화 근거 페이지의 위성영상·침수흔적도·과거 피해복구 사례 선택
5. 선택 근거의 보고서 초안 자동 반영
6. 피해복구 Seed가 현재 피해현황/예측으로 자동 전환되지 않는 안전규칙
7. Playwright 키보드·라우팅·대체조작 E2E 시나리오

## 실제 환경 입력
- `DATA_GO_KR_SERVICE_KEY`
- `VITE_VWORLD_MAP_KEY`와 등록 도메인
- UNE RAG Swagger의 실제 로그인·검색 경로 및 요청 필드
- 홍수통제소 관측소 코드/호출계약

## 다음 단계
- Vercel Preview 배포에서 실제 도메인·VWorld 타일 검증
- KMA 실응답 캡처와 우선 확인지역 점수 변화 검증
- UNE RAG Swagger 실매핑
- 홍수통제소 수위·유량 Provider 구현
- Playwright/화면낭독기 수동 결합시험
