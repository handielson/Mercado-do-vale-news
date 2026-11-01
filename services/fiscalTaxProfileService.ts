import { vpsClient } from './vpsClient';

/** Bloco de tributação de um modelo de nota. Valores definidos pela contabilidade (Simples Nacional: CSOSN). */
export interface FiscalTaxBlockNfce { used: boolean; cfop: string; csosn: string; pCredSN: string; pisCst: string; pisRate: string; cofinsCst: string; cofinsRate: string; ibsCbsCst: string; cClassTrib: string; unit: string; }
export interface FiscalTaxBlockNfe extends Omit<FiscalTaxBlockNfce, 'cfop'> { cfopInternal: string; cfopInterstate: string; }
export type FiscalTaxBlockKind = 'nfce' | 'nfe';

export interface FiscalTaxProfile {
  id?: string;
  name: string;
  description: string;
  status: 'draft' | 'approved';
  requiresCest: boolean;
  ncmPrefixes: string[];
  reviewerName: string;
  reviewerRegistration: string;
  reviewedAt: string;
  notes: string;
  nfce: FiscalTaxBlockNfce;
  nfe: FiscalTaxBlockNfe;
  version?: number;
  updatedAt?: string;
  productCount?: number;
  completeness?: { errors: string[]; warnings: string[]; complete: boolean };
}

export interface NcmLookup { valid: boolean; code: string; formatted?: string; description?: string; heading?: string; issue?: string; message?: string; raw?: string; }
export interface CestOption { code: string; formatted: string; segment: string; description: string; matchedPrefix: string; doorToDoor: boolean; }
export interface ModelReadiness { ready: boolean; issues: string[]; cfop: string; csosn: string; }
export interface FiscalProductRow {
  id: string; name: string; sku: string; status: string; isVirtual: boolean;
  ncm: NcmLookup; cest: string; origin: string;
  settings: { taxProfileId: string | null; version: number; overrides: Partial<Record<FiscalTaxBlockKind, Record<string, string>>> } | null;
  profile: { id: string; name: string; status: string } | null;
  suggestedProfile: { id: string; name: string; status: string; matchedPrefix: string } | null;
  readiness: { nfce: ModelReadiness; nfe: ModelReadiness };
}
export interface FiscalProductsPage {
  summary: { total: number; withProfile: number; missingProfile: number; ncmInvalid: number; nfceReady: number; nfeReady: number };
  filter: string; page: number; pageSize: number; total: number; items: FiscalProductRow[];
  profiles: Array<{ id: string; name: string; status: string }>;
}
export interface ResolvedTax { ready: boolean; issues: string[]; fields: Record<string, string>; overriddenFields: string[]; profile: { id: string; name: string; status: string } | null; }
export interface FiscalProductDetail extends FiscalProductRow {
  cestOptions: CestOption[];
  resolved: { nfce: ResolvedTax; nfeInternal: ResolvedTax; nfeInterstate: ResolvedTax };
  issueText: Record<string, string>;
}
export type FiscalProductFilter = 'all' | 'missing_profile' | 'not_ready' | 'ncm_invalid' | 'ready';

const company = (id: string) => `/accountant/companies/${encodeURIComponent(id)}`;

export const emptyFiscalTaxProfile = (): FiscalTaxProfile => ({
  name: '', description: '', status: 'draft', requiresCest: false, ncmPrefixes: [], reviewerName: '', reviewerRegistration: '', reviewedAt: '', notes: '',
  nfce: { used: true, cfop: '', csosn: '', pCredSN: '', pisCst: '', pisRate: '', cofinsCst: '', cofinsRate: '', ibsCbsCst: '', cClassTrib: '', unit: 'UN' },
  nfe: { used: true, cfopInternal: '', cfopInterstate: '', csosn: '', pCredSN: '', pisCst: '', pisRate: '', cofinsCst: '', cofinsRate: '', ibsCbsCst: '', cClassTrib: '', unit: 'UN' },
});

export const fiscalTaxProfileService = {
  catalogInfo: () => vpsClient.get<{ ncm: { source: string; vigencia: string; ato: string; count: number }; cest: { source: string; count: number; note: string }; csosn: Record<string, string> }>('/accountant/fiscal-catalog/info'),
  lookupNcm: (code: string) => vpsClient.get<NcmLookup & { cest: CestOption[] }>(`/accountant/fiscal-catalog/ncm/${encodeURIComponent(code.replace(/\D/g, '') || '0')}`),
  searchNcm: (search: string) => vpsClient.get<{ items: NcmLookup[] }>(`/accountant/fiscal-catalog/ncm?search=${encodeURIComponent(search)}`),
  listProfiles: (companyId: string) => vpsClient.get<{ profiles: FiscalTaxProfile[]; csosn: Record<string, string> }>(`${company(companyId)}/tax-profiles`),
  createProfile: (companyId: string, profile: FiscalTaxProfile) => vpsClient.post<{ profile: FiscalTaxProfile; warnings: string[] }>(`${company(companyId)}/tax-profiles`, profile),
  updateProfile: (companyId: string, profile: FiscalTaxProfile) => vpsClient.put<{ profile: FiscalTaxProfile; warnings: string[] }>(`${company(companyId)}/tax-profiles/${encodeURIComponent(profile.id || '')}`, profile),
  deleteProfile: (companyId: string, id: string) => vpsClient.delete<{ deleted: boolean }>(`${company(companyId)}/tax-profiles/${encodeURIComponent(id)}`),
  listProducts: (companyId: string, params: { filter?: FiscalProductFilter; search?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return vpsClient.get<FiscalProductsPage>(`${company(companyId)}/fiscal-products?${query}`);
  },
  productDetail: (companyId: string, productId: string) => vpsClient.get<FiscalProductDetail>(`${company(companyId)}/fiscal-products/${encodeURIComponent(productId)}`),
  saveProduct: (companyId: string, productId: string, body: { taxProfileId: string | null; overrides: Partial<Record<FiscalTaxBlockKind, Record<string, string>>>; version?: number }) =>
    vpsClient.put<{ settings: FiscalProductRow['settings'] }>(`${company(companyId)}/fiscal-products/${encodeURIComponent(productId)}`, body),
  assign: (companyId: string, body: { productIds?: string[]; taxProfileId?: string | null; mode?: 'suggested' }) =>
    vpsClient.post<{ changed: number; mode: string }>(`${company(companyId)}/fiscal-products/assign`, body),
};

export const fiscalIssueText: Record<string, string> = {
  ncm_missing: 'sem NCM', ncm_incomplete: 'NCM incompleto (precisa de 8 dígitos)', ncm_not_found: 'NCM não existe na tabela vigente', ncm_missing_or_invalid: 'NCM inválido',
  origin_missing_or_invalid: 'sem origem da mercadoria', fiscal_profile_missing: 'sem perfil fiscal', fiscal_profile_not_approved: 'perfil não aprovado pela contadora',
  profile_not_used_for_nfce: 'perfil não prevê NFC-e', profile_not_used_for_nfe: 'perfil não prevê NF-e', profile_block_incomplete: 'tributação do perfil incompleta',
  cest_required_missing: 'perfil exige CEST e o produto não tem', cest_not_compatible_with_ncm: 'CEST não combina com o NCM', cest_invalid: 'CEST inválido',
};
