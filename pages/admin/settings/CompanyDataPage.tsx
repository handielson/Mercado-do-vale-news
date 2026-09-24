/**
 * CompanyDataPage - Refactored
 * 
 * Main page for managing company data
 * Orchestrates all company data sections via sub-components
 * 
 * Route: /admin/settings/company
 * 
 * ANTIGRAVITY PROTOCOL: Refactored from 976 lines to ~200 lines
 */

import React, { useState, useEffect } from 'react';
import { Building2, FileKey2, Save, Loader2, ReceiptText, UserRoundCog, ClipboardCheck } from 'lucide-react';
import { Company, defaultCompany } from '../../../types/company';
import { getCompanyData, saveCompanyData } from '../../../services/companyService';
import { formatCep, searchCep } from '../../../utils/customerFormUtils';
import { isValidCNPJ } from '../../../utils/cnpjHelper';
import { companyFiscalService, type FiscalLookup } from '../../../services/companyFiscalService';
import { getDocuments } from '../../../services/documentService';
import type { CompanyDocument } from '../../../types/document';
import { SharePaymentDataModal } from '../../../components/SharePaymentDataModal';
import { toast } from 'sonner';

// Import section components
import { CompanyIdentitySection } from '../../../components/company/CompanyIdentitySection';
import { CompanyAddressSection } from '../../../components/company/CompanyAddressSection';
import { CompanySocialMediaSection } from '../../../components/company/CompanySocialMediaSection';
import { CompanyFinancialSection } from '../../../components/company/CompanyFinancialSection';
import { CompanyAdditionalInfoSection } from '../../../components/company/CompanyAdditionalInfoSection';
import { CompanyDocumentsSection } from '../../../components/company/CompanyDocumentsSection';
import { BusinessHoursPanel } from '../../../components/settings/BusinessHoursPanel';
import { BusinessHoursTextPanel } from '../../../components/settings/BusinessHoursTextPanel';
import { CompanyFiscalPanel } from '../../../components/company/CompanyFiscalPanel';
import { CompanyCertificatePanel } from '../../../components/company/CompanyCertificatePanel';
import { CompanyTaxValidationPanel } from '../../../components/company/CompanyTaxValidationPanel';
import { CompanyAccountantAccessPanel } from '../../../components/company/CompanyAccountantAccessPanel';
import { RevenuePanel } from '../../accountant/AccountantPortalPage';

