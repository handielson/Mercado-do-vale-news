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
    const keyType = formData.pix_key_type as PixKeyType | undefined;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Dados Financeiros</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipo de chave PIX */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tipo de Chave PIX
                    </label>
                    <select
                        value={formData.pix_key_type || ''}
                        onChange={(e) => {
                            onFieldUpdate('pix_key_type', e.target.value || undefined);
                            onFieldUpdate('pix_key', ''); // limpa a chave ao mudar tipo
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
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
                        disabled={!keyType}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder={keyType ? PIX_KEY_PLACEHOLDERS[keyType] : 'Selecione o tipo primeiro'}
                    />
                </div>
            </div>

            {formData.pix_key && formData.pix_key_type && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="text-sm">
                        <span className="text-green-700 font-medium">PIX configurado: </span>
                        <span className="text-green-800">{PIX_KEY_LABELS[formData.pix_key_type as PixKeyType]} • {formData.pix_key}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
