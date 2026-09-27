'use strict';
function fail(message) { throw Object.assign(new Error(message),{statusCode:400}); }
function cents(value,label) { if (!Number.isSafeInteger(value) || value < 0) fail(label + ' inválido.'); return value; }
function portion(value,bps) { return Number((BigInt(value)*BigInt(bps)+9999n)/10000n); }
function buildPaymentTerms(subtotalCents,shippingCents,options = {}) {
  cents(subtotalCents,'Subtotal'); cents(shippingCents,'Frete');
  if (!subtotalCents) fail('Subtotal deve ser positivo.');
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('Condição de pagamento inválida.');
  const bps = options.initial_payment_bps ?? 5000,mode = options.shipping_payment_mode ?? 'later';
  if (!Number.isSafeInteger(bps) || bps < 5000 || bps > 10000) fail('Entrada deve ficar entre 50% e 100%.');
  if (!['later','full_now','split'].includes(mode)) fail('Escolha como pagar o frete.');
  const total = cents(subtotalCents+shippingCents,'Total');
  const productInitial = portion(subtotalCents,bps);
  const shippingInitial = mode === 'later' ? 0 : mode === 'full_now' ? shippingCents : portion(total,bps)-productInitial;
  const minimum = mode === 'later' ? portion(subtotalCents,5000)
    : mode === 'full_now' ? portion(subtotalCents,5000)+shippingCents : portion(total,5000);
  return { initial_payment_bps:bps,shipping_payment_mode:mode,products_initial_cents:productInitial,
    shipping_initial_cents:shippingInitial,initial_cents:productInitial+shippingInitial,
    balance_cents:total-productInitial-shippingInitial,minimum_initial_cents:minimum,total_cents:total };
}
module.exports = {buildPaymentTerms};
