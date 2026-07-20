import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIGS = [
  'infra/nginx/mdv-site-production.conf',
  'infra/nginx/mdv-site-staging.conf',
];

for (const relativePath of CONFIGS) {
  const configPath = path.join(ROOT, relativePath);
  const config = fs.readFileSync(configPath, 'utf8');
  const legacyRuleIndex = config.indexOf('location ^~ /categoria-produtos/');
  const legacyStoreRuleIndex = config.indexOf('location ^~ /loja/');
  const productTrailingSlashRuleIndex = config.indexOf('location ~ ^/produto/([^/]+)/$');
  const productSeoRuleIndex = config.indexOf('location ~ ^/produto/([^/]+)$');
  const fallbackIndex = config.indexOf('try_files $uri $uri/ /index.html;');

  assert.notEqual(
    legacyRuleIndex,
    -1,
    `${relativePath} must handle legacy /categoria-produtos/ URLs before the SPA fallback`
  );
  assert.notEqual(fallbackIndex, -1, `${relativePath} must keep the SPA fallback`);
  assert.notEqual(
    legacyStoreRuleIndex,
    -1,
    `${relativePath} must handle every legacy /loja/ URL before the SPA fallback`
  );
  assert.notEqual(productTrailingSlashRuleIndex, -1, `${relativePath} must canonicalize trailing-slash product URLs`);
  assert.notEqual(productSeoRuleIndex, -1, `${relativePath} must keep the product SEO proxy`);
  assert.ok(
    legacyRuleIndex < fallbackIndex,
    `${relativePath} must place /categoria-produtos/ handling before index.html fallback`
  );
  assert.ok(
    legacyStoreRuleIndex < fallbackIndex,
    `${relativePath} must place /loja/ handling before index.html fallback`
  );
  assert.ok(productTrailingSlashRuleIndex < productSeoRuleIndex, `${relativePath} must normalize product URLs before proxying SEO HTML`);
  assert.match(
    config,
    /location \^~ \/categoria-produtos\/ \{[\s\S]*return 301 https:\/\/www\.mercadodovale\.com\.br\/produtos;\s*}/,
    `${relativePath} must permanently redirect legacy category URLs to the catalog`
  );
  assert.match(
    config,
    /location \^~ \/loja\/ \{[\s\S]*return 301 https:\/\/www\.mercadodovale\.com\.br\/produtos;\s*}/,
    `${relativePath} must permanently redirect legacy store URLs to the catalog`
  );
  assert.match(
    config,
    /location ~ \^\/produto\/\(\[\^\/\]\+\)\/\$ \{[\s\S]*return 301 https:\/\/www\.mercadodovale\.com\.br\/produto\/\$1;/,
    `${relativePath} must remove the legacy trailing slash before serving product SEO HTML`
  );
}
