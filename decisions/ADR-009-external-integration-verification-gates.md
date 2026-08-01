# ADR-009 외부연계 검증 게이트

## 결정

외부 API는 환경변수가 설정되었다는 이유만으로 정상 연계로 간주하지 않는다. 연계상태는 `fallback`, `pending`, `configured`, `verified`, `error`로 구분한다.

## 검증 게이트

1. **VWorld**: 키 존재 → `configured`; Preview/운영 도메인에서 Base·Satellite 타일 성공 → `verified`.
2. **기상청**: 서비스키 존재 → `configured`; 대상 격자의 RN1 등 공식 실황 응답 수신 → `verified`.
3. **홍수통제소**: Endpoint·키·공식 관측소 코드 존재 → `configured`; 수위 또는 유량 실응답과 관측시각 확인 → `verified`.
4. **UNE RAG**: URL·인증·검색경로 존재 → `configured`; OpenAPI 또는 실제 검색 응답을 정규화하고 문서명·페이지·Passage를 확인 → `verified`.

## 안전기준

- 하천기본계획 내부 산정지점 코드는 공공 API 관측소 코드가 아니다.
- 실연계 실패는 사용자 입력·Scenario·Seed Fallback으로 처리한다.
- 피해예측, NDMS 자동제출, CCTV, 지자체 관제 Context는 계속 제외한다.