export const CompanyDataPage: React.FC = () => {
    const [activeArea, setActiveArea] = useState<'general' | 'fiscal' | 'accountant'>(() => window.location.hash === '#contador' ? 'accountant' : window.location.hash === '#fiscal' ? 'fiscal' : 'general');
    const [accountantArea, setAccountantArea] = useState<'revenue' | 'validation' | 'access'>('revenue');
    const [form, setForm] = useState<Company>(defaultCompany);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingCep, setIsLoadingCep] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [documents, setDocuments] = useState<CompanyDocument[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);
    const [cnpjLookup, setCnpjLookup] = useState<FiscalLookup | null>(null);

    // Load company data on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await getCompanyData();
                setForm(data);
            } catch (err) {
                console.error('Erro ao carregar dados:', err);
                toast.error('Erro ao carregar dados da empresa');
            } finally {
                setIsLoading(false);
            }
        };

        const loadDocumentsData = async () => {
            setIsLoadingDocs(true);
            try {
                const docs = await getDocuments();
                setDocuments(docs);
            } catch (err) {
                console.error('Erro ao carregar documentos:', err);
            } finally {
                setIsLoadingDocs(false);
            }
        };

        loadData();
        loadDocumentsData();
    }, []);

    useEffect(() => {
        const syncHash = () => setActiveArea(window.location.hash === '#contador' ? 'accountant' : window.location.hash === '#fiscal' ? 'fiscal' : 'general');
        window.addEventListener('hashchange', syncHash);
        return () => window.removeEventListener('hashchange', syncHash);
    }, []);

    const selectArea = (area: 'general' | 'fiscal' | 'accountant') => {
        setActiveArea(area);
        const baseUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', area === 'general' ? baseUrl : `${baseUrl}#${area === 'accountant' ? 'contador' : 'fiscal'}`);
    };

    const handleCNPJSearch = async () => {
        const cnpj = form.cnpj.replace(/\D/g, '');

        if (cnpj.length !== 14) {
            toast.error('CNPJ deve ter 14 dígitos');
            return;
        }

        if (!isValidCNPJ(form.cnpj)) {
            toast.error('CNPJ inválido. Verifique os dígitos.');
            return;
        }

        setIsLoadingCNPJ(true);
        try {
            const data = await companyFiscalService.lookupCnpj(cnpj);
            if (data) {
                setCnpjLookup(data);
                const primaryCnae = data.cnaeActivities.find(activity => activity.primary);
                const cnaeFormatted = primaryCnae
                    ? `${primaryCnae.code} - ${primaryCnae.description}`
                    : '';

                // Both company areas consume the same server-side provider and normalized response.
                // Tax regime and CRT remain deliberate fiscal choices and are never inferred here.
                const registry = data.registry;
                setForm({
                    ...form,
                    name: registry.tradeName || registry.legalName || form.name,
                    razaoSocial: registry.legalName || form.razaoSocial,
                    cnae: cnaeFormatted || form.cnae,
                    situacaoCadastral: registry.status || form.situacaoCadastral,
                    dataAbertura: registry.openingDate || form.dataAbertura,
                    porte: registry.size || form.porte,
                    email: registry.email || form.email,
                    phone: registry.phone || form.phone,
                    address: {
                        ...form.address,
                        zipCode: registry.address.zipCode ? formatCep(registry.address.zipCode) : form.address.zipCode,
                        street: registry.address.street || form.address.street,
                        number: registry.address.number || form.address.number,
                        complement: registry.address.complement || form.address.complement,
                        neighborhood: registry.address.neighborhood || form.address.neighborhood,
                        city: registry.address.city || form.address.city,
                        state: registry.address.uf || form.address.state
                    }
                });
                toast.success(`Dados cadastrais carregados via ${data.source}. Confira antes de salvar.`);
            }
        } catch (error) {
            setCnpjLookup(null);
            console.error('Erro ao buscar CNPJ:', error);
            toast.error('Erro ao buscar dados do CNPJ');
        } finally {
            setIsLoadingCNPJ(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveCompanyData(form);
            toast.success('Dados salvos com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar:', err);
            toast.error('Erro ao salvar dados');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCepSearch = async () => {
        const cep = form.address.zipCode.replace(/\D/g, '');
        if (cep.length !== 8) {
            toast.error('CEP deve ter 8 dígitos');
            return;
        }

        setIsLoadingCep(true);
        try {
            const data = await searchCep(cep);
            if (data) {
                setForm({
                    ...form,
                    address: {
                        ...form.address,
                        street: data.street || form.address.street,
                        neighborhood: data.neighborhood || form.address.neighborhood,
                        city: data.city || form.address.city,
                        state: data.state || form.address.state,
                    }
                });
                toast.success('Endereço encontrado!');
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            toast.error('Erro ao buscar CEP');
        } finally {
            setIsLoadingCep(false);
        }
    };

    const formatPhone = (value: string): string => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 10) {
            return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        }
        return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    };

    const formatCNPJ = (value: string): string => {
        const numbers = value.replace(/\D/g, '');
        return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
    };

    const handleFormChange = (updates: Partial<Company>) => {
        if (updates.cnpj !== undefined && updates.cnpj !== form.cnpj) setCnpjLookup(null);
        setForm({ ...form, ...updates });
    };

    const handleDocumentsChange = async () => {
        const docs = await getDocuments();
        setDocuments(docs);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-10 px-4 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Dados da Empresa</h1>
                    <p className="text-slate-500 text-sm">
                        Dados operacionais e fiscais separados, com uma única fonte para cada informação.
                    </p>
                </div>
                {activeArea === 'general' && <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Salvando...
                        </>
                    ) : (
                        <>
                            <Save size={20} />
                            Salvar Alterações
                        </>
                    )}
                </button>}
            </div>

            <div className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-3" role="tablist" aria-label="Áreas dos dados da empresa">
                <button type="button" role="tab" aria-selected={activeArea === 'general'} aria-controls="company-general-panel" onClick={() => selectArea('general')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${activeArea === 'general' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>
                    <Building2 size={18} /> Dados gerais e operacionais
                </button>
                <button type="button" role="tab" aria-selected={activeArea === 'fiscal'} aria-controls="company-fiscal-panel" onClick={() => selectArea('fiscal')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${activeArea === 'fiscal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>
                    <FileKey2 size={18} /> Fiscal e certificado
                </button>
                <button type="button" role="tab" aria-selected={activeArea === 'accountant'} aria-controls="company-accountant-panel" onClick={() => selectArea('accountant')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${activeArea === 'accountant' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>
                    <ReceiptText size={18} /> Espaço do Contador
                </button>
            </div>

            {activeArea === 'fiscal' && <div id="company-fiscal-panel" role="tabpanel" className="space-y-6" aria-label="Fiscal e certificado">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                    <strong>Cadastro fiscal separado.</strong> Para a empresa principal, CNPJ, nomes, IE, CNAE, porte, contato e endereço são somente leitura aqui e continuam vindo dos dados gerais usados pelo restante do sistema. Esta área salva regime, CRT, vigência, inscrições complementares, CNAEs consultados e certificado.
                </div>
                <CompanyFiscalPanel />
                <CompanyCertificatePanel />
            </div>}

            {activeArea === 'accountant' && <div id="company-accountant-panel" role="tabpanel" className="space-y-6" aria-label="Espaço do Contador">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">Consulte aqui o faturamento e as notas já importadas. A validação contábil e a gestão de acesso ficam em seções separadas; importar notas exige uma prévia e confirmação.</div>
                <nav className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2" aria-label="Seções do Espaço do Contador">
                    <button type="button" onClick={() => setAccountantArea('revenue')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${accountantArea === 'revenue' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}><ReceiptText size={17} /> Faturamento e notas</button>
                    <button type="button" onClick={() => setAccountantArea('validation')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${accountantArea === 'validation' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}><ClipboardCheck size={17} /> Validação contábil</button>
                    <button type="button" onClick={() => setAccountantArea('access')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${accountantArea === 'access' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}><UserRoundCog size={17} /> Acessos e importação</button>
                </nav>
                {accountantArea === 'revenue' && <RevenuePanel />}
                {accountantArea === 'validation' && <CompanyTaxValidationPanel />}
                {accountantArea === 'access' && <CompanyAccountantAccessPanel />}
            </div>}

            {activeArea === 'general' && <div id="company-general-panel" role="tabpanel" className="space-y-6" aria-label="Dados gerais e operacionais">

            {/* Section 1: Identity */}
            <CompanyIdentitySection
                form={form}
                onChange={handleFormChange}
                onCNPJSearch={handleCNPJSearch}
                isLoadingCNPJ={isLoadingCNPJ}
                cnpjLookup={cnpjLookup}
                formatPhone={formatPhone}
                formatCNPJ={formatCNPJ}
            />

            {/* Section 2: Address */}
            <CompanyAddressSection
                form={form}
                onChange={handleFormChange}
                onCepSearch={handleCepSearch}
                isLoadingCep={isLoadingCep}
                formatCep={formatCep}
            />

            {/* Section 3: Social Media */}
            <CompanySocialMediaSection
                form={form}
                onChange={handleFormChange}
            />

            {/* Section 4: Financial */}
            <CompanyFinancialSection
                form={form}
                onChange={handleFormChange}
                onSharePaymentData={() => setIsShareModalOpen(true)}
            />

            {/* Section 5: Additional Info */}
            <CompanyAdditionalInfoSection
                form={form}
                onChange={handleFormChange}
            />

            {/* Section 6: Business Hours */}
            <BusinessHoursPanel />

            {/* Section 6b: Business Hours Display Text */}
            <BusinessHoursTextPanel />

            {/* Section 7: Documents */}
            <CompanyDocumentsSection
                documents={documents}
                isLoading={isLoadingDocs}
                onDocumentsChange={handleDocumentsChange}
            />
            </div>}

            {/* Share Payment Data Modal */}
            <SharePaymentDataModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                companyData={form as any}
            />
        </div>
    );
};
