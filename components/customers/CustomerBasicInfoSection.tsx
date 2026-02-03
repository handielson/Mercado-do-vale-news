import React from 'react';
import { User } from 'lucide-react';
import { CustomerInput } from '../../types/customer';
import { formatCpfCnpj, validateCpfCnpj } from '../../utils/cpfCnpjValidation';
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

    // Handle CPF/CNPJ blur with validation
    const handleCpfCnpjBlur = (value: string) => {
        if (!value) return;

        const formatted = formatCpfCnpj(value);
        onFieldUpdate('cpf_cnpj', formatted);

        // Validate based on selected type
        const cleaned = value.replace(/\\D/g, '');
        if (documentType === 'CPF' && cleaned.length > 0 && cleaned.length !== 11) {
            toast.error('CPF deve ter 11 dígitos');
            return;
        }
        if (documentType === 'CNPJ' && cleaned.length > 0 && cleaned.length !== 14) {
            toast.error('CNPJ deve ter 14 dígitos');
            return;
        }

        if (!validateCpfCnpj(value)) {
            toast.error(`${documentType} inválido`);
        }
    };

    // Handle name blur with capitalization
    const handleNameBlur = (value: string) => {
        if (value) {
            onFieldUpdate('name', capitalizeName(value));
        }
    };

    // Calculate age display
    const getAgeDisplay = () => {
        if (!formData.birth_date) return null;
        const age = calculateAge(formData.birth_date);
        const days = daysUntilBirthday(formData.birth_date);

        if (age === null) return null;

        return (
            <div className="text-sm text-slate-600 mt-1">
                {age} anos
                {days !== null && days === 0 && (
                    <span className="ml-2 text-blue-600 font-medium">🎂 Aniversário hoje!</span>
                )}
                {days !== null && days > 0 && days <= 30 && (
                    <span className="ml-2 text-slate-500">
                        (aniversário em {days} {days === 1 ? 'dia' : 'dias'})
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Dados Básicos</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        {documentType === 'CPF' ? 'Nome Completo' : 'Razão Social'} *
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => onFieldUpdate('name', capitalizeName(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={documentType === 'CPF' ? 'João da Silva' : 'Empresa LTDA'}
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
                        max="9999-12-31"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {getAgeDisplay()}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:col-span-2">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Tipo de Documento
                        </label>
                        <select
                            value={documentType}
                            onChange={(e) => {
                                onDocumentTypeChange(e.target.value as 'CPF' | 'CNPJ');
                                onFieldUpdate('cpf_cnpj', '');
                            }}
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
                            value={formData.cpf_cnpj}
                            onChange={(e) => {
                                // Permitir apenas números, pontos, barras e hífens
                                const value = e.target.value.replace(/[^\d./-]/g, '');
                                onFieldUpdate('cpf_cnpj', value);
                            }}
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
