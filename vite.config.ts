import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'https://mercado-do-vale-news.vercel.app',
          changeOrigin: true,
          secure: false,
        },
        '/vps-proxy': {
          target: 'https://api.xiaomipetrolina.com.br',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/vps-proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-sync-key', env.VITE_VPS_SYNC_KEY || '');
            });
          },
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
