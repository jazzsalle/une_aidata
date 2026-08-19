import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '');
  // 참조 자료(검색 색인·카탈로그·시군구별 GeoJSON)를 force-cache 로 받는데, 그러면 새로 배포해도
  // 브라우저가 옛 파일을 쓴다 — 실제로 색인을 고친 뒤 사용자 화면은 그대로였다. 빌드마다 바뀌는
  // 토큰을 URL 에 붙여 새 배포가 곧 새 URL 이 되게 한다. 같은 빌드 안에서는 캐시가 그대로 듣는다.
  // 토큰은 빌드 명령이 VITE_DATA_BUILD 쉘 환경변수로 넘긴다(apps/web/package.json build). config 안에서
  // process.env 나 define 으로 넣어 봤는데 envDir 을 루트로 돌린 이 구성에서는 치환되지 않았다 —
  // 쉘 env 는 확실히 먹는다. Vercel 은 VERCEL_GIT_COMMIT_SHA 를, 로컬은 빌드 시각을 쓴다.
  return {
    plugins: [react()],
    // .env 정본은 리포 루트다(.env.example 도 거기 있다). envDir 을 지정하지 않으면
    // Vite 는 apps/web 만 보므로 루트 .env 의 VITE_* 가 import.meta.env 에 들어오지 않는다.
    // 위 loadEnv 는 프록시 target 용이라 import.meta.env 에는 영향을 주지 않는다.
    envDir: '../../',
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.API_BASE_URL || 'http://localhost:5080',
          changeOrigin: true,
        },
      },
    },
  };
});
