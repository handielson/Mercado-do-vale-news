/**
 * CompanyAdditionalInfoSection Component
 * 
 * Handles company additional information (hours, description, notes)
 * 
 * Route: Settings → Company Data → Additional Info Section
 */

import React from 'react';
import { Info, Clock } from 'lucide-react';
import { Company } from '../../types/company';

interface CompanyAdditionalInfoSectionProps {
    form: Company;
    onChange: (updates: Partial<Company>) => void;
}

export const CompanyAdditionalInfoSection: React.FC<CompanyAdditionalInfoSectionProps> = ({
    form,
    onChange
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                <Info size={22} className="text-blue-600" />
                Informações Adicionais
            </h2>

            <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Clock size={16} />
                    Horário de Funcionamento
                </label>
                <input
                    type="text"
                    value={form.businessHours || ''}
                    onChange={(e) => onChange({ businessHours: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Ex: Seg-Sex: 8h-18h | Sáb: 8h-12h"
                />
            </div>

            <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Descrição da Empresa
                </label>
                <textarea
                    value={form.description || ''}
                    onChange={(e) => onChange({ description: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder="Descreva sua empresa, produtos e serviços..."
                    rows={4}
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Observações Internas
                </label>
                <textarea
                    value={form.internalNotes || ''}
                    onChange={(e) => onChange({ internalNotes: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder="Anotações internas (não visíveis para clientes)..."
                    rows={3}
                />
                <p className="text-xs text-slate-500 mt-1">
                    Estas observações são apenas para uso interno
                </p>
            </div>
        </div>
    );
};
