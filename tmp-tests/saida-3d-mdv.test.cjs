// Saída do 3D do Mercado do Vale (v1.2.871+): a G-CODE 3D tem sistema próprio (gcode3d.com.br).
// No MdV fica só: dois atalhos no admin (site e admin da G-CODE) e o 301 dos links antigos /loja-3d.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');

test('rotas do site e do admin sem nada da loja 3D', () => {
  const rotas = ler('routes/index.tsx');
  assert.doesNotMatch(rotas, /path:\s*"\/loja-3d/);
  assert.doesNotMatch(rotas, /path:\s*"\/admin\/loja-3d/);
  assert.doesNotMatch(rotas, /print3d-(cost|production)/);
  assert.doesNotMatch(rotas, /Print3d/);
});

test('admin do MdV: só os dois atalhos da G-CODE 3D', () => {
  const layout = ler('layouts/AdminLayout.tsx');
  assert.doesNotMatch(layout, /title: '3DMV'/);
  assert.doesNotMatch(layout, /\/admin\/loja-3d/);
  assert.doesNotMatch(layout, /to="\/loja-3d"/);
  assert.match(layout, /GCODE_SITE_URL = 'https:\/\/www\.gcode3d\.com\.br\/'/);
  assert.match(layout, /GCODE_ADMIN_URL = 'https:\/\/www\.gcode3d\.com\.br\/admin'/);
  assert.equal((layout.match(/href=\{GCODE_SITE_URL\}/g) || []).length, 3, "site: menu aberto, recolhido e celular");
  assert.equal((layout.match(/href=\{GCODE_ADMIN_URL\}/g) || []).length, 3, "admin: menu aberto, recolhido e celular");
});

test('nginx: links antigos da loja 3D vão para a G-CODE com 301', () => {
  for (const f of ['infra/nginx/mdv-site-production.conf', 'infra/nginx/mdv-site-staging.conf']) {
    const conf = ler(f);
    assert.match(conf, /location ~ \^\/loja-3d\(\?:\/\.\*\)\?\$ \{\s*return 301 https:\/\/www\.gcode3d\.com\.br\/;/, f);
    assert.doesNotMatch(conf, /seo-produto-3d/, f);
    assert.doesNotMatch(conf, /\|\/loja-3d/, `${f}: SPA não serve mais /loja-3d`);
  }
});

test('nenhuma tela do MdV aponta para as telas 3D que saíram', () => {
  const pastas = ['components', 'pages', 'layouts', 'routes', 'services', 'hooks', 'utils'];
  const achados = [];
  const andar = (dir) => {
    for (const nome of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
      const rel = path.join(dir, nome.name);
      if (nome.isDirectory()) andar(rel);
      else if (/\.(tsx?|jsx?|mjs)$/.test(nome.name) && !/Print3dRegistrationEditor|print3d/i.test(nome.name)) {
        const txt = fs.readFileSync(path.join(raiz, rel), 'utf8');
        if (/\/admin\/loja-3d|to="\/loja-3d|href="\/loja-3d/.test(txt)) achados.push(rel);
      }
    }
  };
  pastas.forEach(andar);
  assert.deepEqual(achados, []);
});

test('cadastro de produto: nada é tratado como 3D e não há marcação 3D', () => {
  const form = ler('components/products/ProductForm.tsx');
  assert.match(form, /const isPrint3d = false;/);
  assert.match(form, /mergedData\.is_print3d = false;/);
  assert.doesNotMatch(form, /Este SKU pertence à linha de impressão 3D/);
  assert.doesNotMatch(ler('components/products/ProductPublicationChannels.tsx'), /Loja 3D/);
  assert.doesNotMatch(ler('components/products/ProductWorkspaceNav.tsx'), /Produção 3D/);
  assert.doesNotMatch(ler('pages/admin/products/ProductStorefrontOffersPage.tsx'), /\{ code: 'loja_3d'/);
});
