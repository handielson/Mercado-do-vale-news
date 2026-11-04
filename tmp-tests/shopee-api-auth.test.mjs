// shopee-api-auth-v1: /api/shopee-catalog e /api/shopee-actions não podem responder sem login.
// Antes ficavam abertas na internet (inclusive update_price/update_stock/add_item).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

test('API: as duas rotas exigem admin ou x-sync-key (js e cjs)', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [route, handler] of [['shopee-catalog', 'handleShopeeCatalogVps'], ['shopee-actions', 'handleShopeeActionsVps']]) {
      assert.match(source, new RegExp(`fastify\\.all\\('/api/${route}', \\{ preHandler: requireSyncKeyOrAdmin \\}, ${handler}\\)`), `${file}: /api/${route} protegida`);
      assert.doesNotMatch(source, new RegExp(`fastify\\.(all|get|post)\\('/api/${route}', ${handler}\\)`), `${file}: /api/${route} sem proteção não pode voltar`);
    }
  }
});

test('front: o wrapper é instalado na inicialização', () => {
  assert.match(fs.readFileSync('index.tsx', 'utf8'), /installShopeeApiAuthFetch\(\);/);
});

function loadWrapper(token) {
  const out = ts.transpileModule(fs.readFileSync('services/shopeeApiAuth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, URL, Headers, Request, require(id) {
    if (id === './authSession') return { getAuthSessionToken: async () => token };
    if (id === './vpsProxyBase') return { getVpsSyncHeaders: () => ({}) };
    throw new Error(id);
  } });
  return exports;
}

test('wrapper: põe o token só nas rotas protegidas do próprio site', async () => {
  const { installShopeeApiAuthFetch, isProtectedShopeeApiUrl } = loadWrapper('tok123');
  const calls = [];
  const target = { location: { origin: 'https://www.mercadodovale.com.br' }, fetch: async (input, init) => { calls.push({ input, headers: new Headers(init?.headers) }); return 'ok'; } };
  installShopeeApiAuthFetch(target);
  installShopeeApiAuthFetch(target); // idempotente
  await target.fetch('/api/shopee-catalog?action=get_item_base_info&item_id_list=1');
  await target.fetch('/api/shopee-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  await target.fetch('/api/outra-rota');
  await target.fetch('https://outro-site.com/api/shopee-catalog');
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer tok123');
  assert.equal(calls[1].headers.get('Authorization'), 'Bearer tok123');
  assert.equal(calls[1].headers.get('Content-Type'), 'application/json');
  assert.equal(calls[2].headers.get('Authorization'), null, 'outras rotas intactas');
  assert.equal(calls[3].headers.get('Authorization'), null, 'nunca manda o token para outro domínio');
  assert.equal(isProtectedShopeeApiUrl('/api/shopee-catalog-x', 'https://a.b'), false);
});
