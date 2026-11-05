// Review Focus 4 (etapa 6): cadastro em massa e cadastro por foto viraram abas da Entrada.
// As rotas antigas só redirecionam (com replace) e nenhum link do SPA aponta mais para elas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(path, 'utf8');
const OLD = /\/admin\/products\/(bulk|photo-intake)(?![\w-])/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

function routeBlock(routes, path) {
  const start = routes.indexOf(`path: "${path}"`);
  assert.ok(start >= 0, `rota ${path} continua declarada`);
  return routes.slice(start, routes.indexOf('\n  },', start));
}

test('rotas antigas redirecionam para a aba certa da Entrada, com replace', () => {
  const routes = read('routes/index.tsx');
  assert.match(routes, /import \{[^}]*\bNavigate\b[^}]*\} from 'react-router-dom'/);
  for (const [path, target] of [['/admin/products/bulk', '/admin/entrada?aba=planilha'], ['/admin/products/photo-intake', '/admin/entrada?aba=foto']]) {
    const block = routeBlock(routes, path);
    assert.match(block, new RegExp(`<Navigate to="${target.replace(/[?]/g, '\\$&')}" replace />`), `${path} → ${target}`);
    assert.doesNotMatch(block, /AdminLayout|Page \/>/, `${path} não abre mais a tela antiga`);
  }
  assert.doesNotMatch(routes, /BulkRegistrationPage|SmartphonePhotoIntakePage/, 'telas antigas fora das rotas (a Foto fica embutida na Entrada)');
});

test('nenhum link do SPA aponta para /admin/products/bulk ou /admin/products/photo-intake', () => {
  const files = ['App.tsx', 'index.tsx', ...['components', 'contexts', 'core', 'hooks', 'layouts', 'pages', 'routes', 'services', 'types', 'utils'].flatMap(d => walk(d))];
  const offenders = [];
  for (const file of files) {
    if (file === join('routes', 'index.tsx')) continue;
    read(file).split('\n').forEach((line, i) => { if (OLD.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`); });
  }
  assert.deepEqual(offenders, []);
});

test('atalhos levam direto para a Entrada', () => {
  const list = read('pages/admin/products/ProductListPage.tsx');
  assert.match(list, /navigate\('\/admin\/entrada\?aba=planilha'\)[^\n]*Cadastro em Massa/);
  assert.match(list, /navigate\('\/admin\/entrada\?aba=foto'\)[^\n]*Smartphones por Foto/);
  assert.match(read('components/admin/dashboard/AdminQuickAccessGrid.tsx'), /Smartphones por Foto[\s\S]{0,120}path: '\/admin\/entrada\?aba=foto'/);
  const layout = read('layouts/AdminLayout.tsx');
  assert.match(layout, /\{ to: '\/admin\/entrada\?aba=foto', path: '\/admin\/entrada', icon: <Camera size=\{20\} \/>, label: 'Foto'/);
  assert.match(read('pages/admin/products/SmartphonePhotoIntakePage.tsx'), /navigate\('\/admin\/entrada\?aba=foto'\)[\s\S]{0,160}aria-label="Voltar para a Entrada"/);
});

test('telas e componentes do cadastro antigo foram apagados', () => {
  for (const file of [
    'pages/admin/EntradaPage.tsx',
    'pages/admin/products/ProductEntryPage.tsx',
    'pages/admin/products/BulkRegistrationPage.tsx',
    'components/products/bulk/QuickRegisterForm.tsx',
    'components/products/bulk/NewProductModal.tsx',
    'components/products/bulk/BulkUploadForm.tsx',
    'components/products/bulk/BulkPreviewTable.tsx',
    'components/products/bulk/BulkProgressModal.tsx',
    'components/units/UnitForm.tsx',
    'components/products/serializedBatch.js',
    'services/bulk-products.ts',
    'types/bulk-product.ts',
  ]) assert.equal(existsSync(file), false, `${file} apagado`);
  // A tela de foto continua: a aba Foto da Entrada a usa embutida.
  assert.equal(existsSync('pages/admin/products/SmartphonePhotoIntakePage.tsx'), true);
});

test('a busca por código usa o endpoint que já cobre EAN alternativo', () => {
  const service = read('services/products.ts');
  const fn = service.slice(service.indexOf('async function findByCode('), service.indexOf('\n}\n', service.indexOf('async function findByCode(')));
  assert.match(fn, /vpsApiService\.getProductByEan\(/, 'GET /products/by-ean/:ean (ean OU alternative_eans)');
  assert.match(fn, /getBySku\(/, 'sem EAN, SKU exato');
  assert.doesNotMatch(fn, /isActiveProductForCatalog/, 'produto inativo também recebe estoque');
  const server = read('vps_server.js');
  assert.match(server, /fastify\.get\('\/products\/by-ean\/:ean'[\s\S]{0,400}WHERE ean = \? OR JSON_CONTAINS\(alternative_eans, JSON_QUOTE\(\?\)\)/);
});
