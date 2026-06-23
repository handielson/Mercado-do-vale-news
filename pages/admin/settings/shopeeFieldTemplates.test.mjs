import assert from 'node:assert/strict';
import {
  buildShopeeTemplateAttributeValues,
  extractPhoneModel,
  findShopeeTemplateCategory,
  resolveShopeeFieldTemplate,
} from './shopeeFieldTemplates.js';

const product = {
  name: 'Capa Case De Silicone Aveludada Para Redmi Note 12 Pro Plus Cor: Verde claro',
  sku: 'CCRN12PP13',
  brand: 'Xiaomi',
  category_slug: 'capas-celular',
};

const template = resolveShopeeFieldTemplate(product);
assert.equal(template?.id, 'phone_case');
assert.equal(template?.category_id, 100490);
assert.equal(extractPhoneModel(product), 'Redmi Note 12 Pro Plus');

const powerSupplyProduct = {
  name: 'Fonte De Alimentacao 12V 2.5A bivolt 30W Pino agulha NBS30G120250VB',
  sku: 'NBS30G120250VB',
  brand: 'Importado',
  category_slug: 'fontes-alimentacao',
};

const powerSupplyTemplate = resolveShopeeFieldTemplate(powerSupplyProduct);
assert.equal(powerSupplyTemplate?.id, 'power_supply');
assert.equal(powerSupplyTemplate?.category_id, 101803);
assert.deepEqual(powerSupplyTemplate?.strict_attribute_ids, [100121, 100370, 101029, 101219, 102292]);

const attrs = [
  {
    attribute_id: 100134,
    label: 'Material',
    attribute_value_list: [{ label: 'TPU', raw_name: 'TPU', original_value_name: 'TPU', value_id: 5502 }],
  },
  {
    attribute_id: 100488,
    label: 'Marca de Celular Aplicavel',
    attribute_value_list: [{ label: 'Xiaomi', raw_name: 'Xiaomi', original_value_name: 'Xiaomi', value_id: 2916 }],
  },
  {
    attribute_id: 100490,
    label: 'Modelo do Celular',
    attribute_value_list: [],
  },
  {
    attribute_id: 100470,
    label: 'Recursos da Capa',
    attribute_value_list: [{ label: 'Resistente à Água', raw_name: 'Water Resistant', original_value_name: 'Water Resistant', value_id: 2855 }],
  },
];

assert.deepEqual(buildShopeeTemplateAttributeValues(attrs, product, template), {
  100134: 'TPU',
  100488: 'Xiaomi',
  100490: 'Redmi Note 12 Pro Plus',
  100470: 'Resistente à Água',
});

assert.equal(
  findShopeeTemplateCategory([{ category_id: 1, children: [{ category_id: 100490, display_category_name: 'Capas' }] }], template)?.category_id,
  100490
);

assert.deepEqual(buildShopeeTemplateAttributeValues([
  {
    attribute_id: 100121,
    label: 'Duracao da Garantia',
    attribute_value_list: [{ label: '3 Meses', raw_name: '3 Months', original_value_name: '3 Months', value_id: 799 }],
  },
  {
    attribute_id: 100105,
    label: 'Potencia',
    attribute_value_list: [],
  },
  {
    attribute_id: 101029,
    label: 'Tamanho do Pacote',
    attribute_value_list: [],
  },
  {
    attribute_id: 101219,
    label: 'Produto personalizado',
    attribute_value_list: [{ label: 'Nao', raw_name: 'No', original_value_name: 'No', value_id: 7222 }],
  },
  {
    attribute_id: 102292,
    label: 'Numero de registro INMETRO',
    attribute_value_list: [{ label: 'N/A - NBR nao aplicavel', raw_name: 'N/A – NBR not applicable', original_value_name: 'N/A – NBR not applicable', value_id: 17633 }],
  },
], powerSupplyProduct, powerSupplyTemplate), {
  100121: '3 Meses',
  101029: '1 Piece',
  101219: 'Nao',
  102292: 'N/A - NBR nao aplicavel',
});

console.log('shopeeFieldTemplates.test.mjs: ok');
