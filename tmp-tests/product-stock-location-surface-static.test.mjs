import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, snippet, label) {
  assert(source.includes(snippet), `${label}: missing ${snippet}`);
}

const detailPage = read('pages/admin/products/ProductDetailPage.tsx');
const productCard = read('components/products/ProductCard.tsx');
const locationsPage = read('pages/admin/inventory/StockLocationsPage.tsx');
const plan = read('Estoque.md');

assertIncludes(detailPage, 'stockLocationService', 'product detail should use stock location service');
assertIncludes(detailPage, 'getProductStockDistribution(product.id)', 'product detail should load product distribution');
assertIncludes(detailPage, 'Distribuicao por local', 'product detail should render distribution section');
assertIncludes(detailPage, 'Loja / deposito', 'product detail should show deposit column');
assertIncludes(detailPage, 'Saldo disponivel', 'product detail should show available quantity');
assertIncludes(detailPage, 'productStockDistribution.reduce', 'product detail should summarize distribution total');
assertIncludes(detailPage, '/admin/inventory/locations', 'product detail should link to stock locations screen');

assertIncludes(productCard, 'MapPin', 'product card should import stock location shortcut icon');
assertIncludes(productCard, 'buildStockLocationsHref', 'product card should build stock locations shortcut');
assertIncludes(productCard, 'Ver locais de estoque', 'product card should expose stock locations shortcut');
assertIncludes(productCard, '/admin/inventory/locations?search=', 'product card shortcut should prefill stock search');

assertIncludes(locationsPage, 'useSearchParams', 'locations page should read shortcut search params');
assertIncludes(locationsPage, "searchParams.get('search')", 'locations page should read search query');
assertIncludes(locationsPage, 'setProductSearch(initialSearch)', 'locations page should prefill product search');

assertIncludes(plan, '- [x] Adicionar distribuicao na tela do produto.', 'plan marks product distribution done');
assertIncludes(plan, '- [x] Adicionar atalho na listagem de produtos.', 'plan marks product list shortcut done');
assertIncludes(plan, 'Adicionada distribuicao por local na tela individual do produto', 'diary records product distribution');

console.log('product stock location surface static checks passed');
