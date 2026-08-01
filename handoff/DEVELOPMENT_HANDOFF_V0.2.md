# 개발 인계 v0.2

## 완료
- .NET 제거 및 Vercel TypeScript Functions 전환
- API Function 10종
- 현재상황 입력/검증 및 동적 우선순위 Rule
- GeoJSON 객체 ID 정규화와 지도 강조
- VWorld 환경변수 적용지점
- localStorage 상황뷰

## 개발자가 가장 먼저 할 일
1. Vercel 프로젝트 Root Directory를 저장소 루트로 설정한다.
2. Build Command `npm run build:web`, Output `apps/web/dist`를 확인한다.
3. `VITE_VWORLD_MAP_KEY`를 Development/Preview/Production에 등록한다.
4. UNE RAG의 실제 로그인·검색 스키마를 `server/providers/uneRag.ts`에 구현한다.
5. 공공 API 관측소 매핑표를 작성하고 `publicObservation.ts`를 구현한다.

## 주의
- Functions는 무상태이다.
- 위성 원본·SHP·대형 GeoJSON을 Function 응답으로 직접 전달하지 않는다.
- 실제 운영 이력·감사·RBAC가 필요해질 때 DB/전문 Backend를 별도 결정한다.
