import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync('components/catalog/ModernProductCard.tsx', 'utf8');
const calculator = readFileSync('services/installmentCalculator.ts', 'utf8');
assert.match(calculator, /total: number;\s*\/\/ Total a pagar \(centavos\)/);
assert.match(card, /setInstallment12xTotal\(formatPrice\(plan12x\.total\)\)/);
assert.match(card, /total: formatPrice\(plan12x\.total\)/);
assert.equal((card.match(/Total no cartão:/g) || []).length, 2);

console.log('modern product card 12x final total checks passed');
