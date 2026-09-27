export interface Print3dPaymentTermsInput {
  initial_payment_bps?: number;
  shipping_payment_mode?: 'later' | 'full_now' | 'split';
}
export interface Print3dPaymentTerms {
  initial_payment_bps: number;
  shipping_payment_mode: 'later' | 'full_now' | 'split';
  products_initial_cents: number;
  shipping_initial_cents: number;
  initial_cents: number;
  balance_cents: number;
  minimum_initial_cents: number;
  total_cents: number;
}
export function buildPaymentTerms(subtotalCents: number, shippingCents: number, options?: Print3dPaymentTermsInput): Print3dPaymentTerms;
