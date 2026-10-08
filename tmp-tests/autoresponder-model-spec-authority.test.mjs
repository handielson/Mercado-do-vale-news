import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { applyModelSpecsToProducts, smartphoneCatalogSearchSql } from '../services/smartphoneModelSpecs.mjs';
import preferences from '../services/autoresponderCatalogPreferences.cjs';

const paths = ['vps_server.cjs', 'vps_server.js', 'server.js'];
const targets = [
  ['findAutoresponderProductsByTag', ['tag']],
  ['findAutoresponderProductsByCategory', ['category']],
  ['findAutoresponderProductsByCategoryBudget', ['category', 150000]],
  ['findAutoresponderProductById', ['product']],
  ['findAutoresponderProductVariations', [{ id: 'product', model_id: 'model' }]],
  ['findAutoresponderProductsByTokens', [['phone']]],
];
function extract(source, name) {
  const start = source.indexOf(`async function ${name}(`) >= 0
    ? source.indexOf(`async function ${name}(`) : source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, name);
  const end = source.indexOf('\n}', start) + 2;
  return source.slice(start, end);
}

for (const path of paths) for (const [name, args] of targets) {
  test(`${path}: ${name} resolves technical specs from the model before the bot reads them`, async () => {
    const fragments = [extract(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'), name)];
    for (const fragment of fragments) assert.match(fragment, /applyModelSpecsToProducts\(pool,/);
    const original = { id: 'product', status: 'active', stock_quantity: 2, price_retail: 140000,
      model_id: 'model', specs: { nfc: 'Sim', rede_operadora: '5G', ram: '8GB', color: 'Verde' },
      custom_fields: { nfc: 'Sim' } };
    const queries = [];
    const pool = { query: async (sql, params) => {
      queries.push({ sql, params });
      return sql.includes('AS product_id')
        ? [[{ product_id: 'product', id: 'model', category_name: 'Smartphones', template_values: { nfc: 'Não', rede_operadora: '4G', celular_fps_display: '60 Hz' } }]]
        : [[structuredClone(original)]];
    } };
    const fragment = fragments[0].replace(/const \{[^}]+\} = await import\('\.\/services\/smartphoneModelSpecs\.mjs'\);/g, '');
    const fn = vm.runInNewContext(`(${fragment})`, {
      pool, applyModelSpecsToProducts, smartphoneCatalogSearchSql,
      getAutoresponderProductQueryLimit: value => Number(value) || 5,
      modelBlueprintSelectSql: () => 'NULL AS model_blueprint',
      normalizeAutoresponderText: value => String(value).toLowerCase(),
      buildAutoresponderProductSearchScoreSql: () => ({ sql: '0', params: [] }),
    });
    const result = await fn(...args);
    const row = Array.isArray(result) ? result[0] : result;
    assert.equal(row.specs.nfc, 'Não');
    assert.equal(row.specs.rede_operadora, '4G');
    assert.equal(row.specs.ram, '8GB');
    assert.equal(row.specs.color, 'Verde');
    assert.equal(row.custom_fields.nfc, undefined);
    assert.equal(row.stock_quantity, 2);
    assert.equal(row.price_retail, 140000);
    assert.equal(preferences.filterProductsByPreferences([row], { constraints: { nfc: true } }).length, 0);
    assert.equal(queries.length, 2, 'one model lookup per returned batch');
    assert.ok(!queries.some(({ sql }) => /^(INSERT|UPDATE|DELETE)/.test(sql.trim())));
    assert.equal(original.specs.nfc, 'Sim', 'read projection does not rewrite stored products');
  });
}

test('screen preferences prioritize Display FPS when the retired key disagrees', () => {
  assert.equal(preferences.screenScore({ specs: { celular_fps_display: '60 Hz', fps_do_display: '144 Hz' } }).refreshRate, 60);
  assert.equal(preferences.screenScore({ specs: { celular_fps_display: '120 Hz', fps_do_display: '60 Hz' } }).refreshRate, 120);
});

for (const path of paths) for (const tokens of [['5g'], ['4g'], ['8gb', 'verde'], ['capa', '5g'], ['ka-322-5g']]) {
  test(`${path}: selection/count share authoritative search for ${tokens.join(' ')}`, async () => {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const queries = [];
    const context = {
      smartphoneCatalogSearchSql, applyModelSpecsToProducts,
      pool: { query: async (sql, params) => { queries.push({ sql, params }); return [[{ total: 3 }]]; } },
      getAutoresponderProductQueryLimit: () => 20,
      modelBlueprintSelectSql: () => 'NULL AS model_blueprint',
      normalizeAutoresponderText: value => String(value).toLowerCase(),
    };
    context.buildAutoresponderProductSearchScoreSql = vm.runInNewContext(`(${extract(source, 'buildAutoresponderProductSearchScoreSql')})`, context);
    for (const name of ['findAutoresponderProductsByTokens', 'countAutoresponderProductsByTokens']) {
      const fragment = extract(source, name).replace(/const \{[^}]+\} = await import\('\.\/services\/smartphoneModelSpecs\.mjs'\);/g, '');
      await vm.runInNewContext(`(${fragment})`, context)(tokens);
    }
    const networkOnly = tokens.length === 1 && /^[45]g$/.test(tokens[0]);
    assert.equal(queries[0].params.length, tokens.length * 6 + (networkOnly ? 0 : tokens.length * 5));
    assert.equal(queries[1].params.length, networkOnly ? 0 : tokens.length * 5);
    const selectionWhere = sql => sql.slice(sql.indexOf("WHERE status = 'active'"))
      .replace(/ORDER BY[\s\S]*$/, '').replace(/AND stock_quantity > 0/g, '').replace(/\s+/g, ' ').trim();
    assert.equal(selectionWhere(queries[0].sql), selectionWhere(queries[1].sql));
    if (networkOnly) {
      assert.match(queries[1].sql, /JSON_EXTRACT\(pm.template_values,'\$\."rede_operadora"'\)/);
      assert.match(queries[1].sql, /NOT REGEXP/);
      assert.doesNotMatch(queries[1].sql, /CAST\(products\.specs AS CHAR\)|CAST\(products\.custom_fields AS CHAR\)|COALESCE\(name/);
    } else {
      assert.match(queries[1].sql, /JSON_REMOVE\(COALESCE\(pm.template_values/);
      assert.match(queries[1].sql, /JSON_EXTRACT\(products\.specs, '\$\."ram"'\)/);
      assert.match(queries[1].sql, /JSON_EXTRACT\(products\.specs, '\$\."color"'\)/);
      assert.match(queries[1].sql, /JSON_EXTRACT\(products\.specs, '\$\."versao"'\)/);
      assert.match(queries[1].sql, /ELSE CAST\(products\.specs AS CHAR\)/);
    }
  });
}

test('SQL builder refuses unsafe aliases and unknown network parameters', () => {
  assert.throws(() => smartphoneCatalogSearchSql('products; DROP TABLE products'), /Invalid/);
  assert.throws(() => smartphoneCatalogSearchSql().network('5G OR 1=1'), /Invalid/);
});
