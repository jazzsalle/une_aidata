import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '');
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
