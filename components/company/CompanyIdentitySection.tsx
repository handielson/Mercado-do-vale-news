/**
 * CompanyIdentitySection Component
 * 
 * Handles company identification data including:
 * - Logo and Favicon upload
 * - Logo URL (alternative to upload)
 * - CNPJ with Receita Federal search
 * - State Registration (IE)
 * - Company name and email
 * - Phone/WhatsApp
 * - Receita Federal data (Razão Social, CNAE, etc.)
 * 
 * Route: Settings → Company Data → Identity Section
 */

import React from 'react';
import {
    Building2, Loader2, FileText, Smartphone, Mail
} from 'lucide-react';
import { Company } from '../../types/company';
import { ImageUploader } from '../ui/ImageUploader';

interface CompanyIdentitySectionProps {
    form: Company;
    onChange: (updates: Partial<Company>) => void;
    onCNPJSearch: () => Promise<void>;
    isLoadingCNPJ: boolean;
    formatPhone: (value: string) => string;
    formatCNPJ: (value: string) => string;
}

export const CompanyIdentitySection: React.FC<CompanyIdentitySectionProps> = ({
    form,
    onChange,
    onCNPJSearch,
    isLoadingCNPJ,
    formatPhone,
    formatCNPJ
}) => {
    return (
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
                    onChange={(base64) => onChange({ logo: base64 })}
                    recommendedSize="400x400px"
                />

                <ImageUploader
                    label="Favicon"
                    value={form.favicon || null}
                    onChange={(base64) => onChange({ favicon: base64 })}
                    recommendedSize="64x64px"
                    maxWidth={64}
                />
            </div>

            {/* URL do Logo (alternativa) */}
            <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    URL do Logo (Opcional)
                </label>
                <input
                    type="url"
                    value={form.logoUrl || ''}
                    onChange={(e) => onChange({ logoUrl: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="https://exemplo.com/logo.png"
                />
                <p className="text-xs text-slate-500 mt-1">
                    Alternativa ao upload: cole a URL de uma imagem hospedada online (usado em recibos e termos de garantia)
                </p>
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
                            onChange={(e) => onChange({ cnpj: formatCNPJ(e.target.value) })}
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="00.000.000/0000-00"
                            maxLength={18}
                        />
                        <button
                            type="button"
                            onClick={onCNPJSearch}
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
                            onChange={(e) => onChange({ stateRegistration: e.target.value })}
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="000.000.000.000"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const cnpjClean = form.cnpj.replace(/\D/g, '');
                                if (cnpjClean.length === 14) {
                                    window.open(`https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp?cnpj=${cnpjClean}`, '_blank');
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
                        onChange={(e) => onChange({ phone: formatPhone(e.target.value) })}
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
                        onChange={(e) => onChange({ name: e.target.value })}
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
                        onChange={(e) => onChange({ email: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="contato@empresa.com"
                    />
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
                            onChange={(e) => onChange({ razaoSocial: e.target.value })}
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
                            onChange={(e) => onChange({ situacaoCadastral: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            placeholder="Ex: Ativa"
                            readOnly
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Data de Abertura
                        </label>
                        <input
                            type="text"
                            value={form.dataAbertura || ''}
                            onChange={(e) => onChange({ dataAbertura: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            placeholder="DD/MM/AAAA"
                            readOnly
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Porte
                        </label>
                        <input
                            type="text"
                            value={form.porte || ''}
                            onChange={(e) => onChange({ porte: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            placeholder="Ex: ME, EPP"
                            readOnly
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            CNAE Principal
                        </label>
                        <input
                            type="text"
                            value={form.cnae || ''}
                            onChange={(e) => onChange({ cnae: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            placeholder="Ex: 4711-3/02 - Comércio varejista"
                            readOnly
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
