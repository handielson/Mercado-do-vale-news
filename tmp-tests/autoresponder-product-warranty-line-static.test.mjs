import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'function formatAutoresponderProductWarrantyLine',
    'const productWarrantyType',
    'brand_warranty_days',
    'category_warranty_days',
    'warranty_type',
    'warranty_template_id',
    'Garantia:',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  const detailBody = source.match(/async function formatAutoresponderProductDetailReply[\s\S]*?return lines\.join\('\\n'\);\n}/)?.[0] || '';
  assert(
    detailBody.includes('formatAutoresponderProductWarrantyLine(product)'),
    `${fileName} product detail reply must include warranty line`
  );
  assert(
    detailBody.includes('const warrantyLine = formatAutoresponderProductWarrantyLine(product)'),
    `${fileName} product detail reply must format warranty from the selected product`
  );
}

const doc = readBotWhatsappDoc(root);
assert(
  doc.includes('- [x] Produto individual mostra garantia quando houver contexto de produto'),
  'Bot_Whatsapp.md must mark product-specific warranty checklist item'
);
assert(
  doc.includes('A garantia oficial vem da configuracao do produto'),
  'Bot_Whatsapp.md must document product warranty as the official source'
);

console.log('autoresponder product warranty line static checks passed');
