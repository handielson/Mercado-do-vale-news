import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('utils/cartShareUtils.ts', 'utf8');
const start = source.indexOf('export function generateClientOrderText(');
const end = source.indexOf('\n}', source.indexOf('return lines.join', start)) + 2;
const body = start >= 0 && end > start ? source.slice(start, end) : '';

assert.ok(body, 'generateClientOrderText must exist');
assert.doesNotMatch(
  body,
  /[^\x00-\x7F]/,
  'client WhatsApp order text must use ASCII-only labels and separators so WhatsApp does not render replacement characters',
);
assert.match(body, /'NOVO PEDIDO - Mercado do Vale'/, 'client order title must be plain WhatsApp-safe text');
assert.match(body, /`Data: \$\{formatDate\(\)\}`/, 'client order date label must be plain text');
assert.match(body, /`  Link: \$\{getProductUrl\(product\)\}`/, 'product link label must be plain text');
assert.match(body, /`Pagamento: \$\{paymentLabel\}`/, 'payment label must be plain text');
assert.match(body, /'Retirada na loja'/, 'pickup label must be plain text');
assert.match(body, /`Endereco: \$\{address\.trim\(\)\}`/, 'address label must be plain text');

console.log('cart client order WhatsApp-safe static checks passed');
