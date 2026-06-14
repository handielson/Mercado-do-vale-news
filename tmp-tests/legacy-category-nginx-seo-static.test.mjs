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
  const legacyStorePageRuleIndex = config.indexOf('location ^~ /loja/page/');
  const fallbackIndex = config.indexOf('try_files $uri $uri/ /index.html;');

  assert.notEqual(
    legacyRuleIndex,
    -1,
    `${relativePath} must handle legacy /categoria-produtos/ URLs before the SPA fallback`
  );
  assert.notEqual(fallbackIndex, -1, `${relativePath} must keep the SPA fallback`);
  assert.notEqual(
    legacyStorePageRuleIndex,
    -1,
    `${relativePath} must handle legacy /loja/page/ URLs before the SPA fallback`
  );
  assert.ok(
    legacyRuleIndex < fallbackIndex,
    `${relativePath} must place /categoria-produtos/ handling before index.html fallback`
  );
  assert.ok(
    legacyStorePageRuleIndex < fallbackIndex,
    `${relativePath} must place /loja/page/ handling before index.html fallback`
  );
  assert.match(
    config,
    /location \^~ \/categoria-produtos\/ \{[\s\S]*return 301 https:\/\/www\.mercadodovale\.com\.br\/;\s*}/,
    `${relativePath} must permanently redirect legacy category URLs to the homepage`
  );
  assert.match(
    config,
    /location \^~ \/loja\/page\/ \{[\s\S]*return 301 https:\/\/www\.mercadodovale\.com\.br\/;\s*}/,
    `${relativePath} must permanently redirect legacy paginated store URLs to the homepage`
  );
}
