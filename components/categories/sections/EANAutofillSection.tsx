import React from 'react';
import { CustomField } from '../../../types/category';
import { getBasicFields, getSpecFields, getPriceFields } from '../../../config/product-fields';

interface EANAutofillConfig {
    enabled: boolean;
    exclude_fields: string[];
}

interface EANAutofillSectionProps {
    config: EANAutofillConfig;
    customFields: CustomField[];
    onChange: (config: EANAutofillConfig) => void;
}

/**
 * EANAutofillSection Component
 * Configuration for EAN-based auto-fill functionality
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Modular section component
 * - Manages which fields should NOT be auto-filled
 * - Grouped by field categories
 */
export const EANAutofillSection: React.FC<EANAutofillSectionProps> = ({
    config,
    customFields,
    onChange
}) => {
    const handleToggleEnabled = (enabled: boolean) => {
        onChange({
            ...config,
            enabled,
            exclude_fields: config.exclude_fields || []
        });
    };

    const handleToggleField = (fieldKey: string, checked: boolean) => {
        const currentExcluded = config.exclude_fields || [];
        const newExcluded = checked
            ? [...currentExcluded, fieldKey]
            : currentExcluded.filter(f => f !== fieldKey);

        onChange({
            ...config,
            exclude_fields: newExcluded
        });
    };

    const fiscalFields = [
        { key: 'ncm', label: 'NCM' },
        { key: 'cest', label: 'CEST' },
        { key: 'origin', label: 'Origem' }
    ];

    const logisticsFields = [
        { key: 'weight_kg', label: 'Peso (kg)' },
        { key: 'dimensions', label: 'Dimensões' },
        { key: 'stock_quantity', label: 'Quantidade em Estoque' }
    ];

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
                📦 Preenchimento Automático por EAN
            </h3>

            {/* Toggle: Ativar auto-fill */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <input
                    type="checkbox"
                    checked={config.enabled ?? true}
                    onChange={(e) => handleToggleEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                    <label className="text-sm font-medium text-slate-700 cursor-pointer">
                        Preencher campos automaticamente ao escanear EAN existente
                    </label>
                    <p className="text-xs text-slate-500">
                        Quando um código de barras já cadastrado for escaneado, os campos serão preenchidos automaticamente
                    </p>
                </div>
            </div>

            {(config.enabled ?? true) && (
                <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">
                        Campos que NÃO devem ser preenchidos automaticamente:
                    </p>
                    <p className="text-xs text-slate-500 -mt-2">
                        Útil para campos únicos por dispositivo (ex: IMEI, Serial) ou que variam por lote (preço, estoque)
                    </p>

                    {/* Informações Básicas */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Informações Básicas</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {getBasicFields().map(field => (
                                <label
                                    key={field.key}
                                    className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                >
                                    <input
                                        type="checkbox"
                                        checked={config.exclude_fields?.includes(field.key) ?? false}
                                        onChange={(e) => handleToggleField(field.key, e.target.checked)}
                                        className="w-3 h-3 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                                    />
                                    <span className="text-slate-700">{field.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Especificações */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Especificações</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {getSpecFields().map(field => (
                                <label
                                    key={field.key}
                                    className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                >
                                    <input
                                        type="checkbox"
                                        checked={config.exclude_fields?.includes(field.key) ?? false}
                                        onChange={(e) => handleToggleField(field.key, e.target.checked)}
                                        className="w-3 h-3 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                                    />
                                    <span className="text-slate-700">{field.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Preços */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Preços</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {getPriceFields().map(field => (
                                <label
                                    key={field.key}
                                    className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                >
                                    <input
                                        type="checkbox"
                                        checked={config.exclude_fields?.includes(field.key) ?? false}
                                        onChange={(e) => handleToggleField(field.key, e.target.checked)}
                                        className="w-3 h-3 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                                    />
                                    <span className="text-slate-700">{field.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Fiscal */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Fiscal</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {fiscalFields.map(field => (
                                <label
                                    key={field.key}
                                    className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                >
                                    <input
                                        type="checkbox"
                                        checked={config.exclude_fields?.includes(field.key) ?? false}
                                        onChange={(e) => handleToggleField(field.key, e.target.checked)}
                                        className="w-3 h-3 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                                    />
                                    <span className="text-slate-700">{field.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Logística */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Logística</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {logisticsFields.map(field => (
                                <label
                                    key={field.key}
                                    className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                >
                                    <input
                                        type="checkbox"
                                        checked={config.exclude_fields?.includes(field.key) ?? false}
                                        onChange={(e) => handleToggleField(field.key, e.target.checked)}
                                        className="w-3 h-3 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                                    />
                                    <span className="text-slate-700">{field.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Custom Fields (Dynamic) */}
                    {customFields && customFields.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Campos Personalizados</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {customFields.map(field => {
                                    const fieldKey = `specs.${field.key}`;
                                    return (
                                        <label
                                            key={field.key}
                                            className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={config.exclude_fields?.includes(fieldKey) ?? false}
                                                onChange={(e) => handleToggleField(fieldKey, e.target.checked)}
                                                className="w-3 h-3 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                                            />
                                            <span className="text-slate-700">{field.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                        <p className="text-xs text-yellow-800">
                            <strong>💡 Exemplo:</strong> Para celulares, marque IMEI 1, IMEI 2 e Serial para que cada dispositivo tenha seus próprios identificadores únicos.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
