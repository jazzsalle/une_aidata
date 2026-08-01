# Provider 전환 적합성 매트릭스 — Source v1.5

## 목적

Mock/Seed에서 T3Q 또는 공공 Open API로 전환할 때 화면과 보고서를 바꾸지 않고 Adapter/Mapper만 교체할 수 있는지 검증한다.

## 전환 단계

1. `DRAFT`: Endpoint·인증·대표응답이 없거나 계약 미검증
2. `FIXTURE_VALIDATED`: 제공기관 대표응답을 공통 Domain Model로 변환하고 계약시험 통과
3. `SHADOW_TESTED`: Mock 기본운영과 병행하여 실제 Provider 결과를 비교하되 사용자 기본결과에는 미사용
4. `SELECTABLE`: 운영자가 환경변수로 선택 가능하며 Fallback·출처배지·보고서 회귀시험 통과
5. `DEFAULT`: 승인된 Provider를 기본값으로 사용

## 도메인별 필수 검증

| Domain | 최소 검증내용 | 승격 차단조건 |
|---|---|---|
| Event | event_id, T코드, 지역·기간, 조건, 피해·대응·복구, 요인별 유사도, Passage·lineage | Evidence 누락, Event/Passage 식별자 불일치, 사건 유사도와 검색 관련도 혼합 |
| Risk | 위험지구, 위험요인, 임계값 값·단위·근거, 저감대책, geometry_ref | 임계값 단위·근거 누락, 계획 버전 미구분 |
| Observation | 관측소 코드·좌표·종류, 값·단위·시각·품질, 경보기준, 출처 | 관측시각·단위 누락, 관측소 미식별, 최신성 판단 불가 |
| Spatial | object/layer ID, Geometry, CRS, 속성, 행정코드, 재난코드, 기준일, 근거 | CRS/Geometry 오류, Mock 도형을 공식 도형으로 표시 |

## 혼합 Provider 원칙

- Event·Risk는 T3Q, Observation은 Open API, Spatial은 T3Q/공공 GIS/Mock의 혼합운영을 허용한다.
- 모든 응답은 공통 출처·상태·품질 메타데이터를 포함한다.
- 동일 객체 충돌 시 공식성, 기준시각, 검증상태, 설계된 우선순위를 적용하고 어느 값이 선택됐는지 기록한다.
- 외부 Provider 장애 시 Fallback은 허용하지만 실제값처럼 은폐하지 않는다.
- 화면, 지도, 보고서에는 Provider와 데이터상태를 동일하게 표시한다.

## 실행

```bash
npm run test:provider-conformance
```

결과는 `tests/provider/provider_conformance_result.json`과 `tests/provider/PROVIDER_CONFORMANCE_RESULT.md`에 생성된다.
