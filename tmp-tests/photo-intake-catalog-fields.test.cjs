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

test('palpite de marca e modelo vem preenchido a partir da etiqueta', async () => {
  const { guessCatalogBrand, guessCatalogModel } = await import('../services/photoIntakeCatalogFields.mjs');
  const brands = ['Apple', 'Motorola', 'Poco', 'Realme', 'Samsung', 'Xiaomi'];
  assert.deepEqual(guessCatalogBrand(brands, 'REDMI'), { value: 'Xiaomi', exact: false });
  assert.deepEqual(guessCatalogBrand(brands, 'POCO'), { value: 'Poco', exact: true }, 'marca que existe no cadastro vence a família');
  assert.deepEqual(guessCatalogBrand(brands, 'realme'), { value: 'Realme', exact: true });
  assert.equal(guessCatalogBrand(brands, 'Nokia'), null);
  const models = [
    { id: 'n17', name: 'Redmi Note 17', brand_id: 'x' },
    { id: 'n17p', name: 'Redmi Note 17 Pro', brand_id: 'x' },
    { id: 'r', name: 'Redmi', brand_id: 'x' },
    { id: 'c71', name: 'Realme C71', brand_id: 'r' },
  ];
  assert.deepEqual(guessCatalogModel(models, 'Redmi Note 17 Black', { brandId: 'x', brandName: 'Xiaomi' }), { id: 'n17', exact: false });
  assert.deepEqual(guessCatalogModel(models, 'Redmi Note 17 Pro Preto', { brandId: 'x' }), { id: 'n17p', exact: false }, 'mais específico vence');
  assert.deepEqual(guessCatalogModel(models, 'redmi note 17', { brandId: 'x' }), { id: 'n17', exact: true });
  assert.deepEqual(guessCatalogModel(models, 'Xiaomi Redmi Note 17 Black', { brandId: 'x', brandName: 'Xiaomi' }), { id: 'n17', exact: false });
  assert.deepEqual(guessCatalogModel(models, 'C71', { brandId: 'r', brandName: 'Realme' }), { id: 'c71', exact: true });
  assert.equal(guessCatalogModel(models, 'Redmi 15C', { brandId: 'x' }), null, 'não casa só pela palavra Redmi');
  assert.equal(guessCatalogModel(models, 'Realme C71', { brandId: 'x' }), null, 'respeita a marca escolhida');
});

