import assert from 'node:assert/strict';
import {
  analyzeShopeeTitleSafety,
  alignShopeeAttributeDefaultsToOptions,
  applyShopeeTemplateToProduct,
  mergeShopeeAttributeDefaults,
  renderShopeeAttributeDefaultValue,
  renderShopeeTemplateText,
  resolveBestShopeeTemplate,
  resolveUniversalShopeeAttributeDefaults,
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

const powerSupplyTemplate = {
  id: 'power_supply',
  name: 'Fonte de Alimentacao',
  active: true,
  priority: 20,
  rules: {},
  titleTemplate: '{nome}',
  descriptionTemplate: '{descricao}',
  shopeeCategoryId: 100644,
  shopeeCategoryName: 'Computadores e Acessorios > Componentes > Fontes de Alimentacao',
  attributeDefaults: { '100001': 'Bivolt' },
  priceMode: 'product',
  stockMode: 'product',
  dimensionMode: 'product',
  gtinMode: 'product',
  dangerousTerms: [],
};

assert.equal(
  resolveBestShopeeTemplate({
    id: 'p-power',
    name: 'Fonte De Alimentacao 12V 3.5A bivolt Flex Industries MSG-H3500WR120',
    sku: 'MSG-H3500WR120',
    category_name: 'Fonte de Alimentacao',
    category_slug: 'fonte-de-alimentacao',
  }, [powerSupplyTemplate])?.id,
  'power_supply'
);

const applied = applyShopeeTemplateToProduct(sampleProduct, templates[1]);
assert.equal(applied.title, 'Capa compativel com iPhone 13 Cor:Vermelho');
assert.equal(applied.description, 'Descricao original do anuncio local.\n\nCom detalhes ja revisados.');
assert.equal(applied.stock, 2);
assert.equal(applied.gtinMode, 'no_gtin');
assert.deepEqual(applied.attributeValues, { '100134': 'TPU' });

const appliedFromNameOnly = applyShopeeTemplateToProduct({
  id: 'p2',
  name: 'Capa de Silicone para Redmi Note 14 4G Cor:Marrom',
  sku: 'CSRN144GMARR',
  specs: {},
  price_retail: 1999,
  stock_quantity: 1,
}, templates[1]);
assert.equal(appliedFromNameOnly.title, 'Capa compativel com Redmi Note 14 4G Cor:Marrom');

const appliedIphoneFromNameOnly = applyShopeeTemplateToProduct({
  id: 'p3',
  name: 'Capa Case transparente Iphone 15 Pro Max com MagSafe Magnetica',
  sku: 'CCTI15PMMM',
  specs: {},
  price_retail: 4999,
  stock_quantity: 2,
}, templates[1]);
assert.equal(appliedIphoneFromNameOnly.title, 'Capa compativel com Iphone 15 Pro Max');

const appliedIphoneLongerNameModel = applyShopeeTemplateToProduct({
  id: 'p4',
  name: 'Capa Case transparente IPhone 13 Pro Max com MagSafe Magnetica',
  sku: 'CCTI13PMMM',
  model: 'IPhone 13',
  specs: {},
  price_retail: 4999,
  stock_quantity: 2,
}, templates[1]);
assert.equal(appliedIphoneLongerNameModel.title, 'Capa compativel com IPhone 13 Pro Max');

assert.deepEqual(
  resolveUniversalShopeeAttributeDefaults([
    { id: 'phone_case', active: true, attributeDefaults: { 100134: 'TPU' } },
    { id: 'universal_defaults', active: true, attributeDefaults: { 101639: '{sku}', 101029: '1 Piece' } },
  ]),
  { 101639: '{sku}', 101029: '1 Piece' }
);

assert.equal(
  renderShopeeAttributeDefaultValue('{sku}', sampleProduct),
  'CAPA-IP13-VERM'
);

assert.equal(
  renderShopeeAttributeDefaultValue('{package_dimensions}', {
    package_length: 18,
    package_width: 11,
    package_height: 2,
  }),
  '18 x 11 x 2 cm'
);

assert.deepEqual(
  mergeShopeeAttributeDefaults({
    universalDefaults: { 100121: '3 meses', 101639: '{sku}' },
    fieldTemplateDefaults: { 100413: 'Novo', 100999: '1' },
    selectedTemplateDefaults: { 100121: '6 meses', 100370: 'Garantia do fornecedor' },
    modelDefaults: { 100121: '12 meses', 101219: 'Não' },
    product: sampleProduct,
  }),
  {
    100121: '12 meses',
    101639: 'CAPA-IP13-VERM',
    100413: 'Novo',
    100999: '1',
    100370: 'Garantia do fornecedor',
    101219: 'Não',
  }
);

assert.deepEqual(
  alignShopeeAttributeDefaultsToOptions([
    {
      attribute_id: 100121,
      label: 'Duração da Garantia',
      input_kind: 'select',
      attribute_value_list: [
        { value_id: 11, label: '3 Meses', raw_name: '3 Months', original_value_name: '3 Months' },
        { value_id: 12, label: '6 Meses', raw_name: '6 Months', original_value_name: '6 Months' },
      ],
    },
    {
      attribute_id: 101219,
      label: 'Produto personalizado',
      input_kind: 'select',
      attribute_value_list: [
        { value_id: 21, label: 'Não', raw_name: 'No', original_value_name: 'No' },
        { value_id: 22, label: 'Sim', raw_name: 'Yes', original_value_name: 'Yes' },
      ],
    },
    {
      attribute_id: 100105,
      label: 'Potência',
      input_kind: 'searchable',
      attribute_value_list: [],
    },
  ], {
    100121: '3 meses',
    101219: 'Não',
    100105: '40W',
  }),
  {
    100121: '3 Months',
    101219: 'No',
    100105: '40W',
  }
);

console.log('shopee template engine tests passed');
