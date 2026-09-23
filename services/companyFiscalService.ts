import { vpsClient } from './vpsClient';

export const fiscalRegimes = [
    ['nao_definido', 'Não definido'], ['simples_nacional', 'Simples Nacional'], ['mei', 'MEI'],
    ['lucro_presumido', 'Lucro Presumido'], ['lucro_real', 'Lucro Real'],
    ['lucro_arbitrado', 'Lucro Arbitrado'], ['imune', 'Imune'], ['isenta', 'Isenta'], ['outro', 'Outro'],
] as const;
export type FiscalRegime = typeof fiscalRegimes[number][0];
export interface FiscalLookup {
    cnpj: string; authority: 'Receita Federal do Brasil'; source: string; officialDirect: boolean; consultedAt: string; sourceUpdatedAt: string | null;
    simples: boolean | null; mei: boolean | null; suggestedRegime: FiscalRegime | null;
    simplesSince: string | null; simplesUntil: string | null; meiSince: string | null; meiUntil: string | null;
    municipalityCode: string | null;
    cnaeActivities: Array<{ code: string; description: string; primary: boolean }>;
    registry: {
        legalName: string | null; tradeName: string | null; status: string | null; statusDate: string | null;
        openingDate: string | null; size: string | null; legalNature: string | null; email: string | null;
        phone: string | null; secondaryPhone: string | null;
        address: { zipCode: string | null; street: string | null; number: string | null; complement: string | null; neighborhood: string | null; city: string | null; uf: string | null };
    };
}
export interface FiscalCompany {
    id: string; primary: boolean; identitySource: 'company_settings' | 'fiscal_profile'; cnpj: string; name: string; legalName: string; stateRegistration: string; stateRegistrationExempt: boolean; municipalRegistration: string;
    suframaRegistration: string; cnae: string; cnaeActivities: Array<{ code: string; description: string; primary: boolean }>; companySize: string; mainActivity: string;
    segments: Array<'comercio' | 'ecommerce' | 'industria' | 'servicos'>; annualRevenueBand: string; employeesBand: string;
    contactPerson: string; phone: string; mobilePhone: string; email: string; billingEmail: string; website: string;
    substituteStateRegistrations: Array<{ uf: string; registration: string }>;
    uf: string; municipalityCode: string; address: { zipCode: string; street: string; number: string; complement: string; neighborhood: string; city: string };
    regime: FiscalRegime; crt: string; effectiveFrom: string; notes: string;
    version: number; lookup: FiscalLookup | null; identityConflict?: boolean;
}
export interface SefazStatus { environment: 'homologation' | 'production' | ''; cStat: string; reason: string; operational: boolean; checkedAt: string }
export interface FiscalCertificateStatus {
    validUntil: string; alertDays: number; certificateType: 'A1_SERVER' | 'A1_CLIENT' | 'A3' | 'WINDOWS'; verifiedLocally: boolean;
    installed: boolean; installedAt: string; subjectName: string; issuerName: string; serialNumber: string; fingerprintSha256: string;
    sefaz: SefazStatus | null; daysRemaining: number | null; alert: boolean;
}
const BASE = '/admin/fiscal-companies';
export const companyFiscalService = {
    list: () => vpsClient.get<{ enabled: boolean; companies: FiscalCompany[] }>(BASE),
    save: (company: FiscalCompany) => company.id === 'new'
        ? vpsClient.post<FiscalCompany>(BASE, company)
        : vpsClient.put<FiscalCompany>(`${BASE}/${encodeURIComponent(company.id)}`, company),
    refresh: (company: FiscalCompany) => vpsClient.post<FiscalCompany>(`${BASE}/${encodeURIComponent(company.id)}/refresh`, { version: company.version }),
    readiness: (company: FiscalCompany) => vpsClient.get<{ ready: boolean; missing: string[]; municipality: { status: 'confirmed' | 'mismatch' | 'not_found' | 'unavailable' | 'not_checked'; officialName?: string; officialUf?: string } }>(`${BASE}/${encodeURIComponent(company.id)}/readiness`),
    certificate: (id: string) => vpsClient.get<FiscalCertificateStatus>(`${BASE}/${encodeURIComponent(id)}/certificate`),
    saveCertificate: (id: string, data: Pick<FiscalCertificateStatus,'validUntil' | 'alertDays' | 'certificateType'>) => vpsClient.put<FiscalCertificateStatus>(`${BASE}/${encodeURIComponent(id)}/certificate`, data),
    uploadCertificate: (id: string, file: File, password: string, alertDays: number) => {
        const form = new FormData();
        form.append('password', password);
        form.append('alertDays', String(alertDays));
        form.append('certificate', file, file.name);
        return vpsClient.upload<FiscalCertificateStatus>(`${BASE}/${encodeURIComponent(id)}/certificate/upload`, form);
    },
    exportCertificate: (id: string, password: string) => vpsClient.postDownload(`${BASE}/${encodeURIComponent(id)}/certificate/export`, { password }),
    deleteCertificate: (id: string, password: string, confirmation: string) => vpsClient.post<{ deleted: true }>(`${BASE}/${encodeURIComponent(id)}/certificate/delete`, { password, confirmation }),
    testSefaz: (id: string, environment: 'homologation' | 'production') => vpsClient.post<SefazStatus>(`${BASE}/${encodeURIComponent(id)}/certificate/sefaz-status`, { environment }),
    certificateAlerts: () => vpsClient.get<{ alerts: Array<FiscalCertificateStatus & { companyId: string; companyName: string }> }>('/admin/fiscal-certificates/alerts'),
};
