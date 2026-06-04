import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');
  const detailBody = source.match(/async function formatAutoresponderProductDetailReply[\s\S]*?return lines\.join\('\\n'\);\r?\n}/)?.[0] || '';

  assert(detailBody, `${fileName} must expose product detail formatter`);
  assert(!detailBody.includes('formatAutoresponderProductDescriptionLine(product)'), `${fileName} must not show description in product details`);
  assert(!detailBody.includes('Imagem:'), `${fileName} must not show raw image links in product details`);
  assert(detailBody.includes('Link do produto:'), `${fileName} must label the site link clearly`);
  assert(detailBody.includes('Acesse o link para ver especificacoes, fotos e video demonstrativo do produto.'), `${fileName} must guide customer to the site for specs/media`);
  assert(source.includes('function isAutoresponderXiaomiBrand'), `${fileName} must identify Xiaomi/Poco/Redmi warranty as store warranty`);
  assert(source.includes('function isAutoresponderRealmeBrand'), `${fileName} must identify Realme warranty as manufacturer warranty`);
  assert(source.includes('Garantia: ${period ? `${period} pela loja` : \'pela loja\'}'), `${fileName} must show Xiaomi warranty by store`);
  assert(source.includes('Garantia: ${period ? `${period} pelo fabricante` : \'pelo fabricante\'}'), `${fileName} must show Realme warranty by manufacturer`);
}

console.log('autoresponder product detail format static checks passed');
