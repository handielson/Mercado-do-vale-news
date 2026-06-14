import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildProductClonePrefill, getProductCloneState } from '../services/productClonePrefill.js';

const product = {
  id: 'product-1',
  name: 'Realme C85 Pro',
  sku: 'RX85G12512P',
  model_id: 'model-1',
  brand: 'Realme',
  model: 'Realme C85 Pro',
  category_id: 'smartphones',
  stock_quantity: 1,
  price_cost: 223500,
  price_retail: 269900,
  eans: '["7891234567890"]',
  images: '["https://cdn.example.com/poco.jpg"]',
  keywords: '["poco", "xiaomi"]',
  kits: null,
  tags: 'smartphone,xiaomi',
  specs: {
    imei1: '866132080815481',
    imei2: '866132080815479',
    serial: '73749;66QD01217',
    color: 'Preto',
    ram: '12GB',
    storage: '512GB',
    version: 'Global',
  },
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-02T00:00:00.000Z',
};

const prefill = buildProductClonePrefill(product);

assert.equal(prefill.id, undefined, 'clone nao deve carregar id do produto original');
assert.equal(prefill.created_at, undefined, 'clone nao deve carregar created_at');
assert.equal(prefill.updated_at, undefined, 'clone nao deve carregar updated_at');
assert.equal(prefill.name, product.name, 'clone deve manter nome');
assert.equal(prefill.sku, product.sku, 'clone deve manter SKU do grupo');
assert.equal(prefill.model_id, product.model_id, 'clone deve manter modelo');
assert.equal(prefill.price_cost, product.price_cost, 'clone deve manter custo');
assert.equal(prefill.price_retail, product.price_retail, 'clone deve manter preco');
assert.deepEqual(prefill.eans, ['7891234567890'], 'clone deve normalizar eans para array');
assert.deepEqual(prefill.images, ['https://cdn.example.com/poco.jpg'], 'clone deve normalizar images para array');
assert.deepEqual(prefill.keywords, ['poco', 'xiaomi'], 'clone deve normalizar keywords para array');
assert.deepEqual(prefill.kits, [], 'clone deve normalizar kits ausente/nulo para array vazio');
assert.deepEqual(prefill.tags, ['smartphone', 'xiaomi'], 'clone deve normalizar tags separadas por virgula para array');
assert.equal(prefill.specs.color, 'Preto', 'clone deve manter cor');
assert.equal(prefill.specs.ram, '12GB', 'clone deve manter RAM');
assert.equal(prefill.specs.storage, '512GB', 'clone deve manter armazenamento');
assert.equal(prefill.specs.imei1, '', 'clone deve limpar IMEI 1');
assert.equal(prefill.specs.imei2, '', 'clone deve limpar IMEI 2');
assert.equal(prefill.specs.serial, '', 'clone deve limpar serial');

assert.deepEqual(getProductCloneState(product), { cloneProduct: prefill }, 'estado de navegacao deve expor cloneProduct');

const rawProduct = {
  id: 'raw-1',
  name: 'Poco X8 Pro 5G',
  sku: 'PX85G8512P',
  eans: null,
  alternative_eans: '["7890000000001"]',
  ean: '7890000000002',
  images: null,
  product_images: '["https://cdn.example.com/raw-1.jpg"]',
  image_url: 'https://cdn.example.com/raw-main.jpg',
  image: 'https://cdn.example.com/raw-main.jpg',
  specs: JSON.stringify({
    imei1: '866132080815481',
    imei2: '866132080815479',
    serial: '73749;66QD01217',
    color: 'Preto',
  }),
};

const rawPrefill = buildProductClonePrefill(rawProduct);

assert.deepEqual(
  rawPrefill.eans,
  ['7890000000001', '7890000000002'],
  'clone deve recuperar EAN de campos alternativos do Bling',
);
assert.deepEqual(
  rawPrefill.images,
  ['https://cdn.example.com/raw-1.jpg', 'https://cdn.example.com/raw-main.jpg'],
  'clone deve recuperar imagens de campos alternativos sem duplicar URL',
);
assert.equal(rawPrefill.specs.color, 'Preto', 'clone deve normalizar specs em JSON string');
assert.equal(rawPrefill.specs.imei1, '', 'clone bruto deve limpar IMEI 1');
assert.equal(rawPrefill.specs.imei2, '', 'clone bruto deve limpar IMEI 2');
assert.equal(rawPrefill.specs.serial, '', 'clone bruto deve limpar serial');

const aggregatorPage = readFileSync(new URL('../pages/admin/products/ModelProductAggregatorPage.tsx', import.meta.url), 'utf8');
assert.match(aggregatorPage, /getProductCloneState/, 'painel do modelo deve usar o helper de clone');
assert.match(aggregatorPage, /Adicionar igual/, 'atalhos por SKU devem mostrar botao Adicionar igual');

const formPage = readFileSync(new URL('../pages/admin/products/ProductFormPage.tsx', import.meta.url), 'utf8');
assert.match(formPage, /cloneProduct/, 'pagina de novo produto deve aceitar cloneProduct pelo estado de navegacao');
