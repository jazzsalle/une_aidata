# 보안·접근성

## 보안
- VWorld·공공 API·UNE RAG 비밀정보는 Vercel 서버 환경변수로 관리한다.
- 브라우저에 노출 가능한 키와 서버 전용 비밀정보를 구분한다.
- 보고서 초안 localStorage에는 민감 개인정보를 저장하지 않는다.
- 외부 URL, Markdown, Agent 응답은 출력 시 안전하게 이스케이프한다.

## 웹 접근성 기준
- 국가표준 KWCAG 2.2와 WCAG 2.2 AA를 기준으로 구현한다.
- 페이지 구조는 header, nav, main, footer landmark와 heading 계층으로 표현한다.
- 상위 업무는 실제 링크와 URL로 이동하며, 현재 링크에 aria-current를 적용한다.
- 라우트 변경 시 document.title을 변경하고 h1으로 초점을 이동한다.
- 본문 바로가기 링크를 제공한다.
- 지도는 유일한 정보수단이 아니며 우선 확인지역·유사사례·절차를 텍스트로 제공한다.
- 실제 tab 위젯은 aria-selected, aria-controls와 Left/Right/Home/End를 지원한다.
- 입력은 보이는 label, 오류 식별, 오류 제안, 상태메시지를 제공한다.
- target 크기는 WCAG 2.2 최소 24 CSS px를 넘고 프로젝트 내부 목표는 44px로 한다.
- drag 조작은 버튼·range·좌우 비교 등 단일 포인터 대체수단을 제공한다.
- prefers-reduced-motion을 존중한다.
- 자동검사와 키보드·화면낭독기 사용자 과업시험을 병행한다.
