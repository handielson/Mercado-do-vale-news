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
export interface FiscalCscStatus { configured: boolean; environment: 'homologation' | 'production'; identifier: string; updatedAt: string }
export interface FiscalCertificateStatus {
    validUntil: string; alertDays: number; certificateType: 'A1_SERVER' | 'A1_CLIENT' | 'A3' | 'WINDOWS'; verifiedLocally: boolean;
    installed: boolean; installedAt: string; subjectName: string; issuerName: string; serialNumber: string; fingerprintSha256: string;
    sefaz: SefazStatus | null; daysRemaining: number | null; alert: boolean;
}
export interface AuthorizedNfceDanfe {
    issuanceId: string; saleId: string; environment: 'homologation'; accessKey: string;
    authorizationProtocol: string; authorizedXmlSha256: string; authorizedXml: string;
}
export interface NfceHomologationStatus {
    environment: 'homologation'; prepareEnabled: boolean; transmitEnabled: boolean;
    certificateInstalled: boolean; certificateValidUntil: string | null;
    csc: FiscalCscStatus; validationStatus: FiscalTaxValidation['status'];
    sequences: Array<{ series: number; nextNumber: number; checkedAt: string }>;
}
export interface NfceSalePreflight {
    saleId: string; saleTotalCents: number | null; itemCount: number; saleDataReady: boolean;
    issues: Array<{ code: string; itemId?: string }>;
    attempts: Array<{ id: string; status: string; environment: string; series: number; document_number: number }>;
}
export interface NfceAttempt {
    id: string; sale_id: string; environment: 'homologation'; status: string; series: number; document_number: number;
    access_key: string | null; authorization_protocol: string | null; last_error: string | null;
}
export interface FiscalTaxRule {
    review?: { reviewerName: string; reviewerRegistration: string; reviewedAt: string; actor: string; outdated: boolean } | null;
    id: string; scenario: string; used: boolean; model: string; destinationUf: string; recipient: string; finality: string;
    cfop: string; icmsCode: string; icmsTreatment: string; pisCofins: string; ipi: string; benefit: string; effectiveFrom: string; notes: string;
    source: 'bling_reference' | 'scope' | 'accountant';
    nfce?: { unit: string; csosn: string; pisCst: string; cofinsCst: string; icmsRate: string; pisRate: string; cofinsRate: string; cestApplicability: '' | 'required' | 'not_applicable'; gtinDecision: '' | 'from_product' | 'sem_gtin' };
}
export interface FiscalTaxValidation {
    reviewRuleId?: string;
    status: 'draft' | 'reviewed' | 'approved'; reviewerName: string; reviewerRegistration: string; reviewedAt: string; notes: string;
    rules: FiscalTaxRule[]; blingReference: { observedAt: string; source: string; natures: Array<{ name: string; defaultUse: string }>; sale: Record<string, unknown> };
    generalDecisions: { taxRegime: string; crt: string; effectiveFrom: string; simplesBasis: string; freightTreatment: string; productExceptions: 'none' | 'listed' | 'pending'; productExceptionsNotes: string };
    productRules: Array<{ id: string; group: string; ncm: string; cest: string; origin: string; unit: string; taxTreatment: string; operations: string; effectiveFrom: string; notes: string }>;
    reviewIssues: string[]; approvalIssues: string[];
    version: number; updatedAt: string;
}
const documentOperationIds = new Set(['OP01','OP02','OP03','OP04','OP05','OP06','OP07','OP08']);
export function fiscalTaxValidationIssues(data: FiscalTaxValidation) {
    const review: string[] = [];
    if (!data.reviewerName.trim()) review.push('responsável/contador');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.reviewedAt)) review.push('data da revisão');
    const approval = [...review];
    const general = data.generalDecisions;
    for (const [value,label] of [[general.taxRegime,'regime tributário'],[general.crt,'CRT'],[general.effectiveFrom,'vigência geral'],[general.simplesBasis,'regime de apuração do Simples'],[general.freightTreatment,'frete, desconto e despesas'],[general.productExceptionsNotes,'decisão sobre exceções por produto']]) if (!value.trim()) approval.push(label);
    if (general.productExceptions === 'pending') approval.push('situação das exceções por produto');
    if (general.productExceptions === 'listed' && data.productRules.length === 0) approval.push('ao menos uma regra por produto');
    if (general.productExceptions === 'listed') data.productRules.forEach((rule,index) => {
        for (const [value,label] of [[rule.group,'grupo/produto'],[rule.ncm,'NCM'],[rule.origin,'origem'],[rule.unit,'unidade'],[rule.taxTreatment,'tributação'],[rule.operations,'operações'],[rule.effectiveFrom,'vigência']]) if (!value.trim()) approval.push(`PR${index + 1}: ${label}`);
    });
    data.rules.filter(rule=>rule.used).forEach(rule => {
        if (documentOperationIds.has(rule.id)) for (const [value,label] of [[rule.model,'modelo'],[rule.cfop,'CFOP'],[rule.icmsCode,'CSOSN/CST ICMS'],[rule.icmsTreatment,'tratamento ICMS'],[rule.pisCofins,'PIS/COFINS'],[rule.ipi,'IPI'],[rule.effectiveFrom,'vigência']]) if (!value.trim()) approval.push(`${rule.id}: ${label}`);
        else { if (!rule.notes.trim()) approval.push(`${rule.id}: procedimento/observação`); if (!rule.effectiveFrom.trim()) approval.push(`${rule.id}: vigência`); }
    });
    return { review, approval };
}
const BASE = '/admin/fiscal-companies';
export const companyFiscalService = {
    list: () => vpsClient.get<{ enabled: boolean; companies: FiscalCompany[] }>(BASE),
    lookupCnpj: (cnpj: string) => vpsClient.get<FiscalLookup>(`/admin/cnpj-lookup/${encodeURIComponent(cnpj)}`),
    save: (company: FiscalCompany) => company.id === 'new'
        ? vpsClient.post<FiscalCompany>(BASE, company)
        : vpsClient.put<FiscalCompany>(`${BASE}/${encodeURIComponent(company.id)}`, company),
    refresh: (company: FiscalCompany) => vpsClient.post<FiscalCompany>(`${BASE}/${encodeURIComponent(company.id)}/refresh`, { version: company.version }),
    readiness: (company: FiscalCompany) => vpsClient.get<{ ready: boolean; missing: string[]; municipality: { status: 'confirmed' | 'mismatch' | 'not_found' | 'unavailable' | 'not_checked'; officialName?: string; officialUf?: string } }>(`${BASE}/${encodeURIComponent(company.id)}/readiness`),
    taxValidation: (id: string) => vpsClient.get<FiscalTaxValidation>(`${BASE}/${encodeURIComponent(id)}/tax-validation`),
    authorizedNfceDanfe: (companyId: string, saleId: string) => vpsClient.get<AuthorizedNfceDanfe>(`${BASE}/${encodeURIComponent(companyId)}/nfce/sales/${encodeURIComponent(saleId)}/authorized-danfe`),
    nfceHomologationStatus: (id: string) => vpsClient.get<NfceHomologationStatus>(`${BASE}/${encodeURIComponent(id)}/nfce/homologation`),
    configureNfceHomologationSequence: (id: string, series: number, lastNumber: number) => vpsClient.post(`${BASE}/${encodeURIComponent(id)}/nfce/homologation/sequence`, { series, lastNumber, confirmation:'CONFERI A SERIE DE HOMOLOGACAO' }),
    nfceSalePreflight: (id: string, saleId: string) => vpsClient.get<NfceSalePreflight>(`${BASE}/${encodeURIComponent(id)}/nfce/sales/${encodeURIComponent(saleId)}/preflight`),
    prepareNfceHomologation: (id: string, saleId: string, series: number) => vpsClient.post<{ issuanceId:string; status:string }>(`${BASE}/${encodeURIComponent(id)}/nfce/sales/${encodeURIComponent(saleId)}/prepare-homologation`, { series }),
    nfceAttempt: (id: string, issuanceId: string) => vpsClient.get<NfceAttempt>(`${BASE}/${encodeURIComponent(id)}/nfce/issuances/${encodeURIComponent(issuanceId)}`),
    transmitNfceHomologation: (id: string, issuanceId: string) => vpsClient.post<{ state:string; reason?:string }>(`${BASE}/${encodeURIComponent(id)}/nfce/issuances/${encodeURIComponent(issuanceId)}/transmit`, {}),
    reconcileNfceHomologation: (id: string, issuanceId: string) => vpsClient.post<{ state:string; reason?:string }>(`${BASE}/${encodeURIComponent(id)}/nfce/issuances/${encodeURIComponent(issuanceId)}/reconcile`, {}),
    saveTaxValidation: (id: string, data: FiscalTaxValidation) => vpsClient.put<FiscalTaxValidation>(`${BASE}/${encodeURIComponent(id)}/tax-validation`, data),
    certificate: (id: string) => vpsClient.get<FiscalCertificateStatus>(`${BASE}/${encodeURIComponent(id)}/certificate`),
    cscStatus: (id: string, environment: FiscalCscStatus['environment']) => vpsClient.get<FiscalCscStatus>(`${BASE}/${encodeURIComponent(id)}/nfce-csc/${environment}`),
    saveCsc: (id: string, environment: FiscalCscStatus['environment'], identifier: string, code: string) => vpsClient.put<FiscalCscStatus>(`${BASE}/${encodeURIComponent(id)}/nfce-csc/${environment}`, { identifier, code }),
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
