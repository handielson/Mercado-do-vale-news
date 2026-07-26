import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverFiles = ['server.js', 'vps_server.js', 'vps_server.cjs'];

for (const file of serverFiles) {
  const source = readFileSync(file, 'utf8');
  assert.match(
    source,
    /pathname: '\/product\/202309\/categories'/,
    `${file} must use the official Get Categories endpoint`,
  );
  assert.match(
    source,
    /\/product\/202309\/categories\/\$\{encodeURIComponent\(categoryId\)\}\/rules/,
    `${file} must query category rules`,
  );
  assert.match(
    source,
    /\/product\/202309\/categories\/\$\{encodeURIComponent\(categoryId\)\}\/attributes/,
    `${file} must query category attributes`,
  );
  assert.match(
    source,
    /fastify\.get\('\/api\/tiktok-shop\/catalog\/categories', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must protect API category discovery`,
  );
  assert.match(
    source,
    /fastify\.get\('\/tiktok-shop\/catalog\/categories', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must expose the proxy-safe category discovery alias`,
  );
  assert.match(source, /category_version: 'v1'/, `${file} must use the BR category tree version`);
}

const service = readFileSync('services/tiktokShopService.ts', 'utf8');
assert.match(service, /getCategories\(keyword = ''\)/, 'frontend service must expose category discovery');
assert.match(service, /getCategoryReadiness\(categoryId: string\)/, 'frontend service must expose readiness');
assert.doesNotMatch(
  service,
  /['"]\/api\/tiktok-shop\/catalog/,
  'frontend service must use proxy-safe paths',
);

const component = readFileSync(
  'pages/admin/settings/components/TikTokShopProductPreparation.tsx',
  'utf8',
);
assert.match(component, /productService\.search\(query\)/, 'preparation UI must search local products');
assert.match(component, /tiktokShopService\.getCategories\(query\)/, 'preparation UI must search TikTok categories');
assert.match(component, /required_attributes/, 'preparation UI must display required category attributes');
assert.match(component, /Esta etapa e somente leitura/, 'preparation UI must identify the read-only phase');

console.log('TikTok Shop catalog readiness static checks ok');
