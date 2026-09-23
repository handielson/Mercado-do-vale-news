import { vpsClient } from './vpsClient';
import type { FiscalTaxValidation } from './companyFiscalService';

export interface AccountantCompany {
  id: string;
  profileId: string;
  name: string;
  cnpj: string;
  regime: string;
  crt: string;
  effectiveFrom: string;
  revenueAvailable: boolean;
}

export interface AccountantRevenueSale {
  channel: string;
  externalSaleId: string;
  status: string;
  occurredAt: string;
  statusCapturedAt: string;
  totalCents: number;
  operationalState: 'completed' | 'cancelled' | 'pending';
  fiscalState: 'invoiced' | 'no_invoice_confirmed' | 'reconciliation_pending' | 'cancelled' | 'operational_pending';
  customerName: string;
  document?: { model: string; number?: string; accessKey?: string; status: string; issuedAt?: string; totalCents: number; source: string };
  documentTotalCents?: number;
  amountDifferenceCents?: number;
  reviewReasons?: Array<'amount_difference' | 'operational_pending_with_document' | 'cancelled_with_document'>;
}

export interface AccountantRevenueReport {
  company: AccountantCompany;
  period: { from: string; to: string };
  coverage: { available: boolean; reason?: string; sources?: string[]; note?: string };
  totals: {
    operationalCents: number;
    invoicedCents: number;
    noInvoiceConfirmedCents: number;
    reconciliationPendingCents: number;
    cancelledCents: number;
    operationalPendingCents: number;
  };
  documentTotals: {
    authorizedDocumentCents: number;
    authorizedDocumentCount: number;
    cancelledDocumentCents: number;
    cancelledDocumentCount: number;
  };
  documents: Array<{
    model: string;
    status: string;
    channel: 'shopee' | 'tiktok' | 'unidentified';
    orderReference: string | null;
    number: string | null;
    series: string | null;
    issuedAt: string;
    totalCents: number;
  }>;
  months: Array<AccountantRevenueReport['totals'] & { competence: string }>;
  sales: AccountantRevenueSale[];
  reviewSales: AccountantRevenueSale[];
}

const BASE = '/accountant/companies';

export const accountantPortalService = {
  list: () => vpsClient.get<{ enabled: boolean; companies: AccountantCompany[] }>(BASE),
  taxValidation: (id: string) => vpsClient.get<FiscalTaxValidation>(`${BASE}/${encodeURIComponent(id)}/tax-validation`),
  saveTaxValidation: (id: string, data: FiscalTaxValidation) => vpsClient.put<FiscalTaxValidation>(`${BASE}/${encodeURIComponent(id)}/tax-validation`, data),
  revenue: (id: string, from: string, to: string) => vpsClient.get<AccountantRevenueReport>(`${BASE}/${encodeURIComponent(id)}/revenue?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};

export async function resolveAccountantLandingPath(requestedPath: string, customerType: string | undefined): Promise<string> {
  if (requestedPath !== '/' || customerType === 'ADMIN') return requestedPath;
  try {
    const result = await accountantPortalService.list();
    return result.companies.length > 0 ? '/contador' : requestedPath;
  } catch {
    return requestedPath;
  }
}

export interface AccountantAccess {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  can_edit_tax_validation: boolean;
  can_view_revenue: boolean;
  is_active: boolean;
}

export interface BlingFiscalPreview {
  from: string;
  to: string;
  count: number;
  fingerprint: string;
  totals: AccountantRevenueReport['documentTotals'];
  byModel: Array<{ model: string } & AccountantRevenueReport['documentTotals']>;
  source: 'bling_preview';
}

export const accountantAccessAdminService = {
  list: (companyId: string) => vpsClient.get<{ company: AccountantCompany; access: AccountantAccess[] }>(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/accountant-access`),
  grant: (companyId: string, email: string) => vpsClient.post(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/accountant-access`, { email, canEditTaxValidation: true, canViewRevenue: true }),
  revoke: (companyId: string, customerId: string) => vpsClient.delete(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/accountant-access/${encodeURIComponent(customerId)}`),
  previewBlingDocuments: (companyId: string, from: string, to: string) => vpsClient.post<BlingFiscalPreview>(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/documents/preview-bling`, { from, to }),
  importBlingDocuments: (companyId: string, from: string, to: string, fingerprint: string) => vpsClient.post<{ imported: number; authorized: number; cancelled: number; from: string; to: string; source: string }>(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/documents/import-bling`, { from, to, fingerprint }),
};
