import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/sections/ProductPricing.tsx', 'utf8');

assert.match(source, /const selectedRam = watch\('specs\.ram'\)/);
assert.match(source, /const selectedStorage = watch\('specs\.storage'\)/);
assert.match(source, /if \(!modelId \|\| !selectedRam \|\| !selectedStorage\)/);
assert.match(source, /import \{ vpsApiService \} from '..\/..\/..\/services\/vpsApiService'/);
assert.match(source, /vpsApiService\.getProducts\(\{\s*model_id: modelId,\s*status: 'active',\s*limit: 500,\s*noCache: true,\s*\}\)/);
assert.match(source, /function matchesMemoryVariation\(product: any, selectedRam: string, selectedStorage: string\)/);
assert.match(source, /normalizeSpecValue\(specs\.ram\) === normalizeSpecValue\(selectedRam\)[\s\S]*normalizeSpecValue\(specs\.storage\) === normalizeSpecValue\(selectedStorage\)/);
assert.doesNotMatch(source, /specs->>color|selectedColor|specs\.color\).*stockAverages|stockAverages[\s\S]{0,120}specs\.color/);
assert.match(source, /\[modelId, selectedRam, selectedStorage\]/);

console.log('product pricing stock average variation static checks passed');
