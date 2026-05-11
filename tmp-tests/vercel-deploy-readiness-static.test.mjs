import assert from 'node:assert/strict';
import fs from 'node:fs';

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');

assert.equal(packageJson.scripts?.build, 'vite build', 'Vercel build should use the Vite production build');
assert.ok(Array.isArray(vercel.rewrites), 'vercel.json should define rewrites');

const rewrites = vercel.rewrites.map((rewrite) => `${rewrite.source} -> ${rewrite.destination}`);

assert.ok(
  rewrites.some((rewrite) => rewrite.includes('/api/(.*) -> /api/$1')),
  'Vercel should route API functions under /api'
);

assert.ok(
  rewrites.some((rewrite) => rewrite.includes('/sitemap.xml -> /api/sitemap')),
  'Vercel should route sitemap.xml to the sitemap API'
);

assert.ok(
  rewrites.some((rewrite) => rewrite.includes('/produto/:slug -> /api/seo-produto?slug=:slug')),
  'Vercel should route product SEO pages to the SEO API'
);

assert.ok(
  rewrites.some((rewrite) => rewrite.includes('/((?!api/).*) -> /index.html')),
  'Vercel should fallback non-API routes to the SPA index'
);

assert.match(viteConfig, /defer-render-blocking-stylesheets/, 'Vite build should keep stylesheet deferral plugin');
assert.match(viteConfig, /VITE_VPS_SYNC_KEY/, 'Vite config should keep VPS sync key loading for local proxy workflows');

console.log('vercel deploy readiness static checks passed');
