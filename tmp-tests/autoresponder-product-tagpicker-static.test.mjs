import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const detailPath = path.join(root, 'pages', 'admin', 'products', 'ProductDetailPage.tsx');
const productTypePath = path.join(root, 'types', 'product.ts');
const productServicePath = path.join(root, 'services', 'products.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const detail = fs.readFileSync(detailPath, 'utf8');
const productType = fs.readFileSync(productTypePath, 'utf8');
const productService = fs.readFileSync(productServicePath, 'utf8');
const doc = readBotWhatsappDoc(root);

[
  'ProductTagPicker',
  'AutoResponderTag',
  'autoResponderService',
  'loadProductTags',
  'productTagIds',
  'toggleProductTag',
  'saveProductTags',
  'updateProductTags',
].forEach((token) => {
  assert(detail.includes(token), `Product detail must include ${token}`);
});

[
  'Tags do AutoResponder',
  'Salvar tags',
  'Nenhuma tag de produto cadastrada.',
].forEach((label) => {
  assert(detail.includes(label), `Product tag picker must render label: ${label}`);
});

assert(
  productType.includes('tag_ids?: number[] | string | null;'),
  'Product type must expose tag_ids from VPS'
);
assert(
  productService.includes('parseProductTagIds') && productService.includes('tag_ids: parseProductTagIds(row.tag_ids)'),
  'Product service must normalize tag_ids from VPS rows'
);

assert(doc.includes('- [x] Localizar página de edição de produto'), 'Bot_Whatsapp.md must mark product edit page located');
assert(doc.includes('- [x] Adicionar campo TagPicker (escopo `product`)'), 'Bot_Whatsapp.md must mark product TagPicker');
assert(doc.includes('- [x] Conectar ao endpoint `PATCH /products/:id/tags`'), 'Bot_Whatsapp.md must mark product tags endpoint');

console.log('autoresponder product tagpicker static checks passed');
