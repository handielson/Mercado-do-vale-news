import React from 'react';
import { DollarSign } from 'lucide-react';
import { TeamMemberInput } from '../../types/team';

interface TeamRemunerationSectionProps {
    formData: TeamMemberInput;
    onFieldUpdate: (field: string, value: any) => void;
}

export default function TeamRemunerationSection({
    formData,
    onFieldUpdate
}: TeamRemunerationSectionProps) {

    const employmentType = formData.employment_type;
    const role = formData.role;

    // Mostrar campos condicionalmente baseado no tipo de vínculo e cargo
    const showSalary = employmentType === 'clt';
    const showHourlyRate = employmentType === 'freelancer' || employmentType === 'pj';
    const showCommissionRate = role === 'seller';
    const showDeliveryFee = role === 'delivery' && (employmentType === 'freelancer' || employmentType === 'pj');

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Remuneração</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {showSalary && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Salário Mensal (R$)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.salary || ''}
                            onChange={(e) => onFieldUpdate('salary', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                        />
                    </div>
                )}

                {showHourlyRate && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Valor por Hora (R$)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.hourly_rate || ''}
                            onChange={(e) => onFieldUpdate('hourly_rate', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                        />
                    </div>
                )}

                {showCommissionRate && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Taxa de Comissão (%)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={formData.commission_rate || ''}
                            onChange={(e) => onFieldUpdate('commission_rate', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Percentual de comissão sobre vendas
                        </p>
                    </div>
                )}

                {showDeliveryFee && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Valor por Entrega (R$)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.delivery_fee || ''}
                            onChange={(e) => onFieldUpdate('delivery_fee', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Valor fixo por entrega realizada
                        </p>
                    </div>
                )}

                {!showSalary && !showHourlyRate && !showCommissionRate && !showDeliveryFee && (
                    <div className="md:col-span-2 text-center text-slate-500 py-4">
                        Selecione o cargo e tipo de vínculo para configurar a remuneração
                    </div>
                )}
            </div>
        </div>
    );
}
