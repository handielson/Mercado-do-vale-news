/**
 * CompanyDataPage - Refactored
 * 
 * Main page for managing company data
 * Orchestrates all company data sections via sub-components
 * 
 * Route: /admin/settings/company-data
 * 
 * ANTIGRAVITY PROTOCOL: Refactored from 976 lines to ~200 lines
 */

import React, { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Company, defaultCompany } from '../../../types/company';
import { getCompanyData, saveCompanyData } from '../../../services/companyService';
import { formatCep, searchCep } from '../../../utils/customerFormUtils';
import { searchCNPJ, isValidCNPJ } from '../../../utils/cnpjHelper';
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

export const CompanyDataPage: React.FC = () => {
    const [form, setForm] = useState<Company>(defaultCompany);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingCep, setIsLoadingCep] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [documents, setDocuments] = useState<CompanyDocument[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);

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
            const data = await searchCNPJ(cnpj);
            if (data) {
                // Format CNAE
                const cnaeFormatted = data.atividade_principal && data.atividade_principal.length > 0
                    ? `${data.atividade_principal[0].code} - ${data.atividade_principal[0].text}`
                    : '';

                // Update form with Receita Federal data
                setForm({
                    ...form,
                    name: data.nome_fantasia || data.razao_social || form.name,
                    razaoSocial: data.razao_social || form.razaoSocial,
                    cnae: cnaeFormatted || form.cnae,
                    situacaoCadastral: data.situacao_cadastral || form.situacaoCadastral,
                    dataAbertura: data.data_abertura || form.dataAbertura,
                    porte: data.porte || form.porte,
                    email: data.email || form.email,
                    phone: data.telefone || form.phone,
                    address: {
                        ...form.address,
                        zipCode: data.cep ? formatCep(data.cep) : form.address.zipCode,
                        street: data.logradouro || form.address.street,
                        number: data.numero || form.address.number,
                        complement: data.complemento || form.address.complement,
                        neighborhood: data.bairro || form.address.neighborhood,
                        city: data.municipio || form.address.city,
                        state: data.uf || form.address.state
                    }
                });
                toast.success('Dados da Receita Federal carregados com sucesso!');
            }
        } catch (error) {
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
                        street: data.logradouro || form.address.street,
                        neighborhood: data.bairro || form.address.neighborhood,
                        city: data.localidade || form.address.city,
                        state: data.uf || form.address.state,
                        complement: data.complemento || form.address.complement
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
                        Gerencie as informações completas da sua empresa
                    </p>
                </div>
                <button
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
                </button>
            </div>

            {/* Section 1: Identity */}
            <CompanyIdentitySection
                form={form}
                onChange={handleFormChange}
                onCNPJSearch={handleCNPJSearch}
                isLoadingCNPJ={isLoadingCNPJ}
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

            {/* Section 6: Documents */}
            <CompanyDocumentsSection
                documents={documents}
                isLoading={isLoadingDocs}
                onDocumentsChange={handleDocumentsChange}
            />

            {/* Share Payment Data Modal */}
            <SharePaymentDataModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                pixKey={form.pixKey || ''}
                pixKeyType={form.pixKeyType || ''}
                pixBeneficiaryName={form.pixBeneficiaryName || ''}
                bankName={form.bankName || ''}
                bankAgency={form.bankAgency || ''}
                bankAccount={form.bankAccount || ''}
            />
        </div>
    );
};
