import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const requests = [];
const stopBeforeWrite = new Error('MOCK: captured request, no external write');
function load(path, dependencies = {}) {
    const { outputText } = transpileModule(readFileSync(path, 'utf8'), {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 }, fileName: path,
    });
    const module = { exports: {} };
    runInNewContext(outputText, { module, exports: module.exports, console: { log() {}, warn() {}, error() {} },
        require: name => dependencies[name] || {}, crypto, Date, setTimeout, clearTimeout });
    return module.exports;
}
const calculations = load('utils/saleCalculations.ts');
const { createSale } = load('services/saleService.ts', {
    '../utils/saleCalculations': calculations,
    '../utils/money': load('utils/money.ts'),
    './vpsClient': { vpsClient: { post: async (url, body) => { requests.push({ url, body }); throw stopBeforeWrite; } } },
});
const input = { customer_id: 'test', items: [{ unit_price: 10000, quantity: 1, discount: 0, unit_cost: 6000, is_gift: false }],
    payment_methods: [{ method: 'money', amount: 15000, total_with_fee: 15000 }] };
await assert.rejects(createSale(input), /MOCK/);
assert.equal(requests.length, 1);
assert.equal(requests[0].url, '/table-data/sales');
assert.equal(requests[0].body.total, 10000, 'persist merchandise total, not tendered cash');
assert.equal(requests[0].body.profit, 4000, 'returned change cannot increase profit');
const payments = JSON.parse(requests[0].body.payment_methods);
assert.equal(payments[0].total_with_fee, 10000, 'cash register receives the net payment');
assert.equal(payments[0].change_amount, 5000);
await assert.rejects(createSale({ ...input, payment_methods: [{ method: 'pix', amount: 15000, total_with_fee: 15000 }] }), /excedem/);
await assert.rejects(createSale({ ...input, payment_methods: [{ method: 'money', amount: 5000, total_with_fee: 5000 }] }), /Falta/);
assert.equal(requests.length, 1, 'invalid payments must fail before any API call');
console.log('PDV sale service: total, net cash, profit and validation before persistence passed');
