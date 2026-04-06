import React, { useEffect, useState } from 'react';
import { CreditCard, Copy, Check } from 'lucide-react';
import { TeamMemberInput } from '../../types/team';
import { toast } from 'sonner';

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
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const bankName = (formData as any).bank_name;
        const lines = [
            `Nome: ${formData.name || '-'}`,
            `Tipo de PIX: ${PIX_KEY_LABELS[keyType]}`,
            `PIX: ${formData.pix_key || '-'}`,
            `Instituição: ${bankName || '-'}`,
        ];
        await navigator.clipboard.writeText(lines.join('\n'));
        setCopied(true);
        toast.success('Dados de pagamento copiados!');
        setTimeout(() => setCopied(false), 2000);
    };

    // Auto-fill pix_key with CPF when type is 'cpf' and pix_key is empty
    useEffect(() => {
        if (
            (formData.pix_key_type === 'cpf' || !formData.pix_key_type) &&
            !formData.pix_key &&
            formData.cpf_cnpj
        ) {
            onFieldUpdate('pix_key', formData.cpf_cnpj);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.cpf_cnpj, formData.pix_key_type]);

    const handleTypeChange = (newType: string) => {
        const type = (newType || 'cpf') as PixKeyType;
        onFieldUpdate('pix_key_type', type);
        // Auto-fill CPF when switching to type 'cpf'
        if (type === 'cpf') {
            onFieldUpdate('pix_key', formData.cpf_cnpj || '');
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
                        {keyType === 'cpf' && (
                            <span className="ml-1 text-xs text-blue-500">(preenchido automaticamente)</span>
                        )}
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
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <CreditCard className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <div className="text-sm">
                            <span className="text-green-700 font-medium">PIX: </span>
                            <span className="text-green-800">
                                {PIX_KEY_LABELS[keyType]} • {formData.pix_key}
                                {(formData as any).bank_name && ` — ${(formData as any).bank_name}`}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCopy}
                        title="Copiar dados de pagamento"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors flex-shrink-0"
                    >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                </div>
            )}
        </div>
    );
}
