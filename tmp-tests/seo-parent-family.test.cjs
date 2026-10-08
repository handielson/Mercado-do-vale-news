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
    assert.throws(() => patchEntry(before.replace('SELECT id FROM products', 'SELECT id AS drift FROM products'), before, after));
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
      if (sql.includes('SELECT id, slug, sku, specs FROM products')) {
        assert.match(sql, /is_parent = 1/);
        assert.match(sql, /status IN/);
        assert.match(sql, /exclude_from_seo/);
        return [parent ? [{ id: 'family-id', slug: 'c17-family', sku: 'PAI', specs: {} }] : []];
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
      getPublicProductDisambiguatedRouteTargetVps: p => p.slug + '-pai',
    };
    vm.runInNewContext(source.slice(start, end), context);
    return { run: context.loadSeoProductBySlug, queries };
  }
  test(`${file}: parent UUID and slug resolve an eligible child and canonical route`, async () => {
    for (const target of ['family-id', 'c17-family', 'c17-family-pai']) {
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
    assert.ok(!queries.some(q => q.sql.includes('SELECT id, slug, sku, specs FROM products')));
  });

  const routeStart = source.indexOf("fastify.get('/products/by-slug/:slug',");
  const routeEnd = source.indexOf('\n});', routeStart) + 4;
  test(`${file}: public parent route selects a visible child by ID, never the parent`, async () => {
    for (const mode of ['uuid', 'slug', 'legacy', 'empty', 'hidden', 'shared', 'no-slug']) {
      const parent = { id: 'ab38421a-7d44-497d-bebc-0bd5830e8ed8', slug: 'family', sku: 'PAI', is_parent: 1, status: 'active', hide_from_catalog: mode === 'hidden' ? 1 : 0 };
      const child = { id: 'child-id', slug: mode === 'shared' ? 'family' : mode === 'no-slug' ? null : 'orange', is_parent: 0, price_retail: 130000 };
      const target = mode === 'uuid' ? parent.id : mode === 'legacy' ? 'family-pai' : 'family';
      let handler, code;
      vm.runInNewContext(source.slice(routeStart, routeEnd), {
        fastify: { get: (_path, fn) => { handler = fn; } },
        pool: { query: async (sql) => {
          if (sql.includes('WHERE parent_id = ?')) {
            assert.match(sql, /hide_from_catalog = 0/);
            assert.match(sql, /is_parent = 0/);
            assert.match(sql, /offer_visibility != 'hidden'/);
            assert.doesNotMatch(sql, /slug IS NOT NULL/);
            return [mode === 'empty' ? [] : [child]];
          }
          if (sql.includes('WHERE id = ?')) return [[parent]];
          if (sql.includes('WHERE ? LIKE')) return [[parent]];
          return [[...(mode === 'legacy' || mode === 'uuid' ? [] : [parent])]];
        } },
        productFamilyNameSelectSql: () => 'name', modelBlueprintSelectSql: () => 'model_id', comboStockSql: () => 'stock_quantity',
        getPublicProductVariantRouteTargetVps: p => p.slug,
        getPublicProductDisambiguatedRouteTargetVps: p => p.slug + '-pai',
        normalizeProductSpecsRam: s => s || {},
      });
      const result = await handler({ params: { slug: target } }, { code: value => { code = value; } });
      if (mode === 'empty' || mode === 'hidden') assert.equal(code, 404);
      else if (mode === 'shared' && file !== 'server.js') assert.equal(result.id, child.id);
      else {
        assert.equal(result.is_parent_redirect, true);
        assert.equal(result.redirect_to_slug, child.id);
        assert.equal(result.price_retail, undefined);
      }
    }
  });
}

test('public page resolves UUIDs through public route and excludes parents before variation grouping', () => {
  const ts = require('typescript');
  const page = fs.readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
  const ast = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function walk(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'allVariants') expression = node.initializer.getText(ast);
    ts.forEachChild(node, walk);
  }
  walk(ast);
  const js = ts.transpileModule(`const options = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const parent = { id: 'parent', is_parent: 1, track_inventory: false };
  const orange = { id: 'orange', is_parent: 0, price_retail: 130000 };
  const context = { product: orange, siblings: [parent, orange, { id: 'hidden', hide_from_catalog: true }, { id: 'inactive', status: 'inactive' }] };
  vm.runInNewContext(js + '\nglobalThis.result = options;', context);
  assert.deepEqual(Array.from(context.result, p => p.id), ['orange', 'orange']);
  const lookup = page.slice(page.indexOf('// 1. Busca Direta'), page.indexOf('// Fallback: se by-slug'));
  assert.match(lookup, /data = await vpsApiService.getProductBySlug\(slug\)/);
  assert.doesNotMatch(lookup, /getProductById/);
  assert.ok(page.indexOf("Number(data?.is_parent) === 1") < page.indexOf('setProduct(displayProduct'));
});
