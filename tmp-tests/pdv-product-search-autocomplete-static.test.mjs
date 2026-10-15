import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');

assert.match(
  source,
  /type ProductSearchOptions = \{\s*autoAddSingle\?: boolean\s*\}/s,
  'Product search must expose an explicit auto-add option',
);

assert.match(
  source,
  /setTimeout\(\(\) => handleSearch\(\{ autoAddSingle: false \}\), 500\)/,
  'Debounced typing search must only list results, not auto-add or switch tabs',
);

assert.match(
  source,
  /if \(cards\.length === 1 && options\.autoAddSingle === true\)/,
  'Single-result auto-add must be limited to explicit actions',
);

assert.match(
  source,
  /if \(e\.key === 'Enter'\) handleSearch\(\{ autoAddSingle: true \}\)/,
  'Enter must keep the scanner/keyboard shortcut for explicit single-result add',
);

// Execute the actual add handler: consecutive scanner input replaces the selected code.
const handlerSource = source.slice(source.indexOf('    const addCardToCart ='), source.indexOf('    const handleSearch ='));
const handlerJs = ts.transpileModule(handlerSource + '\nreturn addCardToCart;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const events = [];
const input = { value: '789000000001', selected: false, focus() { events.push('focus'); }, select() { this.selected = true; events.push('select'); } };
const cart = [];
const add = new Function('onAddToCart', 'toast', 'quantities', 'setQuantities', 'searchInputRef', 'openSerializedConfirmation', 'getSelectedUnit', handlerJs)(
  (product, quantity) => { cart.push({ product, quantity }); events.push('add'); },
  { success() {}, error() {} }, {}, () => {}, { current: input },
  () => events.push('confirm-imei'), () => ({ id: 'unit-test' }),
);
const card = id => ({ id, kind: 'stock-product', product: { id, name: 'Teste', track_inventory: true }, maxQuantity: 2 });
await add(card('first'));
assert.deepEqual(events, ['add', 'focus', 'select']);
assert.equal(input.value, '789000000001', 'The scanned code stays visible and selected');
input.value = input.selected ? '789000000002' : input.value + '789000000002';
input.selected = false;
await add(card('second'));
assert.equal(input.value, '789000000002', 'The next scan replaces the previous code');
assert.equal(input.selected, true);
assert.equal(cart.length, 2);
events.length = 0;
await add({ ...card('out-of-stock'), maxQuantity: 0 });
assert.deepEqual(events, [], 'Rejected additions do not steal focus');
await add({ ...card('phone'), kind: 'serialized-product', unitOptions: [] });
assert.deepEqual(events, ['confirm-imei'], 'Serialized units still require IMEI confirmation');
assert.equal(cart.length, 2);

console.log('pdv product search autocomplete and consecutive scanner checks passed');
