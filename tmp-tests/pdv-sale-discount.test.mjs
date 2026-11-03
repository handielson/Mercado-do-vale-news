import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clampDiscount, discountFromPercent, percentOfBase, discountLockReason } from '../components/pdv/saleDiscount.js';

// Desconto da venda no PDV: visível, R$ ou %, vale para Pix/dinheiro/cartão.
test('percentual e limites', () => {
  assert.equal(discountFromPercent(129900, 10), 12990);
  assert.equal(discountFromPercent(1999, 5), 100, 'arredonda o centavo');
  assert.equal(discountFromPercent(10000, 150), 10000, 'no máximo 100%');
  assert.equal(discountFromPercent(10000, -5), 0);
  assert.equal(clampDiscount(50000, 30000), 30000, 'nunca maior que o total');
  assert.equal(clampDiscount(-10, 30000), 0);
  assert.equal(percentOfBase(12990, 129900), 10);
  assert.equal(percentOfBase(0, 129900), 0);
});

test('trava com pagamento lançado ou cupom; crediário não trava', () => {
  assert.equal(discountLockReason({ payments: [] }), null);
  assert.equal(discountLockReason({ payments: [{ method: 'a_prazo', amount: 100 }] }), null);
  assert.match(discountLockReason({ payments: [{ method: 'pix', amount: 100 }] }), /Remova o pagamento/);
  assert.match(discountLockReason({ payments: [], couponCode: 'VALE10' }), /cupom VALE10/);
});

test('ligado na tela de pagamento, sempre visível', () => {
  const section = fs.readFileSync(new URL('../components/pdv/PaymentSection.tsx', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../pages/pdv/PDVPage.tsx', import.meta.url), 'utf8');
  assert.match(section, /<SaleDiscountControl base=/);
  assert.doesNotMatch(section, /<summary[^>]*>\s*Desconto da venda/, 'não fica mais escondido numa linha fechada');
  assert.match(page, /discountBase=\{Math\.max\(0, itemsTotal \+ deliveryCostCustomer\)\}/);
  assert.match(page, /discountLockedReason=\{discountLockReason\(\{ payments, couponCode: appliedCoupon\?\.code \|\| null \}\)\}/);
});
