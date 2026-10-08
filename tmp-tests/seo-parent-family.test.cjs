const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
test('selective deployment preserves unrelated remote code and rejects SEO drift', () => {
  const { patchEntry, BASELINE } = require('../scripts/deploy-parent-public-link.cjs');
  for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
    const before = require('node:child_process').execFileSync('git', ['show', BASELINE + ':' + file], { encoding: 'utf8', maxBuffer: 15e6 });
    const after = fs.readFileSync(file, 'utf8');
    const updated = patchEntry('// remote customization\n' + before, before, after);
    assert.equal(updated.replace(/\r\n/g, '\n'), '// remote customization\n' + after.replace(/\r\n/g, '\n'));
    assert.equal(patchEntry(updated, before, after), updated);
    assert.throws(() => patchEntry(before.replace("AND name != ''", "AND name != 'drift'"), before, after));
    const rich = require('node:child_process').execFileSync('git', ['show', BASELINE + ':vps_server.cjs'], { encoding: 'utf8', maxBuffer: 15e6 });
    const preserved = patchEntry(rich, before, after, rich);
    assert.match(preserved, /getPublicProductDisambiguatedRouteTargetVps\(product\)/);
    assert.match(preserved, /O pai representa a familia/);
  }
});

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('async function loadSeoProductBySlug(slug) {');
  const end = source.indexOf('\n}\n', start) + 3;
  function loader({ parent = true, child = true, direct = false } = {}) {
    const variant = { id: 'child-id', name: 'C17 Plus', slug: 'c17-plus' };
    const queries = [];
    const context = { pool: { query: async (sql, args) => {
      queries.push({ sql, args });
      if (sql.includes('SELECT id FROM products')) {
        assert.match(sql, /is_parent = 1/);
        assert.match(sql, /status IN/);
        assert.match(sql, /exclude_from_seo/);
        return [parent ? [{ id: 'family-id' }] : []];
      }
      if (sql.includes('WHERE parent_id = ?')) {
        assert.equal(args[0], 'family-id');
        assert.match(sql, /is_parent = 0/);
        assert.match(sql, /exclude_from_seo/);
        assert.match(sql, /status IN/);
        assert.match(sql, /ORDER BY.*stock_quantity > 0/);
        return [child ? [variant] : []];
      }
      if (sql.includes('WHERE slug = ?')) return [direct || queries.some(q => q.sql.includes('WHERE parent_id')) && child ? [variant] : []];
      return [[]];
    } }, modelBlueprintSelectSql: () => 'model_id AS blueprint_model_id', comboStockSql: () => 'stock_quantity',
      isUuidLike: x => /^[0-9a-f]{8}-/.test(x),
      getPublicProductVariantRouteTargetVps: p => p.slug + '-laranja-6gb-256gb',
      getPublicProductDisambiguatedRouteTargetVps: p => p.slug,
    };
    vm.runInNewContext(source.slice(start, end), context);
    return { run: context.loadSeoProductBySlug, queries };
  }
  test(`${file}: parent UUID and slug resolve an eligible child and canonical route`, async () => {
    for (const target of ['ab38421a-7d44-497d-bebc-0bd5830e8ed8', 'c17-family']) {
      const { run } = loader();
      const product = await run(target);
      assert.equal(product.id, 'child-id');
      assert.equal(product.seo_route_target, 'c17-plus-laranja-6gb-256gb');
    }
  });
  test(`${file}: unavailable family and nonexistent products remain unavailable`, async () => {
    for (const options of [{ parent: false }, { child: false }]) assert.equal(await loader(options).run('ab38421a-7d44-497d-bebc-0bd5830e8ed8'), null);
  });
  test(`${file}: existing variation slug keeps precedence`, async () => {
    const { run, queries } = loader({ direct: true });
    assert.equal((await run('c17-plus')).id, 'child-id');
    assert.ok(!queries.some(q => q.sql.includes('SELECT id FROM products')));
  });
}
