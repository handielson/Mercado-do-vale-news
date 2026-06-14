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
  { key: 'imei1', label: 'Imei1', field_type: 'text' },
  { key: 'imei2', label: 'Imei2', field_type: 'text' },
  { key: 'serial', label: 'Serial', field_type: 'text' },
  { key: 'color', label: 'Color', field_type: 'table_relation' },
  { key: 'water_resistance', label: 'Protecao', field_type: 'select' },
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
  water_resistance: [
    { value: 'IP67', label: 'IP67' },
    { value: 'IP68', label: 'IP68' },
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
      "Imei1": "123456789012345",
      "imei2": "987654321098765",
      "serial": "SN123",
      "color": "Preto",
      "Protecao": "IP70",
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
  assert.equal(normalized.templateValues.imei1, undefined);
  assert.equal(normalized.templateValues.imei2, undefined);
  assert.equal(normalized.templateValues.serial, undefined);
  assert.equal(normalized.templateValues.color, undefined);
  assert.equal(normalized.templateValues.water_resistance, undefined);
  assert.deepEqual(normalized.missingChoices, [{
    fieldKey: 'water_resistance',
    fieldLabel: 'Protecao',
    value: 'IP70',
    options: ['IP67', 'IP68'],
  }]);
  assert.equal(normalized.templateValues.novo_campo_futuro, 'valor preservado');
  assert.equal(normalized.templateValues.weight_kg, 0.25);
  assert.equal(normalized.templateValues['dimensions.width_cm'], 8);
  assert.equal(normalized.templateValues['dimensions.height_cm'], 17);
  assert.equal(normalized.templateValues['dimensions.depth_cm'], 5);
}

{
  const normalized = normalizeModelImportPayload({
    name: 'Redmi Pad SE 11',
    brand: 'Xiaomi',
    category_id: 'categoria-inventada-pela-ia',
    category: 'Tablets',
  }, {
    brands,
    categories,
    customFields,
    choiceOptions,
  });

  assert.equal(
    normalized.categoryId,
    '',
    'category_id imported from JSON must be ignored when it does not exist in the loaded categories'
  );
}

{
  const prompt = buildModelImportPrompt({
    name: 'Galaxy A15',
    brand: 'Samsung',
    category: 'Smartphones',
    customFields,
    choiceOptions,
  });

  const availableFieldsBlock = prompt.split('Campos tecnicos disponiveis hoje:')[1].split('Formato esperado:')[0];

  assert.match(prompt, /template_values/);
  assert.match(prompt, /ram/);
  assert.doesNotMatch(availableFieldsBlock, /imei1/i);
  assert.doesNotMatch(availableFieldsBlock, /imei2/i);
  assert.doesNotMatch(availableFieldsBlock, /serial/i);
  assert.doesNotMatch(availableFieldsBlock, /color/i);
  assert.match(prompt, /Opcoes validas: 4GB, 6GB/);
  assert.match(prompt, /Opcoes validas: Global, Nacional/);
  assert.match(prompt, /Use apenas dados reais do produto/);
  assert.match(prompt, /Nao use dados genericos/i);
  assert.match(prompt, /na duvida nao preencha/i);
  assert.match(prompt, /dimensoes da caixa\/embalagem/i);
  assert.match(prompt, /Se o valor real nao estiver nas opcoes validas listadas, mantenha o valor real/);
  assert.match(prompt, /screen_size/);
  assert.match(prompt, /Galaxy A15/);
}

console.log('model-json-import tests passed');
