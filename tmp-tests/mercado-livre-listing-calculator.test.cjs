const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, requireImpl) {
  const context = { exports: {}, require: requireImpl };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, context);
  return context.exports;
}
const preparation = load('services/mercadoLivrePreparation.ts', () => assert.fail('Unexpected import'));
const data = { sellerId: '7', categoryId: 'MLB58500', listingTypeId: 'gold_special', shippingMode: 'me2',
  logisticType: 'drop_off', priceCents: 2500, salePriceCents: 2400, variations: [], promotion: false };

test('linked child calculator receives live listing context without publishing', () => {
  let stateIndex = 0, appliedPrice;
  const hooks = { ...React, useMemo: fn => fn(), useState: initial => {
    const index = stateIndex++;
    return [index === 0 ? data : index === 1 ? 2500 : typeof initial === 'function' ? initial() : initial,
      value => { if (index === 1) appliedPrice = value; }];
  } };
  let calculatorProps;
  const component = load('components/products/sections/MercadoLivreListingPrice.tsx', name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return require(name);
    if (name.endsWith('/mercadoLivrePreparation')) return preparation;
    if (name.endsWith('/mercadoLivreService')) return { mercadoLivreService: new Proxy({}, { get: () => () => assert.fail('No price write during calculation') }) };
    if (name.endsWith('/CurrencyInput')) return { CurrencyInput: () => null };
    if (name.endsWith('/MercadoLivrePricingPolicy')) return { __esModule: true, default: props => { calculatorProps = props; return null; }, PricingSummary: () => null };
    assert.fail(name);
  });
  const props = { itemId: 'MLB123', parentId: 'parent', product: { id: 'child', sku: 'OIS063B', name: 'Branco', weight_kg: 0.185, price_retail: 2500 } };
  const element = component.MercadoLivreListingPrice(props);
  const html = renderToStaticMarkup(element);
  assert.match(html, /25,00/); assert.match(html, /24,00/); assert.match(html, /Calculadora de taxas e lucro/);
  const draft = calculatorProps.batch.drafts[0];
  assert.equal(draft.productId, 'child'); assert.equal(draft.sku, 'OIS063B');
  assert.equal(draft.fields.categoryId.value, 'MLB58500');
  assert.equal(draft.fields.commercialPolicy.value.listingTypeId, 'gold_special');
  assert.equal(draft.fields.commercialPolicy.value.shipping.mode, 'me2');
  assert.equal(calculatorProps.existingListing, true);
  assert.equal(calculatorProps.logisticType, 'drop_off');
  assert.equal(appliedPrice, undefined);
});
