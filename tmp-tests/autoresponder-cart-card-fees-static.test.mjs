import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'async function formatAutoresponderCartSummaryReply',
    'await calculateAutoresponderMaxInstallment(totals.total_cents)',
    'formatAutoresponderCartPaymentLine',
    'Parcelamento no cartao:',
    'payment_plan',
    'await calculateAutoresponderMaxInstallment(cartTotals.total_cents)',
    'await formatAutoresponderCartSummaryReply(items)',
  ].forEach((needle) => {
    assert(source.includes(needle), `${fileName} must include ${needle}`);
  });

  assert(
    source.indexOf('const cartTotals = calculateAutoresponderCartTotalsWithShipping') <
      source.indexOf('await calculateAutoresponderMaxInstallment(cartTotals.total_cents)'),
    `${fileName} must calculate card fees from cart total including shipping when available`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(
  doc.includes('- [x] Carrinho calcula parcelamento/juros da maquina de cartao pela tabela `payment_fees`'),
  'Bot_Whatsapp.md must mark cart card fee calculation done'
);
assert(
  doc.includes('tmp-tests/autoresponder-cart-card-fees-static.test.mjs'),
  'Bot_Whatsapp.md must mention cart card fee test'
);

console.log('autoresponder cart card fees static checks passed');
