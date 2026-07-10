import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');

assert.match(source, /const PDV_PIX_STATUS_POLLING_MS = 3000/, 'PDV must use the same short polling cadence as Pix Avulso');
assert.match(source, /if \(!pdvPixPayment \|\| !\['creating', 'pending'\]\.includes\(pdvPixPayment\.status\)\) return/, 'PDV must only poll a payable Pix');
assert.match(source, /pdvDisplayService\.refreshPixPaymentStatus\(pdvPixPayment\.id\)/, 'PDV must refresh the Mercado Pago payment automatically');
assert.match(source, /addApprovedPdvPixPayment\(payment\)/, 'an approved PDV Pix must become a sale payment automatically');
assert.match(source, /window\.setInterval\(pollPdvPixStatus, PDV_PIX_STATUS_POLLING_MS\)/, 'PDV must keep monitoring while the Pix remains pending');

console.log('PDV Mercado Pago Pix auto-refresh static checks ok');
