import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createPrint3dPublicProxy } from './services/print3dPublicProxy.cjs';

export default defineConfig({
  root: path.resolve(__dirname, 'apps/print3d'),
  envDir: false,
  envPrefix: 'PRINT3D_PUBLIC_',
  publicDir: false,
  plugins: [react(), {
    name: 'print3d-version-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'VERSION.json',
        source: fs.readFileSync(path.resolve(__dirname, 'public/VERSION.json')),
      });
    },
  }, {
    name: 'print3d-local-api-disabled',
    configureServer(server) {
      server.middlewares.use(createPrint3dPublicProxy({apiOrigin:process.env.PRINT3D_LOCAL_API_ORIGIN}));
      server.middlewares.use((req, res, next) => {
        if (!/^\/(?:api(?:\/|$)|vps-proxy(?:\?|$))/.test(req.url || '')) return next();
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({error:'API da loja 3D não configurada neste ambiente local.'}));
      });
    },
  }],
  resolve: { alias: [
    { find: /^(?:.*\/)?authSession$/, replacement: path.resolve(__dirname, 'apps/print3d/publicAuth.ts') },
    { find: '@', replacement: path.resolve(__dirname) },
  ] },
  define: {
    'import.meta.env.VITE_PRINT3D_TURNSTILE_SITE_KEY': JSON.stringify(process.env.PRINT3D_PUBLIC_TURNSTILE_SITE_KEY || ''),
    'import.meta.env.VITE_PRINT3D_PUBLIC_ORIGIN': JSON.stringify(process.env.PRINT3D_PUBLIC_ORIGIN || 'https://www.3dmv.com.br'),
    'import.meta.env.VITE_FORCE_VPS_PROXY': JSON.stringify('0'),
    'import.meta.env.VITE_FORCE_LOCAL_VPS_PROXY': JSON.stringify('0'),
    'import.meta.env.VITE_VPS_SYNC_KEY': JSON.stringify(''),
    'import.meta.env.VITE_ALLOW_DIRECT_PUBLIC_VPS': JSON.stringify('1'),
  },
  css: { postcss: path.resolve(__dirname) },
  server: { host:'127.0.0.1', port:3002, strictPort:true, fs:{allow:[path.resolve(__dirname)]} },
  build: { outDir:path.resolve(__dirname,'dist-print3d'), emptyOutDir:true },
});
