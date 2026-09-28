import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync('components/catalog/ProductDeadlineRequest.tsx', 'utf8');
const print3dProduct = readFileSync('pages/store/Print3dProductPage.tsx', 'utf8');
const publicProduct = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(form, /initialQuantity == null\s*\? ''/, 'the desired quantity must start blank when no explicit quantity was chosen');
assert.match(form, /placeholder="Informe a quantidade"/, 'the blank field must explain what the customer should enter');
assert.match(form, /quantity: Number\(quantity\)/, 'the request payload must convert the completed field to a number');
assert.doesNotMatch(print3dProduct, /initialQuantity=\{Math\.max\(1, stock \+ 1\)\}/, '3DMV must not prefill desired quantity from available stock');
assert.doesNotMatch(publicProduct, /initialQuantity=\{Math\.max\(1, Number\(product\.stock_quantity/, 'Mercado do Vale must not prefill desired quantity from available stock');

console.log('Deadline request blank quantity checks passed');
