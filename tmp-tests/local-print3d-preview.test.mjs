import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { plateFixture } from './print3d-plates.test.mjs';
const require = createRequire(import.meta.url);
const { createLocalCatalogPreviewServer, isLocalCatalogPreviewPath } = require('../services/localCatalogPreviewServer.cjs');

test('localhost intercepta só fichas/arquivos privados, sem produção, pagamento ou estoque', () => {
  assert.equal(isLocalCatalogPreviewPath('/admin/print3d/status'), true);
  assert.equal(isLocalCatalogPreviewPath('/admin/print3d/production'), false);
  assert.equal(isLocalCatalogPreviewPath('/admin/print3d/products/11111111-1111-4111-8111-111111111111/active-recipe','POST'), false);
});

async function setup(t, enabled = true, platePlans = true) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-local-print3d-'));
  const draft = plateFixture();
  const filePath = path.join(dir, 'drafts.json');
  await fs.writeFile(filePath, JSON.stringify({ products:{ [draft.productId]:{ local_only:true, patch:{ id:draft.productId, sku:draft.sku, name:draft.productName, is_print3d:true, is_parent:false } } }, offers:{} }));
  const calls = [];
  const instance = createLocalCatalogPreviewServer({ draftFile:filePath, port:0, syncKey:'test-sync', fetchImpl:async (url, options) => {
    const pathname = new URL(url).pathname; calls.push({ pathname, method:options.method, body:options.body, auth:options.headers.authorization });
    if (pathname === '/admin/print3d/status' || pathname === '/admin/print3d/files/status') return new Response(JSON.stringify({ enabled, platePlans }), { status:options.headers.authorization === 'Bearer admin-test' ? 200 : 401 });
    if (pathname === '/products/batch') return new Response(JSON.stringify({ success:true, errors:[] }));
    if (pathname.endsWith('/recipes')) return new Response(JSON.stringify({ id:'central-recipe', saved:true, sha256:createHash('sha256').update(options.body).digest('hex') }));
    if (pathname.endsWith('/files')) return new Response(JSON.stringify({ file:{ id:'central-file' }, saved:true }));
    throw new Error(`Unexpected remote request ${pathname}`);
  } });
  await instance.start();
  t.after(async () => { await instance.close(); await fs.rm(dir, { recursive:true, force:true }); });
  const base = `http://127.0.0.1:${instance.server.address().port}`;
  const headers = { authorization:'Bearer admin-test', 'x-sync-key':'test-sync' };
  const api = (route, method='GET', body, auth=true) => fetch(base + route, { method, headers:{ ...(auth ? headers : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type':'application/json' } : {}) }, body:body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
  return { dir, filePath, draft, calls, api };
}
test('revisão e bytes persistem só localmente; aprovação explícita reenvia contrato canônico ao Synology privado', async t => {
  const { draft, calls, api } = await setup(t);
  const bytes = 'solid test\nendsolid test';
  const reference = { kind:'model', sha256:createHash('sha256').update(bytes).digest('hex'), byte_size:Buffer.byteLength(bytes), original_name:'plate-1.stl' };
  draft.plates[0].files.push(reference);
  assert.equal((await api('/admin/print3d/status','GET',undefined,false)).status,401);
  const save = await api(`/admin/print3d/products/${draft.productId}/recipes`, 'POST', draft);
  assert.equal(save.status,201); const saved = await save.json();
  const form = new FormData(); form.append('file', new Blob([bytes]), reference.original_name);
  const upload = await api(`/admin/print3d/recipes/${saved.id}/files?kind=model&plateId=plate-1`, 'POST', form);
  assert.equal(upload.status,201); const result = await upload.json();
  assert.equal(result.file.sha256, reference.sha256);
  assert.equal(calls.some(c => c.method !== 'GET'), false);
  const downloaded = await api(`/admin/print3d/files/${result.file.id}/download`);
  assert.equal(await downloaded.text(),bytes);
  const revision = await api(`/admin/print3d/products/${draft.productId}/recipes/r1`);
  assert.deepEqual((await revision.json()).draft.plates, draft.plates);
  const approve = await api(`/admin/local-preview/drafts/${draft.productId}/approve`, 'POST', {});
  assert.equal(approve.status,200, await approve.text());
  assert.deepEqual(calls.filter(c => c.method === 'POST').map(c => c.pathname), ['/products/batch', `/admin/print3d/products/${draft.productId}/recipes`, '/admin/print3d/recipes/central-recipe/files']);
  assert.equal(calls.at(-1).auth,'Bearer admin-test');
});
test('arquivo faltando ou flag central desligada bloqueiam antes de gravar produto em produção', async t => {
  const { draft, calls, api } = await setup(t, false);
  assert.equal((await api(`/admin/print3d/products/${draft.productId}/recipes`, 'POST', draft)).status,201);
  const approve = await api(`/admin/local-preview/drafts/${draft.productId}/approve`, 'POST', {});
  assert.equal(approve.status,503);
  assert.equal(calls.some(c => c.method !== 'GET'), false);
});
test('manifesto incompleto não é aprovado; nova tentativa não duplica a revisão', async t => {
  const { draft, calls, api } = await setup(t);
  draft.plates[0].files.push({ kind:'model', sha256:'a'.repeat(64), byte_size:10, original_name:'missing.stl' });
  const route = `/admin/print3d/products/${draft.productId}/recipes`;
  const first = await (await api(route, 'POST', draft)).json();
  const retry = await (await api(route, 'POST', draft)).json();
  assert.equal(first.id, retry.id); assert.equal(retry.saved,false);
  const approval = await api(`/admin/local-preview/drafts/${draft.productId}/approve`, 'POST', {});
  assert.equal(approval.status,409);
  assert.match((await approval.json()).error, /ausente/);
  assert.equal(calls.some(c => c.method !== 'GET'),false);
});
test('descarte é só local, preserva cópia recuperável e não permite excluir revisão central', async t => {
  const { draft, calls, api, filePath } = await setup(t);
  const save = await (await api(`/admin/print3d/products/${draft.productId}/recipes`, 'POST', draft)).json();
  const route = `/admin/print3d/products/${draft.productId}/recipes/r1`;
  assert.equal((await api(route,'DELETE')).status,200);
  const state = JSON.parse(await fs.readFile(filePath,'utf8'));
  assert.equal(state.print3dRecipes[save.id],undefined);
  assert.deepEqual(state.print3dDiscarded[save.id].draft, draft);
  assert.equal((await api(route,'DELETE')).status,409);
  assert.equal(calls.some(c => c.method !== 'GET'),false);
});
test('backend publicado antigo não pode apagar silenciosamente as placas durante aprovação', async t => {
  const { draft, calls, api } = await setup(t, true, false);
  assert.equal((await api(`/admin/print3d/products/${draft.productId}/recipes`, 'POST', draft)).status,201);
  const approve = await api(`/admin/local-preview/drafts/${draft.productId}/approve`, 'POST', {});
  assert.equal(approve.status,503);
  assert.match((await approve.json()).error,/não suporta o plano/);
  assert.equal(calls.some(c => c.method !== 'GET'),false);
});
