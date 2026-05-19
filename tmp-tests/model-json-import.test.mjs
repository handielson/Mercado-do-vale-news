import assert from 'node:assert/strict';
import {
  buildModelImportPrompt,
  normalizeModelImportPayload,
  parseModelImportJson,
} from '../components/settings/modelJsonImport.js';

const brands = [
  { id: 'brand-xiaomi', name: 'Xiaomi' },
  { id: 'brand-samsung', name: 'Samsung' },
];

const categories = [
  { id: 'cat-smartphones', name: 'Smartphones', slug: 'smartphones' },
];

const customFields = [
  { key: 'ram', label: 'Memoria RAM', field_type: 'select' },
  { key: 'storage', label: 'Armazenamento', field_type: 'select' },
  { key: 'version', label: 'Versao', field_type: 'table_relation' },
  { key: 'screen_size', label: 'Tamanho da Tela', field_type: 'text' },
];

const choiceOptions = {
  ram: [
    { value: '4GB', label: '4GB' },
    { value: '6GB', label: '6GB' },
  ],
  storage: [
    { value: '128GB', label: '128GB' },
    { value: '256GB', label: '256GB' },
  ],
  version: [
    { value: 'version-global-id', label: 'Global' },
    { value: 'version-nacional-id', label: 'Nacional' },
  ],
};

{
  const parsed = parseModelImportJson(`\`\`\`json
  {
    "name": "Redmi A7 Pro",
    "brand": "Xiaomi",
    "category": "Smartphones",
    "description": "Descricao do modelo",
    "seo": {
      "slug": "redmi-a7-pro",
      "meta_title": "Redmi A7 Pro no Mercado do Vale",
      "meta_description": "Smartphone Redmi A7 Pro com garantia",
      "keywords": "redmi a7 pro, xiaomi"
    },
    "logistics": {
      "weight_kg": "0,250",
      "dimensions": {
        "width_cm": 8,
        "height_cm": 17,
        "depth_cm": 5
      }
    },
    "specs": {
      "Memoria RAM": "4GB",
      "Armazenamento": "128GB",
      "Versao": "Global",
      "novo_campo_futuro": "valor preservado"
    }
  }
  \`\`\``);

  const normalized = normalizeModelImportPayload(parsed, { brands, categories, customFields, choiceOptions });

  assert.equal(normalized.name, 'Redmi A7 Pro');
  assert.equal(normalized.brandId, 'brand-xiaomi');
  assert.equal(normalized.categoryId, 'cat-smartphones');
  assert.equal(normalized.description, 'Descricao do modelo');
  assert.deepEqual(normalized.templateValues.keywords, ['redmi a7 pro', 'xiaomi']);
  assert.equal(normalized.templateValues.ram, '4GB');
  assert.equal(normalized.templateValues.storage, '128GB');
  assert.equal(normalized.templateValues.version, 'version-global-id');
  assert.equal(normalized.templateValues.novo_campo_futuro, 'valor preservado');
  assert.equal(normalized.templateValues.weight_kg, 0.25);
  assert.equal(normalized.templateValues['dimensions.width_cm'], 8);
  assert.equal(normalized.templateValues['dimensions.height_cm'], 17);
  assert.equal(normalized.templateValues['dimensions.depth_cm'], 5);
}

{
  const prompt = buildModelImportPrompt({
    name: 'Galaxy A15',
    brand: 'Samsung',
    category: 'Smartphones',
    customFields,
    choiceOptions,
  });

  assert.match(prompt, /template_values/);
  assert.match(prompt, /ram/);
  assert.match(prompt, /Opcoes validas: 4GB, 6GB/);
  assert.match(prompt, /Opcoes validas: Global, Nacional/);
  assert.match(prompt, /screen_size/);
  assert.match(prompt, /Galaxy A15/);
}

console.log('model-json-import tests passed');
