import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const products = readFileSync('services/products.ts', 'utf8');
const panel = readFileSync('components/settings/ModelPricesPanel.tsx', 'utf8');

assert.match(products, /const color = normalizeVariationSpec\(source\.specs\?\.color_id \|\| source\.specs\?\.color \|\| source\.specs\?\.cor\)/);
assert.match(products, /product\.specs\?\.color_id \|\| product\.specs\?\.color \|\| product\.specs\?\.cor/);
assert.match(panel, /const key = `\$\{ram\}\|\$\{storage\}\|\$\{color\}`/);
assert.match(panel, /\[v\.ram, v\.storage, v\.color\]/);

console.log('smartphone color price isolation checks passed');
