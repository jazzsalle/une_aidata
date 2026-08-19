// vite build 를 VITE_DATA_BUILD 와 함께 돈다. 참조 자료 URL 에 붙는 캐시 토큰이다.
// Vercel 은 VERCEL_GIT_COMMIT_SHA 를 주므로 앞 8자, 로컬은 빌드 시각(base36). cross-env 없이 Windows 에서도 돈다.
import { spawnSync } from 'node:child_process';
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 8);
const token = sha || Date.now().toString(36);
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], {
  stdio: 'inherit', shell: process.platform === 'win32',
  env: { ...process.env, VITE_DATA_BUILD: token },
});
process.exit(result.status ?? 1);
