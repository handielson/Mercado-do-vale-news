import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPriceTierRange } from '../components/products/productCardStatus.js';

// Card da família no modo Cartões: preços = faixa das variações (o pai não tem preço e mostrava R$ 0,00).
test('faixa ignora variações sem preço', () => {
  const variants = [{ price_retail: 139900, price_reseller: 0 }, { price_retail: 129900, price_reseller: 120000 }, { price_retail: 0 }];
  assert.equal(getPriceTierRange(variants, 'price_retail'), 'R$ 1.299,00 a R$ 1.399,00');
  assert.equal(getPriceTierRange(variants, 'price_reseller'), 'R$ 1.200,00');
  assert.equal(getPriceTierRange(variants, 'price_wholesale'), null);
  assert.equal(getPriceTierRange([], 'price_retail'), null);
});

test('card e lista ligados', () => {
  const card = fs.readFileSync(new URL('../components/products/ProductCard.tsx', import.meta.url), 'utf8');
  const list = fs.readFileSync(new URL('../components/products/ProductList.tsx', import.meta.url), 'utf8');
  assert.match(list, /forceDetailsExpanded=\{selectionMode\}\s*priceVariants=\{variants\}/);
  assert.match(card, /priceVariants\?\.length \? getPriceTierRange\(priceVariants, field\) : undefined/);
  assert.match(card, /familyRange === null\s*\? <p className="text-xs font-semibold text-amber-700">Sem preço<\/p>/);
});
