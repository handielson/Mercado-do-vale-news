import React, { useState, useEffect } from 'react';
import { CategoryConfig, FieldRequirement } from '../../../types/category';

interface FieldConfigSectionProps {
    config: CategoryConfig;
    onChange: (field: keyof CategoryConfig, value: FieldRequirement) => void;
    eanExcludedFields: string[];
    onEANExclusionChange: (fields: string[]) => void;
    autoNamingFields: string[];
    onAutoNamingFieldsChange: (fields: string[]) => void;
}

interface DynamicField {
    key: string;
    label: string;
    category: 'specs' | 'basic';
}

/**
 * FieldConfigSection Component
 * Unified configuration table for category fields
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Modular section component
 * - Controlled by parent via props
 * - Radio buttons for required/optional/off states
 * - Checkboxes for EAN exclusion and auto-naming
 * - DYNAMIC: Loads available fields from field-dictionary
 */
export const FieldConfigSection: React.FC<FieldConfigSectionProps> = ({
    config,
    onChange,
    eanExcludedFields,
    onEANExclusionChange,
    autoNamingFields,
    onAutoNamingFieldsChange
}) => {
    const [availableFields, setAvailableFields] = useState<DynamicField[]>([]);

    useEffect(() => {
        loadAvailableFields();
    }, []);

    const loadAvailableFields = async () => {
        // Get fields from product-fields configuration
        const { getBasicFields, getSpecFields } = await import('../../../config/product-fields');

        const basicFields = getBasicFields();
        const specFields = getSpecFields();

        // Map to DynamicField format
        const allFields: DynamicField[] = [
            ...basicFields.map(f => ({ key: f.key, label: f.label, category: 'basic' as const })),
            ...specFields.map(f => ({
                // Remove 'specs.' prefix from key for config storage
                key: f.key.replace('specs.', ''),
                label: f.label,
                category: 'specs' as const
            }))
        ];

        // Sort alphabetically by label
        allFields.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

        setAvailableFields(allFields);
    };

    const handleEANExclusionToggle = (fieldKey: string, checked: boolean) => {
        const newExcluded = checked
            ? [...eanExcludedFields, fieldKey]
            : eanExcludedFields.filter(f => f !== fieldKey);
        onEANExclusionChange(newExcluded);
    };

    const handleAutoNamingToggle = (fieldKey: string, checked: boolean) => {
        const newFields = checked
            ? [...autoNamingFields, fieldKey]
            : autoNamingFields.filter(f => f !== fieldKey);
        onAutoNamingFieldsChange(newFields);
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
                🚦 Configuração Completa de Campos
            </h3>

            <p className="text-sm text-slate-600 mb-4">
                Configure visibilidade, obrigatoriedade, exclusão do EAN e uso na geração automática de nome
            </p>

            {availableFields.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    Carregando campos disponíveis...
                </div>
            ) : (
                <>
                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-slate-700 sticky left-0 bg-slate-50">
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
                                    <th className="px-4 py-3 text-center font-medium text-slate-700 min-w-[120px]">
                                        <div className="flex flex-col items-center gap-1">
                                            <span>📦</span>
                                            <span className="text-xs">Excluir EAN</span>
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-center font-medium text-slate-700 min-w-[120px]">
                                        <div className="flex flex-col items-center gap-1">
                                            <span>🏷️</span>
                                            <span className="text-xs">Gerar Nome</span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {availableFields.map((field) => {
                                    const fieldKey = field.key as keyof CategoryConfig;
                                    const currentValue = config[fieldKey] as FieldRequirement || 'optional';
                                    const isEANExcluded = eanExcludedFields.includes(field.key);
                                    const isInAutoNaming = autoNamingFields.includes(field.key);

                                    return (
                                        <tr key={field.key} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white">
                                                <div className="flex flex-col">
                                                    <span>{field.label}</span>
                                                    <span className="text-xs text-slate-500">
                                                        {field.category === 'basic' ? 'Básico' : 'Especificação'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="radio"
                                                    name={field.key}
                                                    checked={currentValue === 'off'}
                                                    onChange={() => onChange(fieldKey, 'off')}
                                                    className="w-4 h-4 text-red-600 focus:ring-red-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="radio"
                                                    name={field.key}
                                                    checked={currentValue === 'optional'}
                                                    onChange={() => onChange(fieldKey, 'optional')}
                                                    className="w-4 h-4 text-yellow-600 focus:ring-yellow-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="radio"
                                                    name={field.key}
                                                    checked={currentValue === 'required'}
                                                    onChange={() => onChange(fieldKey, 'required')}
                                                    className="w-4 h-4 text-green-600 focus:ring-green-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isEANExcluded}
                                                    onChange={(e) => handleEANExclusionToggle(field.key, e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer rounded"
                                                    title="Excluir este campo do preenchimento automático por EAN"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isInAutoNaming}
                                                    onChange={(e) => handleAutoNamingToggle(field.key, e.target.checked)}
                                                    className="w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer rounded"
                                                    title="Usar este campo na geração automática de nome"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Legend */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs font-semibold text-slate-700 mb-2">Legenda:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                <span><strong>Obrigatório:</strong> Campo deve ser preenchido</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                                <span><strong>Opcional:</strong> Campo pode ser vazio</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                <span><strong>Oculto:</strong> Não aparece no formulário</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>📦</span>
                                <span><strong>Excluir EAN:</strong> Não preencher via código de barras</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>🏷️</span>
                                <span><strong>Gerar Nome:</strong> Usar na criação automática do nome</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
