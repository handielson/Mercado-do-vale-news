'use strict';

function validateQuoteItems(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) throw new Error('Informe de 1 a 30 itens.');
  const seen = new Set();
  return input.map((item) => {
    const productId = typeof item?.product_id === 'string' ? item.product_id.trim() : '';
    const quantity = item?.quantity;
    if (!productId || productId.length > 100 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
      throw new Error('Produto ou quantidade inválidos.');
    }
    if (seen.has(productId)) throw new Error('Produto repetido na cotação.');
    seen.add(productId);
    return { product_id: productId, quantity };
  });
}

function quoteProduct(product, quantity) {
  const price = Number(product.price_promo) > 0 && Number(product.price_promo) < Number(product.price_retail)
    ? Number(product.price_promo) : Number(product.price_retail);
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error('Preço indisponível.');
  if (!Number.isSafeInteger(price * quantity)) throw new Error('Valor da cotação excede o limite seguro.');
  const stock = Math.max(0, Math.trunc(Number(product.available_stock) || 0));
  const ready = Math.min(stock, quantity);
  const preorder = quantity - ready;
  const preorderEnabled = Number(product.print3d_preorder_enabled) === 1 || product.print3d_preorder_enabled === true;
  const productionDays = Number(product.production_days);
  const preorderLimit = product.print3d_preorder_limit == null ? null : Number(product.print3d_preorder_limit);
  const canPreorder = preorderEnabled && Number.isSafeInteger(productionDays) && productionDays > 0
    && (preorderLimit === null || preorder <= preorderLimit);
  const status = preorder > 0 && !canPreorder ? 'unavailable' : 'available';
  const readySubtotal = price * ready;
  const preorderSubtotal = price * preorder;
  // Mínimo de 50% dos produtos, mesmo quando já disponíveis em estoque.
  // O valor por linha é informativo; o checkout arredonda o mínimo global.
  const depositAmount = Math.ceil(price * quantity / 2);
  return {
    product_id: product.id,
    sku: product.sku,
    name: product.title || product.name,
    quantity,
    ready_quantity: ready,
    preorder_quantity: preorder,
    production_days: preorder > 0 && canPreorder ? productionDays : null,
    unit_price: price,
    subtotal: price * quantity,
    ready_subtotal: readySubtotal,
    preorder_subtotal: preorderSubtotal,
    deposit_amount: depositAmount,
    balance_before_shipping: price * quantity - depositAmount,
    status,
  };
}

function quotePaymentSchedule(items) {
  if (!items.every((item) => item.status === 'available')) return null;
  const sumCents = (field) => items.reduce((sum, item) => {
    const next = sum + item[field];
    if (!Number.isSafeInteger(next)) throw new Error('Valor da cotação excede o limite seguro.');
    return next;
  }, 0);
  const subtotal = sumCents('subtotal');
  const readyAmount = sumCents('ready_subtotal');
  const preorderAmount = sumCents('preorder_subtotal');
  // Arredondar uma vez evita cobrar centavos adicionais em várias linhas ímpares.
  const depositAmount = Math.ceil(subtotal / 2);
  return {
    subtotal,
    ready_amount: readyAmount,
    preorder_amount: preorderAmount,
    deposit_amount: depositAmount,
    due_on_confirmation: depositAmount,
    due_before_shipping: subtotal - depositAmount,
    shipping_cost_included: false,
  };
}

module.exports = { validateQuoteItems, quoteProduct, quotePaymentSchedule };
