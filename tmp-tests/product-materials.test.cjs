// product-materials-v1: lista de materiais do produto (PLA, PETG, TPU, ASA e variações) e rota no servidor.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require('../services/productMaterialsServer.cjs');

test('lista padrão traz os materiais pedidos e as variações, sem repetir', () => {
  const list = m.materialCatalog(null);
  for (const name of ['PLA', 'PLA Silk', 'PLA Matte', 'PLA-CF (Fibra de Carbono)', 'PETG', 'PETG HF (High Flow)', 'PETG-CF (Fibra de Carbono)', 'TPU', 'TPU 95A', 'ASA', 'ABS', 'PA (Nylon)', 'Resina'])
    assert.ok(list.includes(name), name);
  assert.equal(new Set(list.map((n) => n.toLowerCase())).size, list.length);
  assert.equal(m.normalizeMaterialName('nylon'), 'PA (Nylon)');
  assert.deepEqual(m.materialCatalog(['Fibra Natural', 'pla']).filter((n) => /fibra natural|^pla$/i.test(n)), ['Fibra Natural', 'PLA']);
});

test('servidor registra /admin/product-materials com login de admin; a tela usa essa rota', () => {
  for (const f of ['vps_server.js', 'vps_server.cjs']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.match(src, /registerProductMaterialRoutes\(fastify, \{ pool, requireAdminBearerToken \}\)/, f);
    assert.doesNotMatch(src, /print3dMaterialsServer/, 'loja 3D continua fora');
  }
  const routes = [];
  m.registerProductMaterialRoutes({ get: (u, o) => routes.push(['GET', u, Boolean(o.preHandler)]), post: (u, o) => routes.push(['POST', u, Boolean(o.preHandler)]) }, { pool: {}, requireAdminBearerToken: () => {} });
  assert.deepEqual(routes, [['GET', '/admin/product-materials', true], ['POST', '/admin/product-materials', true]]);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'services/print3dMaterials.ts'), 'utf8'), /'\/admin\/product-materials'/);
});
