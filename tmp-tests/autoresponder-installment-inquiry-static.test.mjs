import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../vps_server.js', import.meta.url), 'utf8');

assert.match(source, /function isAutoresponderInstallmentInquiry\(message\)/);
assert.match(source, /if \(isAutoresponderInstallmentInquiry\(message\)\) return null;/);
assert.match(source, /formatAutoresponderSelectedProductInstallmentTable\(/);
assert.match(source, /status: 'awaiting_card_installments'/);
assert.match(source, /1x a 12x no cartao/);
assert.match(source, /intent: 'installment_missing_product_context'/);

const inquiryStart = source.indexOf('function isAutoresponderInstallmentInquiry');
const priorityStart = source.indexOf('async function buildAutoresponderPriorityProductSearchReplyData');
assert.ok(inquiryStart >= 0 && priorityStart > inquiryStart, 'installment detector must be available before product search guard');

console.log('autoresponder installment inquiry static checks passed');
