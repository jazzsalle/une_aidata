/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_SEED_DIRECTLY?: string;
  readonly VITE_VWORLD_MAP_KEY?: string;
  /** VWorld 키에 등록된 서비스 URL. 미설정 시 window.location.origin 을 쓴다.
   *  로컬 개발에서는 등록 도메인을 넣어야 데이터/WMS 계열 호출이 통과한다. */
  readonly VITE_VWORLD_SERVICE_DOMAIN?: string;
  /** 빌드마다 바뀌는 토큰. 참조 자료 URL 에 붙여 새 배포 뒤 브라우저 캐시가 갈리게 한다(vite.config.ts define). */
  readonly VITE_DATA_BUILD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
