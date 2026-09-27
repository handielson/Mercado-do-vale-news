'use strict';
const crypto = require('node:crypto');
const { validateQuoteItems } = require('./print3dStorefrontQuote.cjs');
const TTL = 600;
const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
function signingKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw fail('Cotação de frete indisponível.', 503);
  return crypto.createHmac('sha256', secret).update('print3d_shipping_quote_v1').digest();
}
function sortedItems(items) {
  return validateQuoteItems(items).sort((a,b) => a.product_id.localeCompare(b.product_id));
}
function quoteItemsFingerprint(items) {
  const fields = ['product_id','quantity','ready_quantity','preorder_quantity','production_days','unit_price','subtotal','ready_subtotal','preorder_subtotal','deposit_amount','balance_before_shipping','status'];
  const sorted = [...items].sort((a,b) => a.product_id.localeCompare(b.product_id));
  return crypto.createHash('sha256').update(JSON.stringify(sorted.map(item => Object.fromEntries(fields.map(field => [field,item[field] ?? null]))))).digest('hex');
}
function signShippingQuote({ items, quote, cep, options, origin_cep, parcel, production_days, handling_business_days }, secret, now = Math.floor(Date.now()/1000)) {
  const key = signingKey(secret);
  const payload = {
    aud:'loja_3d_shipping',iat:now,exp:now+TTL,items:sortedItems(items),cep,
    subtotal_cents:quote.paymentSchedule.subtotal,items_fingerprint:quoteItemsFingerprint(quote.items),
    options,origin_cep,parcel,production_days,handling_business_days,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256',key).update(body).digest('base64url');
}
function verifyShippingQuote({ token, items, cep, shippingOptionId }, secret, now = Math.floor(Date.now()/1000)) {
  const key = signingKey(secret);
  try {
    if (typeof token !== 'string' || token.length > 65536) throw new Error();
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra !== undefined) throw new Error();
    const expected = crypto.createHmac('sha256',key).update(body).digest();
    const received = Buffer.from(signature,'base64url');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received,expected)) throw new Error();
    const data = JSON.parse(Buffer.from(body,'base64url').toString());
    if (data.aud !== 'loja_3d_shipping' || !Number.isSafeInteger(data.iat) || !Number.isSafeInteger(data.exp)
      || data.exp-data.iat !== TTL || data.iat > now || data.exp <= now
      || data.cep !== String(cep || '').replace(/\D/g,'')
      || JSON.stringify(data.items) !== JSON.stringify(sortedItems(items))) throw new Error();
    const option = data.options.find(item => item.id === shippingOptionId);
    if (!option || !Number.isSafeInteger(option.price_cents) || option.price_cents < 0) throw new Error();
    return { subtotal_cents:data.subtotal_cents,items_fingerprint:data.items_fingerprint,option,
      origin_cep:data.origin_cep,parcel:data.parcel,production_days:data.production_days,handling_business_days:data.handling_business_days };
  } catch { throw fail('O frete expirou ou o carrinho mudou. Calcule novamente antes de confirmar.'); }
}
module.exports = { signShippingQuote, verifyShippingQuote, quoteItemsFingerprint };
