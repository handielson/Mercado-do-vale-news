import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
        secure: false, // Permitir requisições mesmo com cert inválido em dev
        rewrite: (path) => path.replace(/^\/vps-proxy/, ''),
      },
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
