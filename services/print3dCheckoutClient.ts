import { print3dAccountClient } from './print3dAccountClient';
import { vpsClient } from './vpsClient';

export type CartItem = { product_id: string; quantity: number };
export type PaymentTerms = { initial_payment_bps: number; shipping_payment_mode: 'later' | 'full_now' | 'split' };
export function percentageToBps(value: string): number | null {
  const match = value.trim().match(/^(\d{1,3})(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const bps = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return bps >= 5000 && bps <= 10000 ? bps : null;
}
// Display estimate only. The server validates and persists the canonical calculation.
// Its parity with print3dPaymentTerms.cjs is covered by the focused client tests.
export function paymentTermsPreview(subtotal: number, shipping: number, terms: PaymentTerms) {
  if (![subtotal, shipping, subtotal + shipping].every(value => Number.isSafeInteger(value) && value >= 0) || subtotal === 0
    || !Number.isInteger(terms.initial_payment_bps) || terms.initial_payment_bps < 5000 || terms.initial_payment_bps > 10000
    || !['later', 'full_now', 'split'].includes(terms.shipping_payment_mode)) throw new Error('Condição de pagamento inválida.');
  const proportional = (cents: number, bps: number) => Number((BigInt(cents) * BigInt(bps) + 9999n) / 10000n);
  const products_initial_cents = proportional(subtotal, terms.initial_payment_bps);
  const total_cents = subtotal + shipping;
  const initial_cents = terms.shipping_payment_mode === 'split' ? proportional(total_cents, terms.initial_payment_bps)
    : products_initial_cents + (terms.shipping_payment_mode === 'full_now' ? shipping : 0);
  return { products_initial_cents, shipping_initial_cents: initial_cents - products_initial_cents,
    initial_cents, balance_cents: total_cents - initial_cents, total_cents,
    minimum_initial_cents: terms.shipping_payment_mode === 'split' ? proportional(total_cents, 5000) : proportional(subtotal, 5000) + (terms.shipping_payment_mode === 'full_now' ? shipping : 0),
    ...terms };
}
export type ShippingAddress = { cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string };
export type ShippingQuote = { quote_token: string; subtotal_cents: number; production_days: number; handling_business_days: number; options: Array<{ id: string; carrier: string; name: string; price_cents: number; transport_business_days: number }> };
export type Print3dOrder = {
  id: string; order_number: string; status: string; payment_status: string; created_at: string; tracking_code?: string | null;
  subtotal_cents: number; shipping_cents: number; total_cents: number; confirmed_cents: number; outstanding_cents: number;
  shipping_address: ShippingAddress; shipping_option: { carrier?: string; name?: string };
  items: Array<{ product_id: string; product_name: string; product_sku: string; variant_snapshot?: Record<string,string>; quantity: number; unit_price_cents: number; subtotal_cents: number; ready_quantity: number; preorder_quantity: number; production_days: number }>;
  payment_schedule: { initial_cents: number; balance_cents: number; due_on_confirmation_cents: number; due_before_shipping_cents: number; shipping_cents: number; initial_payment_bps?: number; shipping_payment_mode?: PaymentTerms['shipping_payment_mode']; minimum_initial_cents?: number };
};
export type PixCharge = { id: string; stage: 'initial' | 'balance'; amount_cents: number; status: string; pix_code: string | null; pix_qr_base64: string | null; expires_at: string | null };
export type PaymentCoverage = { confirmed_cents: number; outstanding_cents: number; initial_payment_covered: boolean; fully_paid: boolean };
const CART_KEY = 'print3d_checkout_cart_v1';
const ATTEMPT_KEY = 'print3d_checkout_attempt_v1';
export function saveCheckoutCart(items: CartItem[]) { sessionStorage.setItem(CART_KEY, JSON.stringify(items)); }
export function readCheckoutCart(): CartItem[] {
  try { const items = JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); return Array.isArray(items) ? items.filter(item => typeof item?.product_id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 1000).slice(0, 30) : []; } catch { return []; }
}
export function checkoutAttempt(payload: unknown): string {
  const identity = JSON.stringify(payload);
  try { const previous = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) || 'null'); if (previous?.identity === identity && typeof previous.key === 'string') return previous.key; } catch { /* Recover an invalid local draft. */ }
  const key = crypto.randomUUID(); sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ identity, key })); return key;
}
export function clearCheckoutCart() { sessionStorage.removeItem(CART_KEY); sessionStorage.removeItem(ATTEMPT_KEY); }
export const print3dCheckoutClient = {
  config: () => print3dAccountClient.requestStore<{ enabled: boolean; payment_mode: string }>('/print3d/checkout'),
  shipping: (cep: string, items: CartItem[]) => vpsClient.post<ShippingQuote>('/storefronts/loja_3d/shipping/quote', { cep, items }),
  create: (body: { idempotency_key: string; items: CartItem[]; shipping_address: ShippingAddress; shipping_option_id: string; quote_token: string; payment_terms: PaymentTerms }) => print3dAccountClient.requestStore<{ order: Print3dOrder; replayed: boolean }>('/print3d/checkout', body),
  orders: () => print3dAccountClient.requestStore<{ orders: Print3dOrder[] }>('/print3d/orders'),
  payments: (id: string) => print3dAccountClient.requestStore<{ charges: PixCharge[]; coverage: PaymentCoverage }>(`/print3d/orders/${encodeURIComponent(id)}/payment`),
  pay: (id: string, stage: 'initial' | 'balance', key: string, email?: string) => print3dAccountClient.requestStore<{ charge: PixCharge; coverage: PaymentCoverage }>(`/print3d/orders/${encodeURIComponent(id)}/payment`, { stage, idempotency_key: key, ...(email ? { payer_email: email } : {}) }),
  refreshPayment: (id: string, chargeId: string) => print3dAccountClient.requestStore<{ charge: PixCharge; coverage: PaymentCoverage }>(`/print3d/orders/${encodeURIComponent(id)}/payment/refresh`, { charge_id: chargeId }),
  cancel: (id: string, reason: string) => print3dAccountClient.requestStore<{ order_id: string; cancelled: boolean; already_cancelled: boolean }>(`/print3d/orders/${encodeURIComponent(id)}/cancel`, { reason }),
};
