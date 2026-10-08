const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Fastify = require('fastify');
const { registerProductReadPrivacy } = require('../services/productReadPrivacy.cjs');
const fixtures = [
  { id: 'cheap', category_id: 'other', price_retail: 1000, status: 'active', is_parent: 0, price_cost: 500 },
  { id: 'middle', category_id: 'phones', price_retail: 1990, status: 'active', is_parent: 0, price_cost: 900 },
  { id: 'expensive', category_id: 'smartphones', price_retail: 3000, status: 'active', is_parent: 0, price_cost: 1500 },
  { id: 'inactive', price_retail: 1990, status: 'inactive', is_parent: 0 },
  { id: 'parent', price_retail: 1990, status: 'active', is_parent: 1 },
];
for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  test(file + ': real listing handler filters before pagination and keeps privacy', async () => {
    const source = fs.readFileSync(file, 'utf8');
    const start = source.indexOf("fastify.get('/products',");
    const end = source.indexOf("fastify.get('/products/by-ids',", start);
    assert.ok(start > 0 && end > start);
    const app = Fastify();
    let lastQuery; let calls = 0;
    registerProductReadPrivacy(app, { getAuth: async () => null });
    const pool = { query: async (sql, values) => {
      calls++; lastQuery = { sql, values: [...values] };
      const parameterFor = clause => {
        const at = sql.indexOf(clause);
        return at < 0 ? undefined : values[(sql.slice(0, at).match(/\?/g) || []).length];
      };
      let rows = fixtures.map(x => ({ ...x }));
      const ids = sql.match(/AND id IN \(([^)]+)\)/);
      if (ids) {
        const index = (sql.slice(0, ids.index).match(/\?/g) || []).length;
        const selected = values.slice(index, index + (ids[1].match(/\?/g) || []).length);
        rows = rows.filter(x => selected.includes(x.id));
      }
      const min = parameterFor('AND price_retail >= ?');
      const max = parameterFor('AND price_retail <= ?');
      const status = parameterFor('AND status = ?');
      if (min !== undefined) rows = rows.filter(x => x.price_retail >= min);
      if (max !== undefined) rows = rows.filter(x => x.price_retail <= max);
      if (status !== undefined) rows = rows.filter(x => x.status === status);
      if (sql.includes('AND (is_parent = 0 OR is_parent IS NULL)')) rows = rows.filter(x => !x.is_parent);
      const category = parameterFor('AND category_id = ?');
      if (category !== undefined) rows = rows.filter(x => x.category_id === category);
      const categories = sql.match(/AND category_id IN \(([^)]+)\)/);
      if (categories) {
        const index = (sql.slice(0, categories.index).match(/\?/g) || []).length;
        const selected = values.slice(index, index + (categories[1].match(/\?/g) || []).length);
        rows = rows.filter(x => selected.includes(x.category_id));
      }
      const limit = values[values.length - 2], offset = values[values.length - 1];
      return [rows.slice(offset, offset + limit)];
    } };
    const dependencies = {
      fastify: app, pool, console: { log() {} },
      normalizeCatalogProductSearchText: x => x || '',
      comboStockSql: () => 'stock_quantity', modelBlueprintSelectSql: () => 'NULL AS blueprint',
      productFamilyNameSelectSql: () => 'NULL AS family_name',
      normalizeProductSpecsRam: x => x || {}, parsePublicJson: (_, fallback) => fallback,
      attachCatalogModelColorImages: rows => rows, buildSeoBaseUrl: () => '',
    };
    new Function(...Object.keys(dependencies), source.slice(start, end))(...Object.values(dependencies));
    const request = async (query, expected) => {
      const response = await app.inject({ url: '/products?' + new URLSearchParams(query) });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json().map(x => x.id), expected);
      assert.ok(response.json().every(x => !Object.hasOwn(x, 'price_cost')));
      assert.equal(response.headers['cache-control'], 'no-store');
    };
    try {
      await request({ in_ids: 'missing', limit: '1' }, []);
      await request({ in_ids: ' middle, middle,expensive ', limit: '1' }, ['middle']);
      assert.match(lastQuery.sql, /id IN \(\?,\?\).*LIMIT \? OFFSET \?/s);
      assert.deepEqual(lastQuery.values.slice(0, 2), ['middle', 'expensive']);
      await request({ in_ids: 'middle,expensive', offset: '1', limit: '1' }, ['expensive']);
      await request({ category: 'phones', limit: '1' }, ['middle']);
      await request({ category: 'phones,smartphones', limit: '1', offset: '1' }, ['expensive']);
      assert.match(lastQuery.sql, /category_id IN \(\?,\?\).*LIMIT \? OFFSET \?/s);
      await request({ category: 'phones,smartphones', min_price: '3000', limit: '1' }, ['expensive']);
      await request({ min_price: '1990', max_price: '1990' }, ['middle']);
      await request({ min_price: '1991', limit: '1' }, ['expensive']);
      await request({ min_price: '999999999' }, []);
      await request({ max_price: '1000' }, ['cheap']);
      await request({ min_price: '0' }, ['cheap', 'middle', 'expensive']);
      await request({ in_ids: 'cheap,middle,expensive', min_price: '1990', max_price: '3000' }, ['middle', 'expensive']);
      await request({ in_ids: 'inactive,parent' }, []);
      await request({ in_ids: 'inactive,parent', status: 'all' }, ['inactive', 'parent']);
      const malicious = "x') OR 1=1 --";
      await request({ in_ids: malicious }, []);
      assert.ok(!lastQuery.sql.includes(malicious));
      assert.equal(lastQuery.values[0], malicious);
      const before = calls;
      await request({ in_ids: ' , , ' }, []);
      assert.equal(calls, before);
      for (const query of [{ min_price: '-1' }, { min_price: '1.99' }, { max_price: 'NaN' },
        { min_price: '' }, { min_price: '1e3' }, { min_price: '9007199254740992' },
        { min_price: '3000', max_price: '1990' }, { in_ids: 'a'.repeat(129) },
        { in_ids: Array.from({ length: 2001 }, (_, i) => String(i)).join(',') }]) {
        const response = await app.inject({ url: '/products?' + new URLSearchParams(query) });
        assert.equal(response.statusCode, 400);
      }
      assert.equal(calls, before, 'invalid filters must not reach MySQL');
    } finally { await app.close(); }
  });
}
