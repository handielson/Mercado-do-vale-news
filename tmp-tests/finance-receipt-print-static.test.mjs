import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/financial/FinancialPage.tsx', 'utf8');
const receipt = readFileSync('utils/printContaReceipt.ts', 'utf8');
const service = readFileSync('services/blingFinanceService.ts', 'utf8');
const types = readFileSync('types/finance.ts', 'utf8');

assert.match(page, /function mergeContaForPrint/, 'FinancialPage must merge Bling detail with the list row before printing');
assert.match(page, /async function enrichContaBorderos/, 'FinancialPage must enrich printed accounts with Bling borderos');
assert.match(page, /blingFinanceService\.getBordero\(tab, id\)/, 'FinancialPage must fetch bordero details before printing');
assert.match(page, /pickLongerText\(conta\.historico, detalhe\.historico\)/, 'print merge must preserve the richest history text');
assert.match(page, /pickLongerText\(conta\.contato\?\.nome, detalhe\.contato\?\.nome\)/, 'print merge must preserve the fullest contact name');
assert.doesNotMatch(page, /printContaReceipt\(detalhe \|\| conta/, 'account receipt must not drop list fields when detail is partial');
assert.doesNotMatch(page, /printPaymentReceipt\(detalhe \|\| conta/, 'payment receipt must not drop list fields when detail is partial');
assert.doesNotMatch(page, /printDebtClearance\(detalhe \|\| conta/, 'clearance receipt must not drop list fields when detail is partial');

assert.match(receipt, /function escapeHtml/, 'receipt fields must be escaped before interpolation');
assert.match(receipt, /function formatBorderoDetails/, 'receipt must render detailed bordero history');
assert.match(receipt, /Baixa \$\{index \+ 1\}/, 'receipt must label each detailed payment entry');
assert.match(receipt, /overflow-wrap: anywhere/, 'receipt must wrap long names and history instead of clipping them');
assert.match(receipt, /word-break: break-word/, 'receipt must force long receipt text to fit the thermal width');

assert.match(service, /action: 'get-bordero'/, 'finance service must call the VPS bordero read action');
assert.match(types, /interface ContaBordero/, 'finance types must describe Bling bordero details');

console.log('finance receipt print static checks ok');
