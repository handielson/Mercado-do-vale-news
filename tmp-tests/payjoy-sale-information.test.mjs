import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PAYJOY_SALE_NOTE, isPayJoySale, withPayJoySaleNote } from '../utils/saleInformation.js';
import { aggregateModelProducts } from '../services/modelProductAggregator.js';

assert.equal(withPayJoySaleNote(undefined, true), PAYJOY_SALE_NOTE);
assert.equal(withPayJoySaleNote(undefined, false), undefined);
const notes = 'Entregar na loja.\nObservação do operador.';
assert.equal(withPayJoySaleNote(notes, false), notes);
const taggedNotes = withPayJoySaleNote(notes, true);
assert.equal(withPayJoySaleNote(taggedNotes, true), taggedNotes);
assert.equal(withPayJoySaleNote(taggedNotes, false), notes);
for (const input of [undefined, null, '', 'Cliente perguntou sobre PayJoy', 'Não foi Venda via PayJoy', 'Venda via PayJoy cancelada']) {
  assert.equal(isPayJoySale({ notes: input }), false);
}
assert.equal(isPayJoySale({ notes: `Observação\r\n${PAYJOY_SALE_NOTE}\r\n` }), true);

const payments = [{ method: 'money', amount: 30000, total_with_fee: 30000 }, { method: 'pix', amount: 70000, total_with_fee: 70000 }];
function modelHistory(payJoy) {
  return aggregateModelProducts({
    model: { id: 'model', name: 'Celular', category_name: 'Smartphones' },
    products: [{ id: 'product', sku: 'TEST', status: 'active', specs: { ram: '8GB', storage: '256GB', color: 'Preto' }, price_cost: 80000, price_retail: 100000 }],
    units: [{ id: 'unit', product_id: 'product', status: 'sold', sale_id: 'sale' }],
    sales: [{ id: 'sale', status: 'completed', notes: withPayJoySaleNote(undefined, payJoy), payment_methods: payments }],
    saleItems: [{ sale_id: 'sale', product_id: 'product', serialized_unit_id: 'unit', quantity: 1, unit_price: 100000, total: 100000, unit_cost: 80000 }],
  });
}
const normal = modelHistory(false);
const payJoy = modelHistory(true);
assert.deepEqual(payJoy.totals, normal.totals, 'PayJoy identification must not alter stock, revenue, cost or profit');
const normalUnit = normal.memoryGroups[0].colors[0].units[0];
const taggedUnit = payJoy.memoryGroups[0].colors[0].units[0];
assert.equal(taggedUnit.payJoy, true, 'serialized phone history must retain the sale marker');
assert.equal(normalUnit.payJoy, false);
assert.deepEqual({ ...taggedUnit, payJoy: false }, normalUnit);

const pdv = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
assert.match(pdv, /\[saleViaPayJoy, setSaleViaPayJoy\] = useState\(false\)/);
assert.match(pdv, /notes: withPayJoySaleNote\(undefined, saleViaPayJoy\)/);
assert.match(pdv, /payment_methods: payments,/);
assert.match(pdv, /checked=\{saleViaPayJoy\}/);
assert.match(pdv, /payJoy=\{saleViaPayJoy\}/);
assert.equal((pdv.match(/setSaleViaPayJoy\(false\)/g) || []).length, 2, 'clear cart and successful sale must reset the marker');
const service = readFileSync('services/saleService.ts', 'utf8');
assert.match(service, /notes: saleInput\.notes/);
assert.match(service, /notes: row\.notes \|\| null/);
assert.doesNotMatch(service, /payjoy/i, 'sale accounting must not branch on the informational marker');
assert.doesNotMatch(readFileSync('types/sale.ts', 'utf8').match(/export type PaymentMethodType =[^;]+;/)[0], /payjoy/i);
for (const file of ['pages/admin/sales/SalesPage.tsx', 'components/admin/sales/SaleDetailsModal.tsx', 'utils/printSaleReceipt.ts']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /isPayJoySale/);
  assert.match(source, /PAYJOY_SALE_NOTE/);
}
assert.match(readFileSync('pages/admin/products/ModelProductAggregatorPage.tsx', 'utf8'), /unit\.payJoy/);
assert.match(readFileSync('components/pdv/ReceiptPreview.tsx', 'utf8'), /payJoy &&/);

// Run the actual receipt generator without a window or physical print. Header
// and presentation dependencies are fixed so the two outputs can be compared.
const receiptSource = readFileSync('utils/printSaleReceipt.ts', 'utf8');
const receiptAst = ts.createSourceFile('printSaleReceipt.ts', receiptSource, ts.ScriptTarget.Latest, true);
const receiptWithoutImports = receiptAst.statements.filter(statement => !ts.isImportDeclaration(statement))
  .map(statement => statement.getText(receiptAst)).join('\n');
const receiptJs = ts.transpileModule(receiptWithoutImports, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const receiptExports = {};
vm.runInNewContext(receiptJs, {
  exports: receiptExports, PAYJOY_SALE_NOTE, isPayJoySale,
  formatBrazilDate: () => '07/10/2026', formatBrazilTime: () => '14:00',
  getHeaderTemplate: () => '', buildGlobalHeader: () => '<h1>Comprovante</h1>',
  buildPaymentPresentation: payment => ({ labelWithInstallments: payment.method, installments: 1, totalWithFee: payment.total_with_fee }),
});
function receiptHtml(enabled) {
  let html;
  const sale = { id: 'test-sale', created_at: '2026-10-07T17:00:00Z', total: 100000, discount_total: 0,
    payment_methods: payments, notes: withPayJoySaleNote(undefined, enabled),
    items: [{ product_id: 'product', product_name: 'Celular teste', quantity: 1, total: 100000 }] };
  const before = JSON.stringify(sale);
  receiptExports.printSaleReceipt(sale, { company_name: 'Loja teste', receipt_width: '80mm' }, undefined, undefined,
    { document: { write(value) { html = value; }, close() {} } });
  assert.equal(JSON.stringify(sale), before, 'receipt generation must not mutate payments or sale');
  return html;
}
const normalHtml = receiptHtml(false);
const taggedHtml = receiptHtml(true);
assert.ok(taggedHtml.includes(PAYJOY_SALE_NOTE));
assert.ok(!normalHtml.includes(PAYJOY_SALE_NOTE));
assert.equal(taggedHtml.replace(`<p style="font-size:12px;font-weight:700;color:#047857;">${PAYJOY_SALE_NOTE}</p>`, ''), normalHtml,
  'the informational line must be the only difference in the receipt');
console.log('PayJoy informational sale marker: persistence, reset, history and unchanged accounting passed');
