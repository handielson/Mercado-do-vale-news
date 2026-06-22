import fs from 'node:fs';

const service = fs.readFileSync('services/shopeeTemplateService.ts', 'utf8');
const engine = fs.readFileSync('services/shopeeTemplateEngine.ts', 'utf8');
const page = fs.readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const templatesPage = fs.readFileSync('pages/admin/settings/ShopeeTemplatesPage.tsx', 'utf8');
const modelModal = fs.readFileSync('components/settings/ModelModal.tsx', 'utf8');

for (const expected of [
  "id: 'universal_defaults'",
  'ensureRequiredDefaultTemplates',
  "100121: '3 meses'",
  "100370: 'Garantia do fornecedor'",
  "100999: '1'",
  "100413: 'Novo'",
  "101219: 'Não'",
  "101639: '{sku}'",
  "101029: '{package_dimensions}'",
]) {
  if (!service.includes(expected)) throw new Error(`Missing universal default: ${expected}`);
}

if (!service.includes('ensureRequiredDefaultTemplates(templates)')) {
  throw new Error('Shopee template list must keep required defaults available even when VPS already has rows.');
}

for (const expected of [
  'resolveUniversalShopeeAttributeDefaults',
  'renderShopeeAttributeDefaultValue',
  'package_dimensions',
]) {
  if (!engine.includes(expected)) throw new Error(`Missing engine helper: ${expected}`);
}

if (!page.includes('resolveUniversalShopeeAttributeDefaults(shopeeTemplates)')) {
  throw new Error('ShopeePage must merge editable universal defaults for every category.');
}

if (!page.includes('mergeShopeeAttributeDefaults')) {
  throw new Error('ShopeePage must resolve dynamic attribute placeholders such as SKU and package dimensions through the shared merge helper.');
}

if (!templatesPage.includes('Defaults universais por ID') || !templatesPage.includes('handleAddManualAttributeDefault')) {
  throw new Error('ShopeeTemplatesPage must expose manual attribute default editing by ID.');
}

if (!modelModal.includes('shopeeTemplateService.list()')) {
  throw new Error('ModelModal must load Shopee templates so universal defaults prefill model attributes.');
}

if (!modelModal.includes("import { vpsApiService } from '../../services/vpsApiService'")) {
  throw new Error('ModelModal must import vpsApiService to resolve model product SKUs for Shopee defaults.');
}

if (!modelModal.includes('model_id: model.id')) {
  throw new Error('ModelModal must fetch products linked to the model when rendering Shopee defaults.');
}

if (!modelModal.includes('context.sku = firstTextValue(productWithSku.sku, productWithSku.specs?.sku)')) {
  throw new Error('ModelModal must pass a real linked product SKU to dynamic Shopee defaults such as {sku}.');
}

if (!modelModal.includes('resolveUniversalShopeeAttributeDefaults(shopeeTemplates)')) {
  throw new Error('ModelModal must merge universal defaults when category attributes are loaded.');
}

if (!modelModal.includes('renderShopeeAttributeDefaultValue(value as any, productRef)')) {
  throw new Error('ModelModal must render dynamic universal defaults before filling model attributes.');
}

console.log('shopee universal attribute defaults static ok');
