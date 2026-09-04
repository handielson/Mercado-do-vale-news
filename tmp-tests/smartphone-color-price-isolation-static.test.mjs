import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const products = readFileSync('services/products.ts', 'utf8');
const panel = readFileSync('components/settings/ModelPricesPanel.tsx', 'utf8');

assert.match(products, /smartphonePriceGroups\.reference\(source\.model_id, source\)/);
assert.match(panel, /smartphonePriceGroups\.save\(group,/);
assert.doesNotMatch(panel, /key: 'price_cost'/, 'o controle de preços de venda não deve oferecer alteração coletiva de custo');
assert.match(panel, /unit_costs/, 'custos devem ser exibidos por aparelho');

console.log('smartphone shared sale price and individual cost checks passed');
