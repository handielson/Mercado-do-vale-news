const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesMercadoLivreErpReadKey, registerMercadoLivreRoutes } = require('../services/mercadoLivreServer.cjs');

const key = 'erp-read-only-test-key-'.padEnd(40, 'r');

test('a chave de leitura exige de 32 a 256 bytes e comparação segura', () => {
  assert.equal(matchesMercadoLivreErpReadKey(key, key), true);
  assert.equal(matchesMercadoLivreErpReadKey(key, 'different-read-key-'.padEnd(40, 'x')), false);
  assert.equal(matchesMercadoLivreErpReadKey(key, 'short'), false);
  assert.equal(matchesMercadoLivreErpReadKey('x'.repeat(257), 'x'.repeat(257)), false);
  assert.equal(matchesMercadoLivreErpReadKey(undefined, key), false);
});

test('a chave ERP autoriza consultas GET selecionadas e não revela configuração OAuth', async () => {
  const previous = process.env.MERCADO_LIVRE_ERP_READ_KEY;
  process.env.MERCADO_LIVRE_ERP_READ_KEY = key;
  const app = require('fastify')();
  const pool = { query: async () => [[{
    access_token: 'private-access-token', refresh_token: 'private-refresh-token',
    client_id: 'private-client-id', client_secret: 'private-client-secret',
    user_id: '7', nickname: 'Conta de teste',
  }]] };
  const requireSyncKeyOrAdmin = async (_request, reply) => reply.code(401).send({ error: 'Unauthorized' });
  registerMercadoLivreRoutes(app, { pool, requireSyncKeyOrAdmin });

  try {
    for (const path of ['/mercado-livre/settings', '/api/mercado-livre/settings']) {
      const response = await app.inject({ method: 'GET', url: path, headers: { 'x-erp-read-key': key } });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { connected: true, userId: '7', nickname: 'Conta de teste' });
      assert(!response.body.includes('private-'));
    }

    for (const [path, method] of [
      ['/mercado-livre/settings', 'PATCH'],
      ['/api/mercado-livre/settings', 'PATCH'],
      ['/mercado-livre/products/items/MLB123/price', 'POST'],
      ['/api/mercado-livre/products/items/MLB123/price', 'POST'],
    ]) {
      assert.equal((await app.inject({ method, url: path, headers: { 'x-erp-read-key': key }, payload: { stockSyncEnabled: true } })).statusCode, 401);
    }

    for (const path of [
      '/mercado-livre/products/candidates', '/api/mercado-livre/products/candidates',
      '/mercado-livre/products/links', '/api/mercado-livre/oauth/auth',
    ]) {
      assert.equal((await app.inject({ method: 'GET', url: path, headers: { 'x-erp-read-key': key } })).statusCode, 401);
    }

    for (const path of [
      '/mercado-livre/products/discover', '/api/mercado-livre/products/discover',
      '/mercado-livre/products/items/MLB123/price', '/api/mercado-livre/products/items/MLB123/price',
      '/mercado-livre/preparation/categories/MLB123', '/api/mercado-livre/preparation/categories/MLB123',
    ]) {
      const response = await app.inject({ method: 'GET', url: path, headers: { 'x-erp-read-key': key } });
      assert.notEqual(response.statusCode, 401, `${path} must pass the dedicated GET allowlist`);
    }
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY = previous;
  }
});
