export type StandalonePixStatus = 'idle' | 'creating' | 'pending' | 'approved' | 'rejected' | 'expired' | 'error';

export interface GoogleContactOption {
  resource_name: string | null;
  name: string;
  phone: string;
  phone_digits: string;
  phone_local: string;
  note?: string | null;
}

export interface StandalonePixPayment {
  id: string;
  source?: 'standalone_pix' | 'pdv_sale' | string;
  public_token?: string | null;
  public_path?: string | null;
  public_url?: string | null;
  local_reference?: string | null;
  cashier_key?: string | null;
  display_id?: string | null;
  mercado_pago_payment_id?: string | null;
  amount: number;
  status: StandalonePixStatus;
  status_label?: string | null;
  description?: string | null;
  qr_code?: string | null;
  qr_code_base64?: string | null;
  ticket_url?: string | null;
  expires_at?: string | null;
  cancel_reason?: string | null;
  shared_phone?: string | null;
  shared_at?: string | null;
  share_channel?: string | null;
  approved_at?: string | null;
  cash_closing_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StandalonePixCreateInput {
  amount: number;
  description?: string;
  cashier_key?: string;
  display_id?: string | null;
  payer_email?: string;
}

export interface StandalonePixListFilters {
  status?: string;
  cashier_key?: string;
  display_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
}

export interface StandalonePixShareResponse extends StandalonePixPayment {
  whatsapp_url: string;
}

export function formatStandalonePixStatus(
  payment?: Pick<StandalonePixPayment, 'status' | 'status_label' | 'cancel_reason'> | null
): string {
  if (!payment) return 'Pendente';
  if (payment.status_label) return payment.status_label;
  if (payment.cancel_reason === 'manual_cancelled') return 'Cancelado manualmente';
  if (payment.cancel_reason === 'unpaid_expired' || payment.status === 'expired') return 'Cancelado por falta de pagamento';
  if (payment.status === 'approved') return 'Aprovado';
  if (payment.status === 'rejected') return 'Rejeitado';
  if (payment.status === 'creating' || payment.status === 'pending') return 'Pendente';
  return 'Erro';
}

export function isStandalonePixPayable(
  payment?: Pick<StandalonePixPayment, 'status' | 'cancel_reason'> | null
): boolean {
  if (!payment) return false;
  return !payment.cancel_reason && (payment.status === 'creating' || payment.status === 'pending');
}
