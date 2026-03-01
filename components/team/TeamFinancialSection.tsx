import React from 'react';
import { CreditCard } from 'lucide-react';
import { TeamMemberInput } from '../../types/team';

type PixKeyType = 'cpf' | 'phone' | 'email' | 'random';

const PIX_KEY_LABELS: Record<PixKeyType, string> = {
    cpf: 'CPF / CNPJ',
    phone: 'Celular',
    email: 'E-mail',
    random: 'Chave Aleatória',
};

const PIX_KEY_PLACEHOLDERS: Record<PixKeyType, string> = {
    cpf: '000.000.000-00',
    phone: '(00) 00000-0000',
    email: 'email@exemplo.com',
    random: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};

interface TeamFinancialSectionProps {
    formData: TeamMemberInput;
    onFieldUpdate: (field: string, value: any) => void;
}

export default function TeamFinancialSection({ formData, onFieldUpdate }: TeamFinancialSectionProps) {
    const keyType = (formData.pix_key_type || 'cpf') as PixKeyType;

    const handleTypeChange = (newType: string) => {
        onFieldUpdate('pix_key_type', newType || 'cpf');
        // Pre-fill CPF chave when type is 'cpf'
        if (newType === 'cpf' && formData.cpf_cnpj) {
            onFieldUpdate('pix_key', formData.cpf_cnpj);
        } else {
            onFieldUpdate('pix_key', '');
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Dados Financeiros</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tipo de chave PIX */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tipo de Chave PIX
                    </label>
                    <select
                        value={formData.pix_key_type || 'cpf'}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {(Object.entries(PIX_KEY_LABELS) as [PixKeyType, string][]).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>

                {/* Chave PIX */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Chave PIX
                    </label>
                    <input
                        type="text"
                        value={formData.pix_key || ''}
                        onChange={(e) => onFieldUpdate('pix_key', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={PIX_KEY_PLACEHOLDERS[keyType]}
                    />
                </div>

                {/* Instituição Bancária */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Instituição Bancária
                    </label>
                    <input
                        type="text"
                        value={(formData as any).bank_name || ''}
                        onChange={(e) => onFieldUpdate('bank_name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Nubank, Bradesco, Itaú..."
                    />
                </div>
            </div>

            {formData.pix_key && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="text-sm">
                        <span className="text-green-700 font-medium">PIX configurado: </span>
                        <span className="text-green-800">
                            {PIX_KEY_LABELS[keyType]} • {formData.pix_key}
                            {(formData as any).bank_name && ` (${(formData as any).bank_name})`}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
