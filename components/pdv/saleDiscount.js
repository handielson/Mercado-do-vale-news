// Contas do desconto da venda no PDV (centavos).

/** Desconto nunca negativo nem maior que o total. */
export function clampDiscount(cents, base) {
  const value = Math.round(Number(cents) || 0);
  const limit = Math.max(0, Math.round(Number(base) || 0));
  return Math.min(Math.max(0, value), limit);
}

/** Percentual → centavos (arredondado), limitado a 0–100%. */
export function discountFromPercent(base, percent) {
  const pct = Math.min(100, Math.max(0, Number(percent) || 0));
  return clampDiscount(Math.round((Math.max(0, Number(base) || 0) * pct) / 100), base);
}

/** Centavos → percentual do total, com até 2 casas. */
export function percentOfBase(cents, base) {
  const total = Math.max(0, Number(base) || 0);
  if (!total || !cents) return 0;
  return Math.round((Number(cents) / total) * 10000) / 100;
}

/** Por que o desconto está travado (ou null se pode mudar). */
export function discountLockReason({ payments = [], couponCode = null } = {}) {
  if (couponCode) return `Desconto do cupom ${couponCode}. Para trocar, remova o cupom.`;
  const launched = payments.filter(payment => payment && payment.method !== 'a_prazo');
  if (launched.length) return 'Já há pagamento lançado. Remova o pagamento para mudar o desconto (o valor do Pix/cartão foi calculado com o total antigo).';
  return null;
}
