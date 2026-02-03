import React, { useState, useEffect } from 'react';
import {
    Building2, MapPin, DollarSign, Globe, Save, Loader2,
    Info, Smartphone, Mail, FileText, Instagram, Facebook,
    Youtube, Star, Clock, AlertCircle
} from 'lucide-react';
import { Company, defaultCompany } from '../../../types/company';
import { getCompanyData, saveCompanyData } from '../../../services/companyService';
import { ImageUploader } from '../../../components/ui/ImageUploader';
import { SocialMediaInput } from '../../../components/ui/SocialMediaInput';
import {
    formatInstagramUrl,
    formatFacebookUrl,
    formatYoutubeUrl
} from '../../../utils/socialMediaHelpers';
import { formatCep, searchCep } from '../../../utils/customerFormUtils';
import { validateCNPJ } from '../../../utils/cpfCnpjValidation';
import { searchCNPJ, isValidCNPJ } from '../../../utils/cnpjHelper';
import { DocumentUploader } from '../../../components/DocumentUploader';
import { DocumentList } from '../../../components/DocumentList';
import { getDocuments } from '../../../services/documentService';
import type { CompanyDocument } from '../../../types/document';
import { toast } from 'sonner';

export const CompanyDataPage: React.FC = () => {
    const [form, setForm] = useState<Company>(defaultCompany);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingCep, setIsLoadingCep] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [documents, setDocuments] = useState<CompanyDocument[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);

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

    const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);

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
        } catch (err: any) {
            console.error('Erro ao buscar CNPJ:', err);
            toast.error(err.message || 'Erro ao buscar CNPJ. Tente novamente.');
        } finally {
            setIsLoadingCNPJ(false);
        }
    };

    const handleSave = async () => {
        // Validações
        if (!form.name.trim()) {
            toast.error('Por favor, preencha o nome da empresa.');
            return;
        }

        if (form.cnpj && !validateCNPJ(form.cnpj)) {
            toast.error('CNPJ inválido. Por favor, verifique.');
            return;
        }

        setIsSaving(true);
        try {
            await saveCompanyData(form);
            toast.success('Dados salvos com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar:', err);
            toast.error('Erro ao salvar dados. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCepSearch = async () => {
        const cep = form.address.zipCode.replace(/\D/g, '');
        if (cep.length !== 8) {
            toast.error('CEP inválido. Digite 8 dígitos.');
            return;
        }

        setIsLoadingCep(true);
        try {
            const addressData = await searchCep(cep);
            if (addressData) {
                setForm({
                    ...form,
                    address: {
                        ...form.address,
                        street: addressData.street || form.address.street,
                        neighborhood: addressData.neighborhood || form.address.neighborhood,
                        city: addressData.city || form.address.city,
                        state: addressData.state || form.address.state
                    }
                });
                toast.success('Endereço encontrado!');
            } else {
                toast.error('CEP não encontrado. Verifique e tente novamente.');
            }
        } catch (err) {
            console.error('Erro ao buscar CEP:', err);
            toast.error('Erro ao buscar CEP. Tente novamente.');
        } finally {
            setIsLoadingCep(false);
        }
    };

    const formatPhone = (value: string): string => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length <= 10) {
            return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    };

    const formatCNPJ = (value: string): string => {
        const cleaned = value.replace(/\D/g, '');
        return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    };

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

            {/* Seção 1: Identificação */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                    <Building2 size={22} className="text-blue-600" />
                    Identificação da Empresa
                </h2>

                {/* Logo e Favicon */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <ImageUploader
                        label="Logo da Empresa"
                        value={form.logo}
                        onChange={(base64) => setForm({ ...form, logo: base64 })}
                        recommendedSize="400x400px"
                    />

                    <ImageUploader
                        label="Favicon"
                        value={form.favicon || null}
                        onChange={(base64) => setForm({ ...form, favicon: base64 })}
                        recommendedSize="64x64px"
                        maxWidth={64}
                    />
                </div>

                {/* Dados básicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            CNPJ
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={form.cnpj}
                                onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="00.000.000/0000-00"
                                maxLength={18}
                            />
                            <button
                                type="button"
                                onClick={handleCNPJSearch}
                                disabled={isLoadingCNPJ || !form.cnpj}
                                className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-200 disabled:opacity-50 transition-all whitespace-nowrap"
                                title="Buscar dados na Receita Federal"
                            >
                                {isLoadingCNPJ ? <Loader2 className="animate-spin" size={18} /> : 'Buscar'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Inscrição Estadual (IE)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={form.stateRegistration || ''}
                                onChange={(e) => setForm({ ...form, stateRegistration: e.target.value })}
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="000.000.000.000"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const cnpjClean = form.cnpj.replace(/\D/g, '');
                                    if (cnpjClean.length === 14) {
                                        window.open(`https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp?cnpj=${cnpjClean}`, '_blank');
                                        toast.success('Abrindo certificado da Receita Federal');
                                    } else {
                                        toast.error('CNPJ inválido para gerar certificado');
                                    }
                                }}
                                disabled={!form.cnpj || form.cnpj.replace(/\D/g, '').length !== 14}
                                className="bg-green-100 text-green-700 px-3 py-2 rounded-lg font-semibold text-sm hover:bg-green-200 disabled:opacity-50 transition-all whitespace-nowrap flex items-center gap-1.5"
                                title="Imprimir Certificado da Receita Federal"
                            >
                                <FileText size={16} />
                                Certificado
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                            <Smartphone size={16} />
                            WhatsApp / Telefone
                        </label>
                        <input
                            type="text"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="(00) 00000-0000"
                            maxLength={15}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Nome Comercial *
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Ex: Mercado do Vale"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                            <Mail size={16} />
                            E-mail
                        </label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="contato@empresa.com"
                        />
                    </div>
                </div>
            </div>

            {/* Dados da Receita Federal */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <h3 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Dados da Receita Federal (preenchidos automaticamente)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Razão Social
                        </label>
                        <input
                            type="text"
                            value={form.razaoSocial || ''}
                            onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            placeholder="Nome oficial da empresa"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Situação Cadastral
                        </label>
                        <input
                            type="text"
                            value={form.situacaoCadastral || ''}
                            onChange={(e) => setForm({ ...form, situacaoCadastral: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            placeholder="Ex: Ativa"
                            readOnly
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            CNAE Principal
                        </label>
                        <input
                            type="text"
                            value={form.cnae || ''}
                            onChange={(e) => setForm({ ...form, cnae: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            placeholder="Código - Descrição da atividade"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Data de Abertura
                            </label>
                            <input
                                type="date"
                                value={form.dataAbertura || ''}
                                onChange={(e) => setForm({ ...form, dataAbertura: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Porte
                            </label>
                            <input
                                type="text"
                                value={form.porte || ''}
                                onChange={(e) => setForm({ ...form, porte: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                placeholder="Ex: ME, EPP"
                                readOnly
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Seção 2: Endereço */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                    <MapPin size={22} className="text-green-600" />
                    Endereço Completo
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            CEP
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={form.address.zipCode}
                                onChange={(e) => setForm({
                                    ...form,
                                    address: { ...form.address, zipCode: formatCep(e.target.value) }
                                })}
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="00000-000"
                                maxLength={9}
                            />
                            <button
                                type="button"
                                onClick={handleCepSearch}
                                disabled={isLoadingCep}
                                className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-200 disabled:opacity-50 transition-all"
                            >
                                {isLoadingCep ? <Loader2 className="animate-spin" size={18} /> : 'Buscar'}
                            </button>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Cidade
                        </label>
                        <input
                            type="text"
                            value={form.address.city}
                            onChange={(e) => setForm({
                                ...form,
                                address: { ...form.address, city: e.target.value }
                            })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Ex: São Paulo"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Logradouro
                        </label>
                        <input
                            type="text"
                            value={form.address.street}
                            onChange={(e) => setForm({
                                ...form,
                                address: { ...form.address, street: e.target.value }
                            })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Rua, Avenida..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Número
                        </label>
                        <input
                            type="text"
                            value={form.address.number}
                            onChange={(e) => setForm({
                                ...form,
                                address: { ...form.address, number: e.target.value }
                            })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="123"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Bairro
                        </label>
                        <input
                            type="text"
                            value={form.address.neighborhood}
                            onChange={(e) => setForm({
                                ...form,
                                address: { ...form.address, neighborhood: e.target.value }
                            })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Ex: Centro"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Complemento
                        </label>
                        <input
                            type="text"
                            value={form.address.complement || ''}
                            onChange={(e) => setForm({
                                ...form,
                                address: { ...form.address, complement: e.target.value }
                            })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Sala, Andar, etc. (opcional)"
                        />
                    </div>
                </div>
            </div>

            {/* Seção 3: Dados Financeiros */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                    <DollarSign size={22} className="text-emerald-600" />
                    Dados Financeiros
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Chave PIX
                        </label>
                        <input
                            type="text"
                            value={form.pixKey || ''}
                            onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Digite a chave PIX"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Tipo de Chave PIX
                        </label>
                        <select
                            value={form.pixKeyType || ''}
                            onChange={(e) => setForm({ ...form, pixKeyType: e.target.value as any })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                            <option value="">Selecione...</option>
                            <option value="CPF">CPF</option>
                            <option value="CNPJ">CNPJ</option>
                            <option value="EMAIL">E-mail</option>
                            <option value="PHONE">Telefone</option>
                            <option value="RANDOM">Chave Aleatória</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Banco
                        </label>
                        <input
                            type="text"
                            value={form.bankName || ''}
                            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Ex: Banco do Brasil"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Agência
                        </label>
                        <input
                            type="text"
                            value={form.bankAgency || ''}
                            onChange={(e) => setForm({ ...form, bankAgency: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="0000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Conta
                        </label>
                        <input
                            type="text"
                            value={form.bankAccount || ''}
                            onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="00000-0"
                        />
                    </div>
                </div>
            </div>

            {/* Seção 4: Presença Digital */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                    <Globe size={22} className="text-purple-600" />
                    Presença Digital
                </h2>

                <SocialMediaInput
                    label="Instagram"
                    icon={<Instagram size={18} />}
                    iconColor="text-pink-600"
                    value={form.socialMedia?.instagram || ''}
                    onChange={(value) => setForm({
                        ...form,
                        socialMedia: { ...form.socialMedia, instagram: value }
                    })}
                    placeholder="@usuario ou URL completa"
                    formatUrl={formatInstagramUrl}
                />

                <SocialMediaInput
                    label="Facebook"
                    icon={<Facebook size={18} />}
                    iconColor="text-blue-600"
                    value={form.socialMedia?.facebook || ''}
                    onChange={(value) => setForm({
                        ...form,
                        socialMedia: { ...form.socialMedia, facebook: value }
                    })}
                    placeholder="Nome da página ou URL"
                    formatUrl={formatFacebookUrl}
                />

                <SocialMediaInput
                    label="YouTube"
                    icon={<Youtube size={18} />}
                    iconColor="text-red-600"
                    value={form.socialMedia?.youtube || ''}
                    onChange={(value) => setForm({
                        ...form,
                        socialMedia: { ...form.socialMedia, youtube: value }
                    })}
                    placeholder="@canal ou URL"
                    formatUrl={formatYoutubeUrl}
                />

                <SocialMediaInput
                    label="Website"
                    icon={<Globe size={18} />}
                    iconColor="text-slate-600"
                    value={form.socialMedia?.website || ''}
                    onChange={(value) => setForm({
                        ...form,
                        socialMedia: { ...form.socialMedia, website: value }
                    })}
                    placeholder="https://seusite.com"
                    formatUrl={(v) => v.startsWith('http') ? v : `https://${v}`}
                />

                <div className="mb-0">
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <Star size={18} className="text-yellow-500" />
                        Link do Google Reviews
                    </label>
                    <input
                        type="text"
                        value={form.googleReviewsLink || ''}
                        onChange={(e) => setForm({ ...form, googleReviewsLink: e.target.value })}
                        placeholder="Cole o link do Google Reviews"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Seção 5: Informações Adicionais */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                    <FileText size={22} className="text-indigo-600" />
                    Informações Adicionais
                </h2>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                            <Clock size={16} />
                            Horário de Funcionamento
                        </label>
                        <input
                            type="text"
                            value={form.businessHours || ''}
                            onChange={(e) => setForm({ ...form, businessHours: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Ex: Seg-Sex: 9h-18h, Sáb: 9h-13h"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                            <Info size={16} />
                            Descrição da Empresa
                        </label>
                        <textarea
                            value={form.description || ''}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={4}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                            placeholder="Descreva sua empresa, produtos e serviços..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                            <AlertCircle size={16} />
                            Observações Internas
                        </label>
                        <textarea
                            value={form.internalNotes || ''}
                            onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                            rows={3}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                            placeholder="Anotações internas (não visíveis ao público)..."
                        />
                    </div>
                </div>
            </div>

            {/* Seção 6: Documentos da Empresa */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                    <FileText size={22} className="text-purple-600" />
                    Documentos da Empresa
                    <span className="text-xs font-normal text-slate-500 ml-auto">
                        {documents.length}/20 documentos
                    </span>
                </h2>

                <div className="space-y-6">
                    <DocumentUploader
                        onUploadSuccess={() => {
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
                            loadDocumentsData();
                        }}
                        currentCount={documents.length}
                        maxDocuments={20}
                    />

                    {isLoadingDocs ? (
                        <div className="text-center py-12">
                            <Loader2 className="animate-spin mx-auto text-blue-600" size={32} />
                            <p className="text-slate-500 mt-2">Carregando documentos...</p>
                        </div>
                    ) : (
                        <DocumentList
                            documents={documents}
                            onDelete={() => {
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
                                loadDocumentsData();
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Botão de salvar fixo no final */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
        </div >
    );
};
