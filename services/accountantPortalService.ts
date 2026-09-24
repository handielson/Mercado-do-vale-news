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
  authorizedModels?: string[];
  document?: { model: string; number?: string; accessKey?: string; status: string; issuedAt?: string; totalCents: number; source: string };
  documentTotalCents?: number;
  amountDifferenceCents?: number;
  reviewReasons?: Array<'amount_difference' | 'operational_pending_with_document' | 'cancelled_with_document' | 'sale_outside_period'>;
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
    id: string;
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

export interface FiscalDocumentReview {
  reviewState: 'draft' | 'reviewed';
  valueTreatment: string;
  fiscalAction: 'pending' | 'no_action' | 'assess_cancellation' | 'assess_return' | 'other';
  justification: string;
  evidenceNotes: string;
  reviewerName: string;
  reviewerRegistration: string;
  reviewedAt: string;
  version: number;
}
export interface FiscalDocumentReviewResponse {
  document: { id: string; model: string; number: string | null; channel: string; orderReference: string; status: string; totalCents: number };
  review: FiscalDocumentReview;
}

export interface FiscalCancellationAssessment {
  documentId: string;
  channel: string;
  orderReference: string;
  marketplace: { cancelled: boolean; open: boolean; shipped: boolean; status: string; buyerInitiated?: boolean; reason: string };
  sefaz: { cStat: string; reason: string; situation: string; authorizationProtocol: string; authorizedAt: string; checkedAt: string };
  assessment: { eligible: boolean; blockers: string[]; alert: string | null; internalDeadline: string | null };
  action: 'read_only';
}

export interface FiscalCancellationAlert {
  documentId: string;
  state: 'open_alert' | 'uncertain' | 'rejected' | 'blocked' | 'accepted_pending_confirmation';
  channel: string;
  orderReference: string;
  documentNumber: string | null;
  marketplaceStatus: string;
  reason: string | null;
  checkedAt: string | null;
}

const BASE = '/accountant/companies';
export interface AccountantFiscalFile { filename: string; mimeType: string; base64: string }

export interface AccountantSaleDetails {
  channel: string; saleId: string; customerName: string; occurredAt: string | null; capturedAt: string | null;
  status: string; paymentStatus: string;
  totalCents: number | null; subtotalCents: number | null; discountCents: number | null; shippingCents: number | null;
  items: Array<{ name: string; sku: string; quantity: number; unitPriceCents: number | null; totalCents: number | null }>;
  payments: Array<{ method: string; amountCents: number | null; installments: number | null }>;
  documents: Array<{ id: string; model: string; status: string; number: string | null; series: string | null; accessKey: string | null; issuedAt: string | null }>;
  receipt: { status: string; number: string; series: string; authorizedAt: string | null; accessKey: string | null; available: boolean } | null;
}

export const accountantPortalService = {
  saleDetails: (id: string, channel: string, saleId: string) => vpsClient.get<AccountantSaleDetails>(`${BASE}/${encodeURIComponent(id)}/sales/${encodeURIComponent(channel)}/${encodeURIComponent(saleId)}`),
  saleReceipt: (id: string, saleId: string, format: 'pdf' | 'xml') => vpsClient.get<AccountantFiscalFile>(`${BASE}/${encodeURIComponent(id)}/sales/pdv/${encodeURIComponent(saleId)}/receipt?format=${format}`),
  documentFile: (id: string, documentId: string, format: 'pdf' | 'xml') => vpsClient.get<AccountantFiscalFile>(`${BASE}/${encodeURIComponent(id)}/fiscal-documents/${encodeURIComponent(documentId)}/file?format=${format}`),
  archiveXml: (id: string, documentId: string, xml: string) => vpsClient.post(`${BASE}/${encodeURIComponent(id)}/fiscal-documents/${encodeURIComponent(documentId)}/archive-xml`, { xml }),
  list: () => vpsClient.get<{ enabled: boolean; companies: AccountantCompany[] }>(BASE),
  taxValidation: (id: string) => vpsClient.get<FiscalTaxValidation>(`${BASE}/${encodeURIComponent(id)}/tax-validation`),
  saveTaxValidation: (id: string, data: FiscalTaxValidation) => vpsClient.put<FiscalTaxValidation>(`${BASE}/${encodeURIComponent(id)}/tax-validation`, data),
  revenue: (id: string, from: string, to: string) => vpsClient.get<AccountantRevenueReport>(`${BASE}/${encodeURIComponent(id)}/revenue?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  sefazStatus: (id: string, documentId: string) => vpsClient.post<{ environment: string; cStat: string; reason: string; situation: string; checkedAt: string }>(`${BASE}/${encodeURIComponent(id)}/fiscal-documents/${encodeURIComponent(documentId)}/sefaz-status`, {}),
  documentReview: (id: string, documentId: string) => vpsClient.get<FiscalDocumentReviewResponse>(`${BASE}/${encodeURIComponent(id)}/fiscal-documents/${encodeURIComponent(documentId)}/review`),
  saveDocumentReview: (id: string, documentId: string, review: FiscalDocumentReview) => vpsClient.post<FiscalDocumentReviewResponse>(`${BASE}/${encodeURIComponent(id)}/fiscal-documents/${encodeURIComponent(documentId)}/review`, review),
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
  cancellationAssessment: (companyId: string, documentId: string) => vpsClient.get<FiscalCancellationAssessment>(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/fiscal-documents/${encodeURIComponent(documentId)}/cancellation-assessment`),
  cancellationAlerts: (companyId: string) => vpsClient.get<{ enabled: boolean; alerts: FiscalCancellationAlert[] }>(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/fiscal-cancellation-alerts`),
  list: (companyId: string) => vpsClient.get<{ company: AccountantCompany; access: AccountantAccess[] }>(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/accountant-access`),
  grant: (companyId: string, email: string) => vpsClient.post(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/accountant-access`, { email, canEditTaxValidation: true, canViewRevenue: true }),
  revoke: (companyId: string, customerId: string) => vpsClient.delete(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/accountant-access/${encodeURIComponent(customerId)}`),
  previewBlingDocuments: (companyId: string, from: string, to: string) => vpsClient.post<BlingFiscalPreview>(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/documents/preview-bling`, { from, to }),
  importBlingDocuments: (companyId: string, from: string, to: string, fingerprint: string) => vpsClient.post<{ imported: number; authorized: number; cancelled: number; from: string; to: string; source: string }>(`/admin/fiscal-companies/${encodeURIComponent(companyId)}/documents/import-bling`, { from, to, fingerprint }),
};
