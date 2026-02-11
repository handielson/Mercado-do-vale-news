import React from 'react';
import { FieldRequirement } from '../../../types/category';

interface UniqueFieldsSectionProps {
    config: Record<string, FieldRequirement>;
    onChange: (field: string, value: FieldRequirement) => void;
}

const UNIQUE_FIELD_OPTIONS = [
    { key: 'imei1', label: 'IMEI 1' },
    { key: 'imei2', label: 'IMEI 2' },
    { key: 'serial', label: 'Serial' },
    { key: 'color', label: 'Cor' }
];

/**
 * UniqueFieldsSection Component
 * Allows configuration of which fields should be unique per product
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows EXACT same pattern as FieldConfigSection
 * - Radio buttons for off/optional/required states
 * - Positioned above FieldConfigSection
 */
export const UniqueFieldsSection: React.FC<UniqueFieldsSectionProps> = ({
    config,
    onChange
}) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
                🔑 Campos Únicos
            </h3>

            <p className="text-sm text-slate-600 mb-4">
                Configure quais campos devem ter valores únicos para cada produto desta categoria
            </p>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">
                                Campo
                            </th>
                            <th className="px-4 py-3 text-center font-medium text-slate-700 min-w-[80px]">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                    <span className="text-xs">Oculto</span>
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center font-medium text-slate-700 min-w-[80px]">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                                    <span className="text-xs">Opcional</span>
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center font-medium text-slate-700 min-w-[100px]">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                    <span className="text-xs">Obrigatório</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {UNIQUE_FIELD_OPTIONS.map(option => {
                            const currentValue = config[option.key] || 'optional';

                            return (
                                <tr key={option.key} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-slate-900">
                                        {option.label}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="radio"
                                            name={`unique_${option.key}`}
                                            checked={currentValue === 'off'}
                                            onChange={() => onChange(option.key, 'off')}
                                            className="w-4 h-4 text-red-600 focus:ring-red-500 cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="radio"
                                            name={`unique_${option.key}`}
                                            checked={currentValue === 'optional'}
                                            onChange={() => onChange(option.key, 'optional')}
                                            className="w-4 h-4 text-yellow-600 focus:ring-yellow-500 cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="radio"
                                            name={`unique_${option.key}`}
                                            checked={currentValue === 'required'}
                                            onChange={() => onChange(option.key, 'required')}
                                            className="w-4 h-4 text-green-600 focus:ring-green-500 cursor-pointer"
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-700 mb-2">Legenda:</p>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                <span><strong>Obrigatório:</strong> Campo único e obrigatório</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                                <span><strong>Opcional:</strong> Campo pode ter valores duplicados</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                <span><strong>Oculto:</strong> Campo não aparece no formulário</span>
                            </div>
                        </div>
                    </div>
                    <div className="ml-4">
                        <code className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded border border-slate-300">
                            unique_fields
                        </code>
                    </div>
                </div>
            </div>
        </div>
    );
};