test('conferência já vem com marca/modelo sugeridos e avisa de onde veio', () => {
  const card = require('node:fs').readFileSync('components/products/photo-intake/PhotoIntakeReviewCard.tsx', 'utf8');
  assert.match(card, /guessCatalogBrand\(brandNames, readBrand\)/, 'marca deve vir preenchida com o palpite');
  assert.match(card, /guessCatalogModel\(models, readModel, \{ brandId/, 'modelo deve vir preenchido com o palpite da marca');
  assert.match(card, /modelLinked \? null :/, 'não troca um modelo já vinculado');
  assert.match(card, /Sugerido pelo que a foto leu: “\{from\}” — troque se não for/);
});

test('nome e categoria sugeridos para cadastrar modelo novo', async () => {
  const { suggestModelName, siblingModelCategory } = await import('../services/photoIntakeCatalogFields.mjs');
  assert.equal(suggestModelName('Redmi Note 17 Black'), 'Redmi Note 17');
  assert.equal(suggestModelName('Xiaomi Redmi Note 17 Pro 8GB+256GB Midnight Black', { brandName: 'Xiaomi' }), 'Redmi Note 17 Pro');
  assert.equal(suggestModelName('realme C71 Forest Owl', { colorNames: ['Forest Owl'] }), 'realme C71');
  assert.equal(suggestModelName('Redmi Note 15 4G'), 'Redmi Note 15 4G', 'não corta 4G/5G');
  assert.equal(suggestModelName('Black'), 'Black', 'nunca esvazia o nome');
  const models = [
    { id: 'a', name: 'Redmi Note 15 4G', brand_id: 'x', category_id: 'cel' },
    { id: 'b', name: 'Redmi 15C', brand_id: 'x', category_id: 'smart' },
    { id: 'c', name: 'Capa para Redmi Note 15', brand_id: 'x', category_id: 'capas' },
    { id: 'd', name: 'Galaxy A56', brand_id: 's', category_id: 'smart' },
  ];
  assert.equal(siblingModelCategory(models, 'Redmi Note 17', 'x'), 'cel');
  assert.equal(siblingModelCategory(models, 'Galaxy A57', 'x'), null, 'respeita a marca');
});

test('botão cadastra o modelo novo com marca, categoria do irmão e EAN e já seleciona', () => {
  const fs = require('node:fs');
  const card = fs.readFileSync('components/products/photo-intake/PhotoIntakeReviewCard.tsx', 'utf8');
  assert.match(card, /data-create-model[\s\S]*suggestModelName\(raw/, 'botão sugere o nome limpo');
  assert.match(card, /onCreateModel\(\{[\s\S]*brand_id: brandId[\s\S]*siblingModelCategory\(models, name, brandId\)[\s\S]*isValidGtin\(ean\) \? \[ean\]/, 'cria com marca, categoria do irmão e EAN válido');
  assert.match(card, /matched_model_id: model\.id[\s\S]*detected_model: model\.name/, 'modelo criado já fica escolhido');
  const page = fs.readFileSync('pages/admin/products/SmartphonePhotoIntakePage.tsx', 'utf8');
  assert.match(page, /onCreateModel=\{createModelFromIntake\}/);
  assert.match(page, /modelService\.create\(input\)[\s\S]*modelService\.listActive\(\)[\s\S]*setModels\(modelRows\)/, 'recarrega a lista depois de criar');
});

test('associar modelo não apaga a cor escolhida e ainda não salva', async () => {
  const { mergePhotoIntakeDraft } = await import('../services/photoIntakeDraftMerge.mjs');
  const before = { matched_model_id: null, matched_color_id: null, detected_color: 'Forest Owl', price_cost: 0 };
  const local = { ...before, matched_color_id: 'verde', detected_color: 'Verde', price_cost: 120000 };
  const after = { ...before, matched_model_id: 'm1', price_cost: 0 };
  const merged = mergePhotoIntakeDraft(before, after, local, { sameRecord: true });
  assert.equal(merged.matched_model_id, 'm1', 'o modelo associado pelo servidor entra');
  assert.equal(merged.matched_color_id, 'verde', 'a cor escolhida continua');
  assert.equal(merged.detected_color, 'Verde');
  assert.equal(merged.price_cost, 120000, 'campo que o servidor não mudou mantém o digitado');
  const serverPrice = mergePhotoIntakeDraft(before, { ...after, price_cost: 99000 }, local, { sameRecord: true });
  assert.equal(serverPrice.price_cost, 99000, 'se o servidor mudou o campo, vale o servidor');
  const other = mergePhotoIntakeDraft(before, after, local, { sameRecord: false });
  assert.equal(other.matched_color_id, null, 'outro aparelho começa do zero');
});

test('cor sugerida pela palavra de cor da etiqueta', async () => {
  const { guessCatalogColor } = await import('../services/photoIntakeCatalogFields.mjs');
  const colors = ['Preto', 'Branco', 'Azul', 'Verde', 'Roxo', 'Dourado', 'Prata', 'Cinza', 'Laranja', 'Titânio'].map(name => ({ id: name.toLowerCase(), name }));
  assert.deepEqual(guessCatalogColor(colors, 'Negro Ocaso'), { id: 'preto', exact: false });
  assert.deepEqual(guessCatalogColor(colors, 'Mint Green'), { id: 'verde', exact: false });
  assert.deepEqual(guessCatalogColor(colors, 'Laranja Vitality'), { id: 'laranja', exact: false });
  assert.deepEqual(guessCatalogColor(colors, 'Mecha Silver'), { id: 'prata', exact: false });
  assert.deepEqual(guessCatalogColor(colors, 'titânio'), { id: 'titânio', exact: true });
  assert.equal(guessCatalogColor(colors, 'Forest Owl'), null, 'sem palavra de cor não chuta');
  assert.equal(guessCatalogColor(colors, 'Black White'), null, 'duas cores diferentes não chuta');
});
