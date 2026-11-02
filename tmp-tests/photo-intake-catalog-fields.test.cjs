const test = require('node:test');
const assert = require('node:assert/strict');

test('valor lido só é aceito quando existe na lista cadastrada', async () => {
  const { findCatalogOption, normalizeMemoryText } = await import('../services/photoIntakeCatalogFields.mjs');
  const storages = ['64GB', '128GB', '256GB', '512GB', '1TB'];
  const rams = ['4GB', '6GB', '8GB', '12GB'];
  assert.equal(findCatalogOption(storages, '256 GB', 'memory'), '256GB');
  assert.equal(findCatalogOption(storages, '256', 'memory'), '256GB');
  assert.equal(findCatalogOption(storages, '1 tb', 'memory'), '1TB');
  assert.equal(findCatalogOption(storages, '246', 'memory'), null, 'leitura errada não pode virar opção');
  assert.equal(findCatalogOption(rams, '6gb', 'memory'), '6GB');
  assert.equal(findCatalogOption(['Xiaomi', 'Realme', 'Motorola'], 'realme'), 'Realme');
  assert.equal(findCatalogOption(['Xiaomi'], 'Redmi'), null);
  assert.equal(findCatalogOption(['Poco X8 Pro'], 'POCO X8 PRO'), 'Poco X8 Pro');
  assert.equal(findCatalogOption([], ''), null);
  assert.equal(normalizeMemoryText('8 GB'), '8GB');
});

test('conferência usa lista para marca, modelo, RAM e armazenamento', () => {
  const fs = require('node:fs');
  const card = fs.readFileSync('components/products/photo-intake/PhotoIntakeReviewCard.tsx', 'utf8');
  for (const [key, kind] of [['detected_brand', 'brand'], ['detected_model', 'model'], ['detected_ram', 'ram'], ['detected_storage', 'storage']]) {
    assert.match(card, new RegExp(`key: '${key}'[^}]*catalog: '${kind}'`), `${key} deve ser escolhido de lista`);
  }
  assert.match(card, /if \(field\.catalog\) return renderCatalogField\(field\);/, 'campos de catálogo não podem cair no input livre');
  assert.match(card, /findCatalogOption\(options, raw, 'memory'\)/, 'RAM/armazenamento lidos devem ser comparados com o cadastro');
  assert.match(card, /value\.startsWith\('__lido__'\)\) return;/, 'valor lido fora da lista não pode ser salvo como opção');
  assert.match(card, /selectedBrandId \? sortedModels\.filter\(model => model\.brand_id === selectedBrandId\)/, 'modelos devem ser filtrados pela marca escolhida');
  assert.match(card, /Lido na foto: “\{raw\}” — escolha da lista/, 'deve mostrar o que a foto leu quando não existe na lista');
  const lists = fs.readFileSync('services/photoIntakeCatalogLists.ts', 'utf8');
  assert.match(lists, /brandService\.listActive\(\), ramService\.listActive\(\), storageService\.listActive\(\)/, 'listas vêm do cadastro ativo');
});

test('conferência mostra código de barras e link do aparelho já cadastrado', () => {
  const fs = require('node:fs');
  const card = fs.readFileSync('components/products/photo-intake/PhotoIntakeReviewCard.tsx', 'utf8');
  assert.match(card, /barcodeHint\(barcodeFields\?\.\[field\.barcodeKey\]/, 'cada identificador compara com as barras');
  assert.match(card, /Confere com o código de barras/);
  assert.match(card, /\[field\.key\]: barcode\.value, review_confirmed: false/, 'usar o valor das barras só por ação do usuário');
  assert.match(card, /registeredUnitLink\(issue\)[\s\S]*Ver aparelho/, 'aviso de duplicado deve levar ao aparelho');
  const units = fs.readFileSync('pages/admin/inventory/SerializedUnitsPage.tsx', 'utf8');
  assert.match(units, /useState\(\(\) => searchParams\.get\('search'\)/, 'página de serializados deve abrir filtrada pelo link');
});
