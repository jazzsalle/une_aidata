# Runtime Regression Gate — Source v1.4

## 목적

15개 Mock Event가 실제 실행 경로에서 일관된 순위와 요인별 기여도를 생성하고, 현재 확인사항과 과거 대응조치 비교, CQ 5문, 보고서 참고근거 연계까지 이어지는지 검증한다.

## 검증 범위

- 5개 CurrentSituation × 15개 Event 전체 순위
- 7개 SimilarityFactorScore의 정규화 점수·가중치·기여도
- 결측요인 제외 후 유효가중치 재정규화
- ResponseComparisonItem과 담당자 확인 플래그
- CQ 5문의 Event Master·Passage·RefDisasterEventID·lineage
- 선택 유사사례의 보고서 요인점수·대응비교·우선확인지역 연계
- 독립 브라우저 회귀 대시보드 렌더링

## 실행

```bash
npm run typecheck:functions
npm run test:runtime-gate
```

`test:runtime-gate`는 서버·API TypeScript를 CommonJS 임시 산출물로 컴파일한 뒤 실제 Domain/API 함수를 실행하고, 결과 JSON·Markdown·브라우저 대시보드를 생성한다.

## 결과

- Event 15건: 전체 순위·중복·결정성 통과
- CurrentSituation 5건: 예상 1위와 반복순위 통과
- 요인 7종: 점수범위·기여도합·재정규화 통과
- 대응비교: 현재 확인사항 수와 비교항목 수 일치
- CQ 5문: 예상 Event·Passage·lineage 통과
- 보고서: 선택 Event·요인 7종·대응비교·우선확인지역 반영 통과
- 브라우저 회귀 대시보드: 5개 상황별 15행, CQ 5행, 보고서 5행 렌더링 통과

## 시험 중 보완한 사항

1. 유사사례 검색의 최대 반환건수를 10건에서 20건으로 확대하여 15개 Event 전체 순위를 시험할 수 있게 했다.
2. 유사사례 상세화면에 요인별 점수표와 현재 확인사항·과거 대응조치 비교표를 추가했다.
3. 보고서 API가 Seed 원문만 복사하지 않고, 실제 유사도 산정결과·요인별 점수·대응비교·근거를 포함하도록 변경했다.
4. CQ Mock 검색에서 한국어 조사·종결어를 정규화하고, 직접 질의어 일치가 없을 경우 행정구역·T코드·SchemaType 구조필터 결과를 사용하도록 보완했다.
5. CQ 패널의 Mock 검색 범위를 최대 15건으로 확대했다.

## 미완료 Gate

현재 실행환경의 내부 npm registry에서 React, Vite, `@playwright/test` 패키지가 404로 반환되어 `npm install`, React Production Build 및 기존 React 화면 Playwright E2E는 수행하지 못했다.

따라서 다음 항목은 패키지 설치가 가능한 실제 개발환경에서 재실행해야 한다.

```bash
npm install
npm run typecheck
npm run build
npm run test:e2e
npm run test:runtime-gate
```

이번 Gate의 PASS는 Core Domain/API와 독립 브라우저 회귀화면에 대한 결과이며, 실제 T3Q RAG 성능이나 공식 재난판단 정확도를 의미하지 않는다.
