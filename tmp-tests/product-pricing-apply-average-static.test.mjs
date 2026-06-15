import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pricing = readFileSync('components/products/sections/ProductPricing.tsx', 'utf8');
assert.match(pricing, /applyStockAveragesToPrices/, 'pricing form must expose an action to reuse stock averages');
assert.match(pricing, /setValue\('price_cost',\s*stockAverages\.avg_cost/, 'average cost must fill price_cost');
assert.match(pricing, /setValue\('price_retail',\s*stockAverages\.avg_retail/, 'average retail must fill price_retail');
assert.match(pricing, /setValue\('price_reseller',\s*stockAverages\.avg_reseller/, 'average reseller must fill price_reseller');
assert.match(pricing, /setValue\('price_wholesale',\s*stockAverages\.avg_wholesale/, 'average wholesale must fill price_wholesale');
assert.match(pricing, /Usar médias/, 'pricing form must render the reuse averages button');

const currencyInput = readFileSync('components/ui/CurrencyInput.tsx', 'utf8');
assert.match(currencyInput, /e\.target\.select\(\)/, 'currency fields must select all text when focused for quick replacement');
