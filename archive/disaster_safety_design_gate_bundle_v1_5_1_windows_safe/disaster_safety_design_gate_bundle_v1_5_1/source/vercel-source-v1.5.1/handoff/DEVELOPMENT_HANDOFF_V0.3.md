# 개발 인계서 v0.3

## 구현 완료

1. VWorld WMTS의 브라우저 타일 로딩 성공·실패 상태를 화면에서 확인한다.
2. UNE RAG 로그인·검색 경로를 환경변수로 설정하는 실제 호출 Adapter를 구현했다.
3. 지역·재난유형·계절·강우조건을 반영한 Event 단위 유사사례 상대점수를 산정한다.
4. UNE RAG Passage는 사건의 `evidence`에 결합하고, 검색 실패 시 Seed 근거로 동작한다.
5. 침수흔적 POC GeoJSON을 지도에 토글하여 표출한다.
6. 지역별 기준·재난 전·발생 근접·재난 후·최근 위성 Seed 이미지를 제공한다.
7. 취약지역 변화탐색에서 좌우 비교와 스와이프 비교가 동작한다.
8. 사례비교에서 현재조건과 과거 피해·대응·복구 참고정보를 함께 표출한다.

## 실제 환경에서 필요한 설정

```env
VITE_VWORLD_MAP_KEY=
UNE_RAG_BASE_URL=http://221.147.100.161:8000
UNE_RAG_AUTH_MODE=login
UNE_RAG_LOGIN_PATH=/실제로그인경로
UNE_RAG_SEARCH_PATH=/실제검색경로
UNE_RAG_USERNAME=
UNE_RAG_PASSWORD=
```

Swagger의 실제 경로와 필드가 현재 가정과 다르면 `server/providers/uneRag.ts`의 로그인 Body와 검색 Body만 조정한다. 화면·도메인 계약은 변경하지 않는다.

## 다음 개발 우선순위

1. UNE RAG 실제 Swagger 기준 요청·응답 매핑 검증
2. 공공 기상특보·강우·수위·유량 API 중 최소 1개 실제 Provider 연결
3. 위성영상·침수흔적 지도 중첩과 선택 시점 연동
4. 보고서 초안에 선택 유사사례·근거·대응절차 자동 반영
5. Vercel Preview 및 고정 도메인 배포시험
