import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const source = readFileSync('utils/cartShareUtils.ts', 'utf8');

assert.match(
  source,
  /const ALLOWED_VARIATION_KEYS = new Set\(/,
  'cart share budget must whitelist real variation keys before adding "disponiveis" lines'
);

for (const key of [
  'dimensions.depth',
  'dimensions.height',
  'dimensions.width',
  'meta_descriptions',
  'meta_titles',
  'slugs',
  'weight_kgs',
]) {
  assert.match(
    source,
    new RegExp(`'${key.replace('.', '\\.')}'`),
    `technical/SEO key "${key}" must be ignored in WhatsApp budget variations`
  );
}

assert.match(
  source,
  /if \(!ALLOWED_VARIATION_KEYS\.has\(normalizedKey\)\) continue;/,
  'cart share budget must skip non-variation specs instead of titleizing every spec key'
);

console.log('cart share variation filter static test ok');
