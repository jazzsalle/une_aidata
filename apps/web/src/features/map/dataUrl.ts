/** 참조 자료 URL 에 빌드 토큰을 붙인다.
 *
 *  자료 파일은 `cache: 'force-cache'` 로 받아 같은 세션에서 다시 받지 않는다. 그 대신 새로 배포해도
 *  브라우저가 옛 파일을 계속 쓰는 문제가 생긴다 — 검색 색인을 고친 뒤 사용자 화면은 그대로였다.
 *  빌드마다 바뀌는 토큰을 쿼리로 붙이면 새 배포가 곧 새 URL 이라 캐시가 자연히 갈린다.
 *  토큰은 vite.config.ts 의 define 에서 온다. */
// 토큰은 vite.config.ts 의 define 이 import.meta.env 에 넣는다. 전역 식별자 define 은 Vite 8 에서
// 치환되지 않은 채 번들에 남았다 — import.meta.env 경로는 확실히 치환된다. 없으면(테스트 등) 'dev'.
const BUILD_TOKEN: string = import.meta.env.VITE_DATA_BUILD ?? 'dev';

export function dataUrl(path: string): string {
  return path + (path.includes('?') ? '&' : '?') + 'v=' + BUILD_TOKEN;
}
