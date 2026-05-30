import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const service = readFileSync(resolve('services/products.ts'), 'utf8');
const form = readFileSync(resolve('components/products/ProductForm.tsx'), 'utf8');
const formPage = readFileSync(resolve('pages/admin/products/ProductFormPage.tsx'), 'utf8');

assert(
  /interface\s+VariationPriceAdjustment/.test(service),
  'products service must expose variation price adjustment metadata',
);

assert(
  /async\s+function\s+syncVariationPrices\s*\(/.test(service),
  'products service must synchronize prices across same model/RAM/storage variation',
);

assert(
  /vpsApiService\.getProducts\(\{\s*model_id:[\s\S]*status:\s*'active'[\s\S]*noCache:\s*true/.test(service),
  'variation price synchronization must load active products for the same model from VPS',
);

assert(
  /price_retail:\s*source\.price_retail[\s\S]*price_reseller:\s*source\.price_reseller[\s\S]*price_wholesale:\s*source\.price_wholesale/.test(service),
  'variation price synchronization must apply the submitted sale prices to peers',
);

assert(
  /bulkSyncPricesStock\(updates\)/.test(service),
  'variation price synchronization must update peers through VPS bulk price endpoint',
);

assert(
  /priceAdjustment\s*=\s*await\s+syncVariationPrices\(savedProduct\)/.test(service),
  'create/update must attach variation price adjustment metadata after saving',
);

assert(
  /showVariationPriceAdjustmentToast/.test(form),
  'ProductForm must show a user-facing warning when variation prices are adjusted',
);

assert(
  /toast\.warning\([\s\S]*Preços padronizados/.test(form),
  'ProductForm warning must explicitly mention standardized prices',
);

assert(
  /Promise<Product \| void>/.test(formPage),
  'ProductFormPage must return the saved product metadata to ProductForm',
);

console.log('Variation price synchronization and warning are wired');
