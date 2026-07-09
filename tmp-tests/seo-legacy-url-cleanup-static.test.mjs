import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const robots = fs.readFileSync(path.join(ROOT, 'public/robots.txt'), 'utf8');
assert.match(
  robots,
  /^Sitemap: https:\/\/www\.mercadodovale\.com\.br\/sitemap\.xml$/m,
  'robots.txt must advertise the canonical www sitemap URL'
);
assert.doesNotMatch(
  robots,
  /^Sitemap: https:\/\/mercadodovale\.com\.br\/sitemap\.xml$/m,
  'robots.txt must not advertise the non-www sitemap URL'
);

const configs = [
  'infra/nginx/mdv-site-production.conf',
  'infra/nginx/mdv-site-staging.conf',
];

for (const relativePath of configs) {
  const config = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  const fallbackIndex = config.indexOf('try_files $uri $uri/ /index.html;');

  assert.match(
    config,
    /if \(\$args ~\* "\(\^\|\&\)\(add-to-cart\|add-to-compare\)="\) \{\s*return 301 https:\/\/www\.mercadodovale\.com\.br\$uri;\s*}/,
    `${relativePath} must strip legacy WooCommerce cart/compare query parameters`
  );

  for (const legacyPrefix of ['/wp-content/', '/tags-produtos/', '/variacoes/']) {
    const rule = `location ^~ ${legacyPrefix}`;
    const ruleIndex = config.indexOf(rule);

    assert.notEqual(ruleIndex, -1, `${relativePath} must handle ${legacyPrefix} before SPA fallback`);
    assert.ok(ruleIndex < fallbackIndex, `${relativePath} must place ${legacyPrefix} before SPA fallback`);
  }

  assert.match(
    config,
    /location \^~ \/wp-content\/ \{\s*return 410;\s*}/,
    `${relativePath} must return 410 for legacy WordPress asset/plugin URLs`
  );
  assert.match(
    config,
    /location \^~ \/tags-produtos\/ \{\s*return 410;\s*}/,
    `${relativePath} must return 410 for legacy WooCommerce tag URLs`
  );
  assert.match(
    config,
    /location \^~ \/variacoes\/ \{\s*return 410;\s*}/,
    `${relativePath} must return 410 for legacy WooCommerce variation URLs`
  );
}
