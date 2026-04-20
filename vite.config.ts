import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import * as fs from 'fs';

export default defineConfig(({ mode }) => {
  // Load env from .env.local directly to ensure VITE_VPS_SYNC_KEY is available
  let syncKey = '';
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const keyMatch = envContent.match(/VITE_VPS_SYNC_KEY=(.+)/);
      if (keyMatch && keyMatch[1]) {
        syncKey = keyMatch[1].trim();
        console.log('[Vite Config] ✅ Loaded VITE_VPS_SYNC_KEY from .env.local');
      }
    }
  } catch (e) {
    console.error('[Vite Config] ❌ Failed to load VITE_VPS_SYNC_KEY:', e.message);
  }

  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'https://www.mercadodovale.com.br';
  const shopeeApiProxyTarget = env.VITE_SHOPEE_API_PROXY_TARGET || apiProxyTarget;

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/shopee-catalog': {
          target: shopeeApiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/vps-proxy': {
          target: 'https://api.xiaomipetrolina.com.br',
          router: () => 'https://api.xiaomipetrolina.com.br',
          changeOrigin: true,
          secure: false,
          rewrite: (pathStr) => {
            // Extract the ?path= query parameter and decode it
            try {
              const url = new URL(`http://localhost${pathStr}`);
              const targetPath = url.searchParams.get('path');
              if (targetPath) {
                return decodeURIComponent(targetPath);
              }
            } catch (e) {
              console.error('[Vite Proxy] Failed to parse path:', pathStr, e);
            }
            // Fallback: just remove /vps-proxy prefix
            return pathStr.replace(/^\/vps-proxy/, '');
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Get the sync key (from .env.local or fallback)
              const key = syncKey || env.VITE_VPS_SYNC_KEY || '';
              
              if (!key) {
                console.warn('[Vite Proxy] ⚠️ x-sync-key is empty! Check .env.local');
              } else {
                console.log('[Vite Proxy] ✅ Adding x-sync-key header for', req.method, req.url);
              }
              
              proxyReq.setHeader('x-sync-key', key);
              
              // Ensure proper headers for POST/PUT/PATCH
              if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
                if (!proxyReq.getHeader('content-type')) {
                  proxyReq.setHeader('content-type', 'application/json');
                }
              }
            });

            proxy.on('proxyRes', (proxyRes, req, res) => {
              // Log response status for debugging
              if (proxyRes.statusCode >= 400) {
                console.warn(`[Vite Proxy] ⚠️ ${req.method} ${req.url} → ${proxyRes.statusCode}`);
              }
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
