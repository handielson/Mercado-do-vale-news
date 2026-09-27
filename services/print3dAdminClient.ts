import { vpsClient } from './vpsClient';

export type Print3dCustomer = {
  id: string; name: string; email: string | null; phone: string | null; is_active: boolean;
  email_verified_at: string | null; phone_verified_at: string | null; created_at: string;
};
export type Print3dAdminOrder = {
  id: string; order_number: string | null; status: string; payment_status: string; created_at: string;
  subtotal_cents: number; shipping_cents: number; total_cents: number; confirmed_cents: number; outstanding_cents: number;
  tracking_code: string | null;
  payment_review: { pending_cancellations:number; refunded_payments:number; late_payments:number; late_amount_cents:number };
  customer: { id: string; name: string | null; email: string | null; phone: string | null };
  payment_schedule: null | { due_on_confirmation_cents: number; due_before_shipping_cents: number; initial_payment_bps: number; shipping_payment_mode: string };
};
export type Print3dAdminList<T> = { enabled: boolean; dispatch_enabled: boolean; storefront: 'loja_3d'; items: T[]; total: number; page: number; page_size: number };
export function listPrint3dAdmin(kind: 'customers', search: string, page: number): Promise<Print3dAdminList<Print3dCustomer>>;
export function listPrint3dAdmin(kind: 'orders', search: string, page: number): Promise<Print3dAdminList<Print3dAdminOrder>>;
export function listPrint3dAdmin(kind: 'customers' | 'orders', search: string, page: number): Promise<Print3dAdminList<Print3dCustomer | Print3dAdminOrder>>;
export function listPrint3dAdmin(kind: 'customers' | 'orders', search: string, page: number) {
  const query = new URLSearchParams({ search, page: String(page), page_size: '25' });
  return vpsClient.get<Print3dAdminList<Print3dCustomer | Print3dAdminOrder>>(`/admin/print3d/${kind}?${query}`);
}
export function cancelPrint3dAdminOrder(id: string, reason: string) {
  return vpsClient.post<{ order_id: string; cancelled: boolean; already_cancelled: boolean }>(`/admin/print3d/orders/${encodeURIComponent(id)}/cancel`, { reason });
}
export function dispatchPrint3dAdminOrder(id: string, trackingCode: string) {
  return vpsClient.post<{ order_id:string;tracking_code:string;ready_quantity:number;produced_quantity:number;replayed:boolean }>(
    `/admin/print3d/orders/${encodeURIComponent(id)}/dispatch`,{ tracking_code:trackingCode });
}
