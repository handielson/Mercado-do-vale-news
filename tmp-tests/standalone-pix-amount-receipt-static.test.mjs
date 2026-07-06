import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { moneyInputToCents } from '../utils/moneyInput.js';

assert.equal(moneyInputToCents('1,20'), 120, 'comma decimal must keep R$ 1,20 as 120 cents');
assert.equal(moneyInputToCents('1.20'), 120, 'dot decimal must keep R$ 1.20 as 120 cents');
assert.equal(moneyInputToCents('120'), 12000, 'plain 120 must mean R$ 120,00');
assert.equal(moneyInputToCents('1.200,50'), 120050, 'BR thousands plus decimal must parse correctly');
assert.equal(moneyInputToCents('1,200.50'), 120050, 'US thousands plus decimal must parse correctly');

const page = readFileSync('pages/admin/financial/StandalonePixPage.tsx', 'utf8');
const receipt = readFileSync('utils/printStandalonePixReceipt.ts', 'utf8');

assert.ok(page.includes("import { moneyInputToCents } from '../../../utils/moneyInput'"), 'Standalone Pix page must use shared money parser');
assert.ok(page.includes('printStandalonePixReceipt'), 'Standalone Pix page must expose receipt printing');
assert.ok(page.includes('Imprimir comprovante'), 'Standalone Pix page must show receipt print action');
assert.ok(page.includes("pix.status !== 'approved'"), 'receipt print must only be available after approval');

assert.ok(receipt.includes('Comprovante Pix Avulso'), 'receipt must identify standalone Pix receipt');
assert.ok(receipt.includes('Pagamento aprovado'), 'receipt must show approval status');
assert.ok(receipt.includes('mercado_pago_payment_id'), 'receipt must include Mercado Pago trace when available');
assert.ok(receipt.includes('/ 100'), 'receipt amount must format cents as reais');

console.log('standalone pix amount and receipt checks passed');
