import assert from 'node:assert/strict';
import { getBlingSkuPriceAutofill } from '../components/products/blingSkuPriceAutofill.js';

assert.deepEqual(getBlingSkuPriceAutofill(null), {});

assert.deepEqual(
  getBlingSkuPriceAutofill({ preco: 49.9, precoCusto: 21.35 }),
  { price_cost: 2135, price_retail: 4990 }
);

assert.deepEqual(
  getBlingSkuPriceAutofill({ preco: '149.99', precoCompra: '89.5' }),
  { price_cost: 8950, price_retail: 14999 }
);

assert.deepEqual(
  getBlingSkuPriceAutofill({ preco: 0, precoCusto: -10 }),
  {}
);

console.log('bling sku price autofill tests passed');
