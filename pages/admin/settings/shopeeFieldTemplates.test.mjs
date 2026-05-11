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

console.log('shopeeFieldTemplates.test.mjs: ok');
