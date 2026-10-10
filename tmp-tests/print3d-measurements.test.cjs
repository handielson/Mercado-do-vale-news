const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, requireImpl = name => require(name)) {
  const context = { exports: {}, require: requireImpl };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
const measurements = load('utils/print3dMeasurements.js');
const product = { specs: { material: 'PETG', size: 'Grande' }, dimensions: { height_cm: 3.5, width_cm: 2, depth_cm: 1.2 }, weight_kg: 0.012 };
test('combines existing dimensions and weight with units and Brazilian decimals', () => {
  assert.equal(measurements.formatPrint3dMeasurements(product), 'Altura: 35 mm • Largura: 20 mm • Profundidade: 12 mm • Peso: 0,012 kg');
});
test('partial measurements invent nothing; API JSON dimensions are supported', () => {
  assert.equal(measurements.formatPrint3dMeasurements({ dimensions: { height_cm: '2,5', width_cm: null, depth_cm: -1 }, weight_kg: Infinity }), 'Altura: 25 mm');
  assert.equal(measurements.formatPrint3dMeasurements({}), '');
  assert.equal(measurements.formatPrint3dMeasurements({ dimensions: JSON.stringify({ height_cm: 2 }) }), 'Altura: 20 mm');
});
test('mm input converts to canonical cm and back without changing kg or duplicating data', () => {
  for (const { key } of measurements.PRINT3D_MEASUREMENT_FIELDS.filter(field => field.unit === 'mm')) {
    for (const [mm,cm] of [[35,3.5],[2.9,0.29],[0.125,0.0125],[1050,105]]) {
      assert.equal(measurements.print3dMeasurementStoredValue(key,String(mm)),cm);
      assert.equal(measurements.print3dMeasurementDisplayValue(key,cm),mm);
    }
    assert.equal(measurements.print3dMeasurementStoredValue(key,'2,9'),0.29);
    assert.equal(measurements.print3dMeasurementStoredValue(key,''),null);
    assert.equal(measurements.print3dMeasurementDisplayValue(key,null),'');
    assert.equal(measurements.print3dMeasurementDisplayValue(key,0),0);
  }
  assert.equal(measurements.print3dMeasurementStoredValue('weight_kg','0.012'),0.012);
  assert.equal(measurements.print3dMeasurementDisplayValue('weight_kg',0.012),0.012);
});
test('derived display preserves source data and legacy size without measurements', () => {
  const publicSpecs = measurements.print3dPublicMeasurementSpecs(product);
  assert.equal(publicSpecs.material, 'PETG');
  assert.equal(publicSpecs.piece_measurements, measurements.formatPrint3dMeasurements(product));
  assert(!('size' in publicSpecs));
  assert.equal(product.specs.size, 'Grande');assert.equal(product.dimensions.height_cm, 3.5);
  assert.equal(measurements.print3dPublicMeasurementSpecs({ specs: { size: '15 cm' } }).size, '15 cm');
});
test('both storefronts consume existing fields supplied by the public API', () => {
  const { projectStorefrontProduct } = require('../services/productStorefrontOffer.cjs');
  for (const storefront of ['mercado_do_vale', 'loja_3d']) {
    const projected = projectStorefrontProduct({ ...product, id: 'local-test', sku: 'TEST', status: 'active', is_print3d: true, description: '<h2>Original</h2>' }, { storefront, publication_status: 'published', price_retail: 100 });
    assert.equal(projected.is_print3d,true);
    assert.equal(measurements.formatPrint3dMeasurements(projected), measurements.formatPrint3dMeasurements(product));
    assert.equal(projected.description, '<h2>Original</h2>');
  }
  for (const file of ['pages/store/Print3dProductPage.tsx', 'pages/store/PublicProductPage.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /print3dPublicMeasurementSpecs\(/);
    assert.match(source, /piece_measurements: 'Medidas do produto'/);
  }
  assert.match(fs.readFileSync('services/productStorefrontOffersServer.cjs','utf8'), /p\.dimensions, p\.weight_kg/);
});
test('existing validation accepts optional measures and rejects invalid dimensions', () => {
  const { productSchema } = load('schemas/product.ts', name => name.endsWith('/field-standards') ? { ProductStatus: { ACTIVE: 'active', INACTIVE: 'inactive' } } : require(name));
  const input = { model_id: '', name: 'Peça teste', sku: 'TEST', price_cost: 0, price_retail: 100, price_reseller: 100, price_wholesale: 100, status: 'active', track_inventory: true, stock_quantity: 0, is_print3d: true, print3d_preorder_enabled: true, ...product };
  assert(productSchema.safeParse(input).success);
  assert(productSchema.safeParse({ ...input, dimensions: {}, weight_kg: null }).success);
  for (const value of [-1, 106, Infinity]) {
    const result = productSchema.safeParse({ ...input, dimensions: { height_cm: value } });
    assert(!result.success);
    assert(result.error.issues.some(issue => issue.path.join('.') === 'dimensions.height_cm'));
  }
});
test('actual public detail route reads and returns the canonical measurements for both sites', async () => {
  const app = require('fastify')();
  const { registerProductStorefrontOfferRoutes } = require('../services/productStorefrontOffersServer.cjs');
  const pool = { query: async sql => {
    assert.match(sql, /p\.dimensions, p\.weight_kg/);
    return [[{ ...product, dimensions: JSON.stringify(product.dimensions), specs: JSON.stringify(product.specs), id: 'test', status: 'active', is_print3d: 1, publication_status: 'published', price_retail: 100, product_id: 'test' }]];
  }};
  registerProductStorefrontOfferRoutes(app, { pool, requireSyncKeyOrAdmin: async () => {}, mdvReady: true, shippingEnv: {} });
  try {
    await app.ready();
    for (const storefront of ['mercado_do_vale','loja_3d']) {
      const response = await app.inject({ method:'GET',url:`/storefronts/${storefront}/products/test` });
      assert.equal(response.statusCode,200,response.body);
      const row = response.json();
      assert.deepEqual(row.dimensions, product.dimensions);
      assert.equal(row.weight_kg,product.weight_kg);
      assert.equal(measurements.formatPrint3dMeasurements(row),measurements.formatPrint3dMeasurements(product));
    }
  } finally { await app.close(); }
});
