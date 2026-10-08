const test = require('node:test');
const assert = require('node:assert/strict');
const core = import('../services/smartphoneModelSpecs.mjs');
test('model changes replace stale technical copies but preserve unit and variation identity', async () => {
  const { applySmartphoneModelSpecs } = await core;
  const product = { model_id: 'm', specs: { rede_operadora: '5G', nfc: 'Sim', ram: '8GB', color: 'Verde', storage: '256GB', version: 'Global', battery_health: 98, serial: 'test-unit', _acquisition_cost: 90000 }, custom_fields: { rede_operadora: '5G' }, price_retail: 120000, stock_quantity: 2 };
  const resolved = applySmartphoneModelSpecs(product, { category_name: 'Smartphones', template_values: { rede_operadora: '4G', ram: '4GB', color: 'Preto' } });
  assert.equal(resolved.specs.rede_operadora, '4G'); assert.equal(resolved.specs.nfc, undefined);
  for (const key of ['ram', 'color', 'storage', 'version', 'battery_health', 'serial', '_acquisition_cost']) assert.equal(resolved.specs[key], product.specs[key]);
  assert.equal(resolved.price_retail, product.price_retail); assert.equal(resolved.stock_quantity, 2);
  assert.deepEqual(resolved.custom_fields, {}); assert.equal(product.specs.rede_operadora, '5G');
});
test('empty model removes stale variation values rather than falling back', async () => {
  const { applySmartphoneModelSpecs } = await core;
  assert.deepEqual(applySmartphoneModelSpecs({ specs: { rede_operadora: '5G', chipset: 'old', ram: '8GB' } }, { category_name: 'Celulares', template_values: {} }).specs, { ram: '8GB', _price_group_network: '5G' });
});
test('authoritative smartphone without model cannot revive stale variation copies', async () => {
  const { applySmartphoneModelSpecs } = await core;
  assert.deepEqual(applySmartphoneModelSpecs({ model_specs_authoritative: true, specs: { rede_operadora: '5G', color: 'Verde' } }, {}).specs, { color: 'Verde', _price_group_network: '5G' });
});
test('model-only metadata never leaks into technical specs and FPS uses canonical field', async () => {
  const { modelTechnicalSpecs } = await core;
  assert.deepEqual(modelTechnicalSpecs({ fps_do_display: 'Até 120Hz, toque 240Hz', price_retail: 1, ncm: '12345678', mercado_livre: { category_id: 'x' }, bling_family: {} }), { celular_fps_display: '120 Hz' });
  assert.deepEqual(modelTechnicalSpecs({ fps_do_display: '120Hz', celular_fps_display: '90 Hz' }), { celular_fps_display: '90 Hz' });
});
test('accessories remain unchanged and batch lookup resolves smartphone models', async () => {
  const { applySmartphoneModelSpecs, applyModelSpecsToProducts } = await core;
  const accessory = { id: 'a', model_id: 'a', specs: { material: 'PLA' } };
  assert.equal(applySmartphoneModelSpecs(accessory, { category_name: 'Capinhas', template_values: {} }), accessory);
  let calls = 0;
  const db = { query: async () => { calls++; return [[{ id: 'm', product_id: 'p', category_name: 'Smartphones', template_values: '{"rede_operadora":"4G"}' }, { id: 'a', product_id: 'a', category_name: 'Capinhas' }]]; } };
  const result = await applyModelSpecsToProducts(db, [{ id: 'p', model_id: 'm', specs: { rede_operadora: '5G' } }, accessory]);
  assert.equal(calls, 1); assert.equal(result[0].specs.rede_operadora, '4G'); assert.equal(result[1], accessory);
});
test('product category keeps authoritative empty model after missing or deleted model', async () => {
  const { applyModelSpecsToProducts } = await core;
  const db = { query: async () => [[{ product_id: 'p', category_name: 'Smartphones', template_values: null }]] };
  assert.deepEqual((await applyModelSpecsToProducts(db, [{ id: 'p', model_id: 'deleted', specs: { rede_operadora: '5G', ram: '8GB' } }]))[0].specs, { ram: '8GB', _price_group_network: '5G' });
});
test('model correction changes public network without changing historical price group identity', async () => {
  const { applySmartphoneModelSpecs, stripModelOwnedSpecs } = await core;
  const { configuration } = require('../services/smartphonePriceGroupsCore.cjs');
  const oldModel = { category_name: 'Smartphones', template_values: { rede_operadora: '5G' } };
  const corrected = { ...oldModel, template_values: { rede_operadora: '4G' } };
  const raw = { model_id: 'm', specs: { ram: '8GB', storage: '256GB', rede_operadora: '5G', color: 'Verde' }, price_retail: 120000, stock_quantity: 2 };
  const before = configuration(raw, oldModel);
  const projected = applySmartphoneModelSpecs(raw, corrected);
  assert.equal(projected.specs.rede_operadora, '4G');
  assert.equal(configuration(projected, corrected).id, before.id);
  assert.equal(configuration({ ...projected, specs: stripModelOwnedSpecs(projected.specs) }, corrected).id, before.id);
  assert.equal(projected.price_retail, raw.price_retail); assert.equal(projected.stock_quantity, raw.stock_quantity);
});
test('financial discriminator freezes template fallback and explicit empty value across projections', async () => {
  const { applySmartphoneModelSpecs, stripModelOwnedSpecs } = await core;
  const { configuration } = require('../services/smartphonePriceGroupsCore.cjs');
  const model = { category_name: 'Smartphones', template_values: { rede_operadora: '4G' } };
  for (const specs of [{ ram: '8GB', storage: '256GB' }, { ram: '8GB', storage: '256GB', _price_group_network: '' }]) {
    const raw = { model_id: 'm', specs };
    const before = configuration(raw, model).id;
    const projected = applySmartphoneModelSpecs(raw, model);
    const changed = { ...model, template_values: { rede_operadora: '5G' } };
    assert.equal(configuration(projected, changed).id, before);
    assert.equal(configuration({ ...projected, specs: stripModelOwnedSpecs(projected.specs, changed.template_values) }, changed).id, before);
  }
});
test('custom field cleanup preserves unknown operational flags and inherited cost setting', async () => {
  const { applySmartphoneModelSpecs } = await core;
  const result = applySmartphoneModelSpecs({ specs: { ram: '8GB' }, custom_fields: { featured: true, inherit_parent_cost: true, external_flag: 'keep', rede_operadora: '5G', battery_mah: 'old' } },
    { category_name: 'Smartphones', template_values: { rede_operadora: '4G', battery_mah: 5000, featured: true } });
  assert.deepEqual(result.custom_fields, { featured: true, inherit_parent_cost: true, external_flag: 'keep' });
  assert.equal(result.model_template_values.featured, undefined);
});
