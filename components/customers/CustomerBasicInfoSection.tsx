import React from 'react';
import { User } from 'lucide-react';
import { CustomerInput } from '../../types/customer';
import { formatCpf, formatCnpj, validateCpf, validateCnpj } from '../../utils/cpfCnpjValidation';
import { capitalizeName, calculateAge, daysUntilBirthday } from '../../utils/customerFormUtils';
import { toast } from 'sonner';

interface CustomerBasicInfoSectionProps {
    formData: CustomerInput;
    documentType: 'CPF' | 'CNPJ';
    onFieldUpdate: (field: string, value: any) => void;
    onDocumentTypeChange: (type: 'CPF' | 'CNPJ') => void;
}

export default function CustomerBasicInfoSection({
    formData,
    documentType,
    onFieldUpdate,
    onDocumentTypeChange
}: CustomerBasicInfoSectionProps) {

    const handleCpfCnpjBlur = (value: string) => {
        if (!value) return;

        const cleanValue = value.replace(/\D/g, '');

        if (documentType === 'CPF') {
            if (cleanValue.length === 11) {
                const formatted = formatCpf(cleanValue);
                if (!validateCpf(cleanValue)) {
                    toast.error('CPF inválido');
                    return;
                }
                onFieldUpdate('cpf_cnpj', formatted);
            }
        } else {
            if (cleanValue.length === 14) {
                const formatted = formatCnpj(cleanValue);
                if (!validateCnpj(cleanValue)) {
                    toast.error('CNPJ inválido');
                    return;
                }
                onFieldUpdate('cpf_cnpj', formatted);
            }
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Informações Básicas</h2>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nome / Razão Social *
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => onFieldUpdate('name', capitalizeName(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Digite o nome do cliente"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Data de Nascimento
                    </label>
                    <input
                        type="date"
                        value={formData.birth_date || ''}
                        onChange={(e) => onFieldUpdate('birth_date', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {formData.birth_date && (
                        <div className="mt-2 flex gap-4 text-sm">
                            <span className="text-blue-600 font-medium">
                                🎂 {calculateAge(formData.birth_date)} anos
                            </span>
                            {daysUntilBirthday(formData.birth_date) === 0 ? (
                                <span className="text-green-600 font-medium">
                                    🎉 Aniversário hoje!
                                </span>
                            ) : (
                                <span className="text-slate-600">
                                    📅 Faltam {daysUntilBirthday(formData.birth_date)} dias para o aniversário
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tipo de Cliente
                    </label>
                    <select
                        value={formData.customer_type || ''}
                        onChange={(e) => onFieldUpdate('customer_type', e.target.value as 'wholesale' | 'resale' | 'retail')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="retail">Varejo</option>
                        <option value="resale">Revenda</option>
                        <option value="wholesale">Atacado</option>
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Tipo de Documento
                        </label>
                        <select
                            value={documentType}
                            onChange={(e) => onDocumentTypeChange(e.target.value as 'CPF' | 'CNPJ')}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="CPF">CPF</option>
                            <option value="CNPJ">CNPJ</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            {documentType} *
                        </label>
                        <input
                            type="text"
                            value={formData.cpf_cnpj || ''}
                            onChange={(e) => onFieldUpdate('cpf_cnpj', e.target.value)}
                            onBlur={(e) => handleCpfCnpjBlur(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                            maxLength={documentType === 'CPF' ? 14 : 18}
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Status
                    </label>
                    <select
                        value={formData.is_active ? 'active' : 'inactive'}
                        onChange={(e) => onFieldUpdate('is_active', e.target.value === 'active')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
