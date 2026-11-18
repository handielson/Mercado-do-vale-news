'use strict';

// Devolução de itens da venda (Parte 3): cálculos puros, sem banco.
const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const cents = v => Math.round(Number(v) || 0);
const parse = v => { if (typeof v !== 'string') return v ?? null; try { return JSON.parse(v); } catch { return null; } };
const paymentsOf = sale => { const list = parse(sale?.payment_methods); return Array.isArray(list) ? list : []; };

// Taxa repassada ao cliente (cartão parcelado): o que ele pagou acima do valor do produto.
const feeOf = p => Math.max(0, cents(p.total_with_fee ?? p.amount) - cents(p.amount));

function itemPaidValues(sale, items) {
  const list = items || [];
  const totals = list.map(i => Math.max(0, cents(i.total ?? i.subtotal)));
  const sumTotals = totals.reduce((a, b) => a + b, 0);
  const fees = paymentsOf(sale).reduce((a, p) => a + feeOf(p), 0);
  const netGoods = Math.max(0, cents(sale?.total) - fees - cents(sale?.delivery_cost_customer));
  const values = new Map();
  if (!sumTotals) { list.forEach(i => values.set(String(i.id), 0)); return values; }
  // Maior resto: a soma dos itens fecha exatamente no valor pago pelos produtos.
  const exact = totals.map(t => (t * netGoods) / sumTotals);
  const floors = exact.map(Math.floor);
  let rest = netGoods - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) { if (rest <= 0) break; floors[i] += 1; rest -= 1; }
  list.forEach((item, i) => values.set(String(item.id), floors[i]));
  return values;
}

function returnableItems(sale, items, returnedRows) {
  const paid = itemPaidValues(sale, items);
  const returned = new Map();
  for (const r of returnedRows || []) returned.set(String(r.sale_item_id), (returned.get(String(r.sale_item_id)) || 0) + Number(r.quantity || 0));
  return (items || []).map(item => {
    const quantity = Math.max(0, Math.trunc(Number(item.quantity) || 0));
    const returnedQuantity = Math.min(quantity, returned.get(String(item.id)) || 0);
    return {
      saleItemId: String(item.id), productId: item.product_id || null, name: item.product_name || '', sku: item.product_sku || null,
      quantity, returnedQuantity, returnableQuantity: quantity - returnedQuantity,
      unitValueCents: quantity ? Math.round(paid.get(String(item.id)) / quantity) : 0,
      paidValueCents: paid.get(String(item.id)) || 0,
      serializedUnitId: item.serialized_unit_id || null, imei: item.imei || null,
    };
  });
}

const METHOD_ORDER = { money: 0, cash: 0, pix: 1, debit: 2, credit: 3 };

function planSameMethodRefund(payments, amountCents, refundedByIndex = new Map(), refundedFeeByIndex = new Map()) {
  let remaining = cents(amountCents);
  if (remaining <= 0) fail(400, 'Informe um valor de devolução maior que zero.');
  const ordered = (payments || []).map((p, index) => ({ p, index }))
    .sort((a, b) => (METHOD_ORDER[a.p.method] ?? 4) - (METHOD_ORDER[b.p.method] ?? 4) || a.index - b.index);
  const plan = [];
  for (const { p, index } of ordered) {
    if (remaining <= 0) break;
    const available = Math.max(0, cents(p.amount) - cents(refundedByIndex.get(index)));
    const goods = Math.min(remaining, available);
    if (goods <= 0) continue;
    const amount = cents(p.amount), withFee = cents(p.total_with_fee ?? p.amount);
    // Com juros: proporcional, nunca passa do que sobrou pago; a última leva da forma leva o resto exato.
    const feeLeft = Math.max(0, withFee - cents(refundedFeeByIndex.get(index)));
    const refundCents = amount > 0 && withFee > amount
      ? (goods === available ? feeLeft : Math.min(feeLeft, Math.round((goods * withFee) / amount)))
      : goods;
    plan.push({ paymentIndex: index, method: p.method, goodsCents: goods, refundCents, gatewayPaymentId: p.mercado_pago_payment_id ? String(p.mercado_pago_payment_id) : null });
    remaining -= goods;
  }
  if (remaining > 0) fail(409, 'O valor passa do que ainda pode ser devolvido nas formas de pagamento desta venda.');
  return plan;
}

const OTHER_METHODS = new Set(['money', 'pix', 'transfer', 'card', 'other']);
function validateOtherRefunds(list, amountCents) {
  const rows = (Array.isArray(list) ? list : []).map(r => ({ method: String(r?.method || ''), amountCents: cents(r?.amount_cents) }));
  if (!rows.length) fail(400, 'Informe como o valor foi devolvido.');
  for (const r of rows) {
    if (!OTHER_METHODS.has(r.method)) fail(400, 'Forma de devolução inválida.');
    if (!Number.isSafeInteger(r.amountCents) || r.amountCents <= 0) fail(400, 'Cada forma de devolução precisa de um valor maior que zero.');
  }
  if (rows.reduce((a, r) => a + r.amountCents, 0) !== cents(amountCents)) fail(400, 'A soma das formas de devolução precisa ser igual ao total da devolução.');
  return rows.map(r => ({ method: r.method, amount_cents: r.amountCents }));
}

const NEEDS_PROOF = new Set(['pix', 'transfer', 'card', 'credit', 'debit']);
function requiredProofs(refunds) {
  return (refunds || []).filter(r => NEEDS_PROOF.has(String(r.method)) && !(r.method === 'pix' && r.gateway_refund_id)).map(r => String(r.id));
}

function returnStatusOf({ refunds, files }) {
  const list = files || [];
  if (!list.some(f => f.kind === 'signed')) return 'pendente';
  const proved = new Set(list.filter(f => f.kind === 'proof').map(f => String(f.refund_id)));
  return requiredProofs(refunds).every(id => proved.has(id)) ? 'finalizada' : 'pendente';
}

// Valor por extenso (pt-BR) para a declaração de recebimento em dinheiro.
const UNITS = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
function under1000(n) {
  if (n === 100) return 'cem';
  const parts = [];
  if (n >= 100) parts.push(HUNDREDS[Math.floor(n / 100)]);
  const r = n % 100;
  if (r) parts.push(r < 20 ? UNITS[r] : TENS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNITS[r % 10]}` : ''));
  return parts.join(' e ');
}
function integerInWords(n) {
  if (n === 0) return 'zero';
  const groups = [];
  const millions = Math.floor(n / 1e6), thousands = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  if (millions) groups.push(millions === 1 ? 'um milhão' : `${under1000(millions)} milhões`);
  if (thousands) groups.push(thousands === 1 ? 'mil' : `${under1000(thousands)} mil`);
  if (rest) groups.push(under1000(rest));
  if (groups.length > 1 && rest && (rest < 100 || rest % 100 === 0)) {
    const last = groups.pop(); return `${groups.join(' ')} e ${last}`;
  }
  return groups.join(' ');
}
function amountInWords(value) {
  const total = cents(value);
  const reais = Math.floor(total / 100), centavos = total % 100;
  const parts = [];
  if (reais) {
    const words = integerInWords(reais);
    const de = reais % 1e6 === 0 && reais >= 1e6 ? ' de' : '';
    parts.push(`${words}${de} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos) parts.push(`${integerInWords(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return parts.join(' e ') || 'zero reais';
}

module.exports = {
  itemPaidValues, returnableItems, planSameMethodRefund, validateOtherRefunds,
  requiredProofs, returnStatusOf, amountInWords, paymentsOf,
};
