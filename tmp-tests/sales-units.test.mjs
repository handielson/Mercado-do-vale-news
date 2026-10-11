import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { salesUnitCatalog, normalizeSalesUnit } from '../services/salesUnitCatalog.js';
import { buildVpsUrl } from '../services/vpsTransport.js';
const { createLocalCatalogPreviewServer } = createRequire(import.meta.url)('../services/localCatalogPreviewServer.cjs');
const route = '/admin/preferences/products.sales-units.v1';
test('unidades padrão, personalizadas e duplicadas', () => {
    const units = salesUnitCatalog([' par ', 'fardo', 'FARDO']);
    assert.ok(units.includes('UN')); assert.ok(units.includes('KIT'));
    assert.equal(units.filter(unit => unit === 'PAR').length, 1);
    assert.equal(units.filter(unit => unit === 'FARDO').length, 1);
    for (const value of ['', '<script>', 'a'.repeat(21), null, 'A\nB'])
        assert.throws(() => normalizeSalesUnit(value));
    assert.throws(() => salesUnitCatalog({}));
});
test('GET e PATCH de unidades ficam na camada local, produção mantém rota central', () => {
    for (const method of ['GET', 'PATCH']) {
        assert.ok(buildVpsUrl(route, {env:{DEV:true,MODE:'development'},runtimeHostname:'127.0.0.1',method}).startsWith('/local-catalog-preview'));
        assert.ok(!buildVpsUrl(route, {env:{DEV:false,MODE:'production'},runtimeHostname:'mercadodovale.com.br',method}).startsWith('/local-catalog-preview'));
    }
});
test('novas unidades persistem e se mesclam sem escrever na API central', async t => {
    const dir = await mkdtemp(join(tmpdir(), 'mdv-sales-units-'));
    const calls = [];
    const options = {port:0,draftFile:join(dir,'drafts.json'),fetchImpl:async (url, request) => {
        calls.push(request.method);
        return new Response(JSON.stringify({value:['JOGO']}), {headers:{'content-type':'application/json'}});
    }};
    let app = createLocalCatalogPreviewServer(options);
    await app.start();
    t.after(async () => {await app.close(); await rm(dir,{recursive:true,force:true});});
    let base = `http://127.0.0.1:${app.server.address().port}`;
    const patch = await fetch(base+route,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({value:['UN','FARDO']})});
    assert.equal(patch.status,200);
    assert.deepEqual((await patch.json()).value,['JOGO','UN','FARDO']);
    assert.equal((await fetch(base+route,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({value:['<bad>']})})).status,400);
    await app.close(); app = createLocalCatalogPreviewServer(options); await app.start();
    base = `http://127.0.0.1:${app.server.address().port}`;
    assert.deepEqual((await (await fetch(base+route)).json()).value,['JOGO','UN','FARDO']);
    assert.ok(calls.every(method => method === 'GET'));
});
