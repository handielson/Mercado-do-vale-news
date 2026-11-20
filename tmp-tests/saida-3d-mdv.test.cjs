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

test('lista de produtos: sem botão "Produto 3D" e sem marcar família como 3D', () => {
  const lista = ler('pages/admin/products/ProductListPage.tsx');
  assert.doesNotMatch(lista, /Print3dProductEntry/);
  assert.doesNotMatch(ler('components/products/ProductFamilyList.tsx'), /<Print3dFamilyToggle/);
  assert.equal(fs.existsSync(path.join(raiz, 'components/products/Print3dProductEntry.tsx')), false);
});

test('API (etapa 2): os dois servidores não registram mais nada da loja 3D', () => {
  for (const f of ['vps_server.js', 'vps_server.cjs']) {
    const api = ler(f);
    assert.doesNotMatch(api, /registerPrint3d\w+Routes|createPrint3dExpiryWorker|createPrint3dWhatsAppSender/, f);
    assert.doesNotMatch(api, /\/api\/seo-produto-3d/, f);
    assert.doesNotMatch(api, /'\/print3d\//, `${f}: proxy público sem rotas /print3d`);
    assert.doesNotMatch(api, /\/loja-3d/, `${f}: sitemap sem /loja-3d`);
    assert.doesNotMatch(api, /print3dRecipesServer|print3dRecipeFilesServer|print3dActiveRecipeServer|print3dMaterialsServer|print3dFilamentsServer/, f);
  }
  const { STOREFRONTS } = require(path.join(raiz, 'services/productStorefrontOffer.cjs'));
  assert.deepEqual([...STOREFRONTS], ['mercado_do_vale']);
  const ofertas = ler('services/productStorefrontOffersServer.cjs');
  assert.doesNotMatch(ofertas, /loadPrint3dQuote|print3dShippingServer|print3d_active_recipes|\/storefronts\/loja_3d\/quote/);
});

test('limpeza (etapa 4): deploy da API não envia módulos da loja 3D e os módulos saíram do repositório', () => {
  const deploy = ler('deploy-vps-server-only.cjs');
  const restos = (deploy.match(/services\/print3d\w+\.cjs/g) || []).filter((f) => f !== 'services/print3dProductOffer.cjs');
  assert.deepEqual(restos, []);
  assert.doesNotMatch(deploy, /--print3d-(only|domain-only|filaments-only|materials-only)/);
  for (const f of ['services/print3dCheckoutServer.cjs', 'services/print3dPayments.cjs', 'services/print3dProductionServer.cjs',
    'services/print3dCustomerAccountsServer.cjs', 'services/print3dExpiryWorker.cjs', 'scripts/deploy-print3d.cjs', 'scripts/deploy-print3d-domain.cjs']) {
    assert.equal(fs.existsSync(path.join(raiz, f)), false, f);
  }
  assert.equal(fs.existsSync(path.join(raiz, 'services/print3dProductOffer.cjs')), true, 'normalização de encomenda do produto continua');
});
