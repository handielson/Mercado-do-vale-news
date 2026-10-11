'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { nextProductSku, withProductSku } = require('../services/productSku.cjs');

test('quatro letras reconhecíveis, acentos, números e sequência por prefixo', () => {
  assert.equal(nextProductSku('Suporte para LNB', []), 'SLNB0001');
  assert.equal(nextProductSku('Chaveiro personalizado', ['CHAV0001', 'chav0002', 'SFKU3XMV', 'VASO9999']), 'CHAV0003');
  assert.equal(nextProductSku('Vaso decorativo', []), 'VASO0001');
  assert.match(nextProductSku('Ímã 3D', []), /^[A-Z]{4}\d{4}$/);
  assert.throws(() => nextProductSku('', []), /nome/);
  assert.throws(() => nextProductSku('Vaso', ['VASO9999']), /esgotou/);
});

function mockPool() {
  const rows = new Map();
  let tail = Promise.resolve();
  const events = [];
  return { rows, events, async getConnection() {
    let unlock;
    return { async query(sql, args) {
      events.push(sql);
      if (sql.includes('GET_LOCK')) {
        const previous = tail;
        tail = new Promise(resolve => { unlock = resolve; });
        await previous;
        return [[{ acquired: 1 }]];
      }
      if (sql.includes('RELEASE_LOCK')) { unlock(); return [[{ released: 1 }]]; }
      if (sql.includes('WHERE id=')) return [[...(rows.has(args[0]) ? [rows.get(args[0])] : [])]];
      if (sql.includes('WHERE sku LIKE')) return [[...rows.values()].filter(row => row.sku?.startsWith(args[0].slice(0, -1)))];
      if (sql.includes('WHERE sku=')) return [[...rows.values()].filter(row => row.sku === args[0])];
      throw new Error(sql);
    }, release() { events.push('release'); } };
  } };
}

test('cadastros simultâneos só reservam o próximo SKU após a escrita anterior', async () => {
  const pool = mockPool();
  const products = Array.from({ length: 10 }, (_, index) => ({ id: String(index), name: 'Chaveiro', sku: '' }));
  await Promise.all(products.map(product => withProductSku(pool, product, async () => {
    await new Promise(resolve => setImmediate(resolve));
    pool.rows.set(product.id, { ...product });
  })));
  assert.deepEqual(products.map(product => product.sku), Array.from({ length: 10 }, (_, index) => `CHAV${String(index + 1).padStart(4, '0')}`));
  assert.equal(pool.events.filter(event => event === 'release').length, 10);
});

test('nome alterado não muda SKU existente e SKU manual é preservado', async () => {
  const pool = mockPool();
  pool.rows.set('old', { id: 'old', sku: 'SFKU3XMV' });
  const existing = { id: 'old', name: 'Outro nome', sku: '' };
  await withProductSku(pool, existing, async () => {});
  assert.equal(existing.sku, 'SFKU3XMV');
  assert.equal(existing.name, 'Outro nome');
  const manual = { id: 'new', name: 'Suporte', sku: 'MEU-SKU' };
  await withProductSku(pool, manual, async () => {});
  assert.equal(manual.sku, 'MEU-SKU');
  assert.equal(manual.name, 'Suporte');
});

test('nome recebe SKU automático antes da escrita, sem marcação nem duplicação no reenvio', async () => {
  const pool = mockPool();
  pool.rows.set('previous', { id: 'previous', sku: 'VASO0002' });
  const product = { id: 'new', name: ' Vaso decorativo ', sku: '' };
  await withProductSku(pool, product, async () => {
    assert.equal(product.sku, 'VASO0003');
    assert.equal(product.name, 'Vaso decorativo - VASO0003');
    pool.rows.set(product.id, { ...product });
  });
  await withProductSku(pool, product, async () => {
    assert.equal(product.name, 'Vaso decorativo - VASO0003');
  });
  assert.doesNotMatch(product.name, /[`<>]/);
});

test('falha libera reserva e colisão de rascunho recusa gravação sem mudar identidade', async () => {
  const pool = mockPool();
  const draft = { id: 'draft', name: 'Vaso', sku: 'VASO0001' };
  pool.rows.set('central', { id: 'central', sku: 'VASO0001' });
  let writes = 0;
  await assert.rejects(withProductSku(pool, draft, async () => { writes++; }), /já está em uso/);
  assert.equal(writes, 0);
  assert.equal(draft.sku, 'VASO0001');
  await assert.rejects(withProductSku(pool, { id: 'fail', name: 'Chaveiro' }, async () => { throw new Error('write failed'); }), /write failed/);
  const next = { id: 'next', name: 'Chaveiro' };
  await withProductSku(pool, next, async () => {});
  assert.equal(next.sku, 'CHAV0001');
});

test('transação usa a conexão reservada sem liberar o lock antes do commit', async () => {
  const pool = mockPool();
  let connections = 0;
  const acquire = pool.getConnection.bind(pool);
  pool.getConnection = async () => { connections++; return acquire(); };
  await withProductSku(pool, { id: '1', name: 'Vaso' }, async db => {
    const connection = await db.getConnection();
    connection.release();
    assert.equal(pool.events.includes('release'), false);
    assert.equal(pool.events.some(event => event.includes('RELEASE_LOCK')), false);
  });
  assert.equal(connections, 1);
  assert.equal(pool.events.at(-1), 'release');
});

test('os dois entrypoints usam geração backend e o formulário não sugere SKU antigo', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  for (const file of ['vps_server.cjs', 'vps_server.js']) assert.match(read(file), /withProductSku\(pool, p/);
  assert.doesNotMatch(read('components/products/ProductForm.tsx'), /Auto-generated base SKU|mergedData\.sku = `\$\{brandPrefix\}/);
  assert.doesNotMatch(read('components/products/sections/ProductBasicInfo.tsx'), /setValue\('sku', `\$\{p\.sku\}/);
});
