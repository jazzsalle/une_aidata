# 아키텍처 v0.2

```text
Browser: React/Vite/OpenLayers
  ├─ VWorld domain-restricted map key
  └─ /api/v1/*
        └─ TypeScript Vercel Functions
             ├─ server/domain: 상황·우선순위·Agent·보고서
             ├─ server/providers: UNE RAG·공공 API
             └─ data/seed/reference: POC fallback
```

## 상태저장
- 화면·상황뷰: localStorage
- Seed·공간자료: 정적 JSON/GeoJSON
- 서버 Function: 무상태

## 운영전환 지점
다중사용자 승인·감사로그·대용량 공간분석·폐쇄망 배포가 필요해지면 동일 OpenAPI를 구현하는 별도 Backend와 DB를 도입한다.
