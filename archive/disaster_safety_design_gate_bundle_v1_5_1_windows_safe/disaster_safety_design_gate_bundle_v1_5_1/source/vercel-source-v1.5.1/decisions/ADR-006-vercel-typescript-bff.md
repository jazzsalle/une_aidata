# ADR-006 Vercel TypeScript Functions 기반 POC BFF

## 결정
POC 런타임 백엔드는 ASP.NET Core 대신 TypeScript Vercel Functions를 사용한다. 프런트엔드와 Functions를 하나의 Vercel 프로젝트로 배포하며, UNE RAG·공공 API 인증정보는 서버측 환경변수로 보호한다.

## 이유
- 사용자 직접 유지관리 부담 최소화
- React와 동일 언어·계약 사용
- Vercel 단일 배포
- Claude Code 구현·수정 단순화

## POC 제약
- 초기 DB 없음: Static JSON/GeoJSON과 localStorage 사용
- 대용량 위성·Raster·SHP 처리는 사전 전처리
- 장시간 작업·승인·감사·다중사용자 이력은 운영전환 시 별도 Backend 검토

## 교체 가능성
OpenAPI, JSON Schema, Provider Port를 유지하므로 향후 .NET/Java/Node 서버로 교체할 수 있다.
