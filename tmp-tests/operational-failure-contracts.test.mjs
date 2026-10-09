import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute actual production handlers with simulated transport; no business writes.
function declaration(path, name, predicate = ts.isVariableDeclaration) {
  const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (predicate(node) && node.name?.getText(ast) === name) found = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `Production handler ${name} must exist`);
  return found;
}
function execute(code, dependencies) {
  const context = vm.createContext({ exports: {}, ...dependencies });
  vm.runInContext(ts.transpileModule(code, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText, context);
  return context;
}
const pdv = declaration('services/pdvSerializedInventory.ts', 'buildPdvSearchCards', ts.isFunctionDeclaration);
test('PDV rejects unknown unit stock instead of offering a normal stock card', async () => {
  let stockCards = 0;
  const context = execute(pdv, {
    isAvailableUnit: unit => unit.status === 'available', hasLegacySerializedIdentifier: () => false,
    buildStockProductCard: () => { stockCards++; return {}; },
  });
  await assert.rejects(context.exports.buildPdvSearchCards([{ id: 'phone', track_inventory: true }], {
    listUnitsByProduct: async () => { throw new Error('inventory unavailable'); },
  }), /inventory unavailable/);
  assert.equal(stockCards, 0);
});
test('PDV still accepts confirmed empty unit history as ordinary stock', async () => {
  const context = execute(pdv, {
    isAvailableUnit: () => false, hasLegacySerializedIdentifier: () => false,
    buildStockProductCard: product => ({ id: product.id }),
  });
  const cards = await context.exports.buildPdvSearchCards([{ id: 'cable', track_inventory: true }], {
    listUnitsByProduct: async () => [],
  });
  assert.equal(cards[0].id, 'cable');
});
const pagePath = 'pages/admin/products/SmartphonePhotoIntakePage.tsx';
test('PDV failed lookup clears stale search cards and shows an error', async () => {
  const cards = [], errors = [], searching = [];
  const handler = declaration('components/pdv/ProductSearchSection.tsx', 'handleSearch');
  const context = execute(`const ${handler};`, {
    searchTerm: 'fixture-imei', setSearchCards: value => cards.push(value.length),
    setIsSearching: value => searching.push(value),
    unitService: { searchByIdentifier: async () => { throw new Error('inventory unavailable'); } },
    console: { error() {} }, toast: { error: value => errors.push(value) },
  });
  await vm.runInContext('handleSearch({ autoAddSingle: true })', context);
  assert.deepEqual(cards, [0]);
  assert.deepEqual(searching, [true, false]);
  assert.equal(errors.length, 1);
});
const mutation = declaration(pagePath, 'runMutation');
const update = declaration(pagePath, 'updateSelected');
const confirm = declaration('components/products/photo-intake/PhotoIntakeReviewCard.tsx', 'confirmPrices');
for (const failed of [true, false]) {
  test(`photo price confirmation ${failed ? 'stops after failed save' : 'saves before confirming group'}`, async () => {
    const calls = [], busy = [], errors = [];
    const context = execute(`const ${mutation}; const ${update}; const onUpdate = updateSelected; const ${confirm};`, {
      selected: { id: 'fixture' }, draft: { price_cost: 100, price_retail: 200 },
      matchingGroupCount: 3, applyPricesToGroup: true,
      setBusy: value => busy.push(value), upsertItem: () => calls.push('upsert'),
      toast: { success() {}, error: message => errors.push(message) },
      smartphonePhotoIntakeService: { update: async () => {
        calls.push('save'); if (failed) throw new Error('save failed'); return { id: 'fixture' };
      } },
      onConfirmPrices: async (prices, group) => { calls.push('confirm'); assert.equal(group, true); assert.equal(prices.price_cost, 100); },
    });
    await vm.runInContext('confirmPrices()', context);
    assert.deepEqual(calls, failed ? ['save'] : ['save', 'upsert', 'confirm']);
    assert.deepEqual(busy, [true, false]);
    assert.equal(errors.length, failed ? 1 : 0);
  });
}
const campaignPath = 'services/whatsappStatusCampaignService.ts';
const campaignService = declaration(campaignPath, 'whatsappStatusCampaignService');
const extractRows = declaration(campaignPath, 'extractRows', ts.isFunctionDeclaration);
for (const count of [0, 1, 200, 201, 401]) {
  test(`campaign list reads all ${count} records`, async () => {
    const offsets = [], rows = Array.from({ length: count }, (_, i) => ({ id: String(i) }));
    const context = execute(`${extractRows}; const ${campaignService};`, {
      normalizeCampaign: row => row,
      vpsClient: { get: async path => {
        const params = new URL(path, 'https://fixture.invalid').searchParams;
        const offset = Number(params.get('offset')); offsets.push(offset);
        return { rows: rows.slice(offset, offset + Number(params.get('limit'))) };
      } },
    });
    const actual = await vm.runInContext('whatsappStatusCampaignService.list()', context);
    assert.equal(actual.length, count);
    assert.equal(new Set(actual.map(row => row.id)).size, count);
    assert.deepEqual(offsets, Array.from({ length: Math.floor(count / 200) + 1 }, (_, i) => i * 200));
  });
}
test('campaign list does not return partial success after a later page fails', async () => {
  let calls = 0;
  const context = execute(`${extractRows}; const ${campaignService};`, {
    normalizeCampaign: row => row,
    vpsClient: { get: async () => {
      if (calls++) throw new Error('next page failed');
      return { rows: Array.from({ length: 200 }, (_, i) => ({ id: String(i) })) };
    } },
  });
  await assert.rejects(vm.runInContext('whatsappStatusCampaignService.list()', context), /next page failed/);
});
