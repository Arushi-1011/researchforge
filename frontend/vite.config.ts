import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: '/researchforge/',
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        '/api': {
          // Inside Docker, VITE_API_PROXY_TARGET=http://api:8000.
          // On host, the published Docker API port is http://localhost:8001.
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8001',
          changeOrigin: true,
        },
      },
    },
  };
});
