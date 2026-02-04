/**
 * CompanyFinancialSection Component
 * 
 * Handles company financial data (PIX and bank info)
 * 
 * Route: Settings → Company Data → Financial Section
 */

import React from 'react';
import { DollarSign, Share2 } from 'lucide-react';
import { Company } from '../../types/company';

interface CompanyFinancialSectionProps {
    form: Company;
    onChange: (updates: Partial<Company>) => void;
    onSharePaymentData: () => void;
}

export const CompanyFinancialSection: React.FC<CompanyFinancialSectionProps> = ({
    form,
    onChange,
    onSharePaymentData
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                <DollarSign size={22} className="text-blue-600" />
                Dados Financeiros
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Nome do Beneficiário PIX
                    </label>
                    <input
                        type="text"
                        value={form.pixBeneficiaryName || ''}
                        onChange={(e) => onChange({ pixBeneficiaryName: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Nome que aparece no PIX"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Chave PIX
                    </label>
                    <input
                        type="text"
                        value={form.pixKey || ''}
                        onChange={(e) => onChange({ pixKey: e.target.value })}
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
                        onChange={(e) => onChange({ pixKeyType: e.target.value as any })}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Banco
                    </label>
                    <input
                        type="text"
                        value={form.bankName || ''}
                        onChange={(e) => onChange({ bankName: e.target.value })}
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
                        onChange={(e) => onChange({ bankAgency: e.target.value })}
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
                        onChange={(e) => onChange({ bankAccount: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="00000-0"
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={onSharePaymentData}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-green-700 transition-all shadow-sm"
                >
                    <Share2 size={18} />
                    Compartilhar Dados de Pagamento
                </button>
            </div>
        </div>
    );
};
