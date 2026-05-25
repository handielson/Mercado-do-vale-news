import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/sections/ProductPricing.tsx', 'utf8');

assert.match(source, /const selectedRam = watch\('specs\.ram'\)/);
assert.match(source, /const selectedStorage = watch\('specs\.storage'\)/);
assert.match(source, /if \(!modelId \|\| !selectedRam \|\| !selectedStorage\)/);
assert.match(source, /\.eq\('model_id', modelId\)[\s\S]*\.eq\('specs->>ram', selectedRam\)[\s\S]*\.eq\('specs->>storage', selectedStorage\)/);
assert.match(source, /\[modelId, selectedRam, selectedStorage\]/);

console.log('product pricing stock average variation static checks passed');
