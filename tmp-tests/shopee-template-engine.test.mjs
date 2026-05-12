import assert from 'node:assert/strict';
import {
  analyzeShopeeTitleSafety,
  applyShopeeTemplateToProduct,
  renderShopeeTemplateText,
  resolveBestShopeeTemplate,
} from '../services/shopeeTemplateEngine.ts';

const sampleProduct = {
  id: 'p1',
  name: 'Capa para Iphone 13 Cor:Vermelho',
  sku: 'CAPA-IP13-VERM',
  brand: 'Apple',
  model: 'iPhone 13',
  category_id: 'cases',
  category_slug: 'capas',
  description: 'Descricao original do anuncio local.\n\nCom detalhes ja revisados.',
  specs: {
    color: 'Vermelho',
    ram: '4GB',
    storage: '128GB',
  },
  price_retail: 1490,
  stock_quantity: 3,
  eans: ['SEM GTIN'],
};

const dangerousRules = [
  {
    id: 'r1',
    term: 'Capa para iPhone',
    replacement: 'Capa compativel com iPhone',
    level: 'warning',
    active: true,
  },
  {
    id: 'r2',
    term: 'Original',
    replacement: '',
    level: 'block',
    active: true,
  },
];

const templates = [
  {
    id: 'charger',
    name: 'Carregador',
    active: true,
    priority: 5,
    rules: { nameIncludes: ['carregador'] },
    titleTemplate: 'Carregador compativel',
    descriptionTemplate: '',
    attributeDefaults: {},
    priceMode: 'product',
    stockMode: 'product',
    dimensionMode: 'product',
    gtinMode: 'product',
    dangerousTerms: [],
  },
  {
    id: 'phone_case',
    name: 'Capa de celular',
    active: true,
    priority: 10,
    rules: { categoryId: 'cases', nameIncludes: ['capa'], skuIncludes: ['CAPA'], brandIncludes: ['apple'] },
    titleTemplate: 'Capa compativel com {modelo} Cor:{cor}',
    descriptionTemplate: '{nome}\nProduto compativel.',
    shopeeCategoryId: 100490,
    shopeeCategoryName: 'Capas',
    attributeDefaults: { '100134': 'TPU' },
    priceMode: 'product',
    stockMode: 'fixed',
    fixedStock: 2,
    dimensionMode: 'fixed',
    weightKg: 0.2,
    packageLength: 20,
    packageWidth: 15,
    packageHeight: 3,
    gtinMode: 'no_gtin',
    dangerousTerms: dangerousRules,
  },
];

assert.equal(
  renderShopeeTemplateText('Capa compativel com {modelo} Cor:{cor}', sampleProduct),
  'Capa compativel com iPhone 13 Cor:Vermelho'
);

const warningResult = analyzeShopeeTitleSafety('Capa para iPhone 13', dangerousRules);
assert.equal(warningResult.hasWarnings, true);
assert.equal(warningResult.hasBlocks, false);
assert.equal(warningResult.suggestedTitle, 'Capa compativel com iPhone 13');

const blockResult = analyzeShopeeTitleSafety('Capa Original para iPhone', dangerousRules);
assert.equal(blockResult.hasBlocks, true);

assert.equal(resolveBestShopeeTemplate(sampleProduct, templates)?.id, 'phone_case');

const applied = applyShopeeTemplateToProduct(sampleProduct, templates[1]);
assert.equal(applied.title, 'Capa compativel com iPhone 13 Cor:Vermelho');
assert.equal(applied.description, 'Descricao original do anuncio local.\n\nCom detalhes ja revisados.');
assert.equal(applied.stock, 2);
assert.equal(applied.gtinMode, 'no_gtin');
assert.deepEqual(applied.attributeValues, { '100134': 'TPU' });

console.log('shopee template engine tests passed');
