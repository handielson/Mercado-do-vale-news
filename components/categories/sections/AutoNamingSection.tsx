import React from 'react';

interface AutoNamingConfig {
    enabled?: boolean;
    template?: string;
    separator?: string;
}

interface AutoNamingSectionProps {
    config: AutoNamingConfig;
    onChange: (config: AutoNamingConfig) => void;
}

/**
 * AutoNamingSection Component
 * Configuration for automatic product name generation
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Modular section component
 * - Template-based name generation
 * - Live preview with example data
 */
export const AutoNamingSection: React.FC<AutoNamingSectionProps> = ({
    config,
    onChange
}) => {
    const handleToggleEnabled = (enabled: boolean) => {
        onChange({
            ...config,
            enabled,
            separator: config.separator || ' '
        });
    };

    const handleTemplateChange = (template: string) => {
        onChange({
            ...config,
            template
        });
    };

    const addPlaceholder = (placeholder: string) => {
        const current = config.template || '';
        handleTemplateChange(current + placeholder);
    };

    const basicPlaceholders = ['{marca}', '{modelo}', '{sku}'];
    const specPlaceholders = ['{ram}', '{armazenamento}', '{cor}', '{versao}', '{bateria}'];
    const otherPlaceholders = ['{serial}', '{imei1}', '{imei2}', '{ncm}', '{cest}', '{peso}'];

    const presets = [
        { name: 'Simples', template: '{modelo} {ram} {armazenamento} {cor}', example: 'iPhone 13 4GB 128GB Azul' },
        { name: 'Com vírgula e barra', template: '{modelo}, {ram}/{armazenamento} - {versao}', example: 'Redmi Note 14, 6GB/256GB - Global' },
        { name: 'Completo', template: '{marca} {modelo} ({ram}/{armazenamento}) - {cor}', example: 'Apple iPhone 13 (4GB/128GB) - Azul' }
    ];

    const generatePreview = (template: string): string => {
        const exampleData = {
            brand: 'Xiaomi',
            model: 'Redmi Note 14',
            sku: 'RN14-256-AZ',
            specs: {
                ram: '6GB',
                storage: '256GB',
                color: 'Azul',
                version: 'Global',
                battery_health: '95%',
                serial: 'SN123456',
                imei1: '123456789012345',
                imei2: '543210987654321'
            },
            ncm: '85171231',
            cest: '2100100',
            weight_kg: '0.195'
        };

        let preview = template;
        preview = preview.replace(/\{marca\}/g, exampleData.brand);
        preview = preview.replace(/\{modelo\}/g, exampleData.model);
        preview = preview.replace(/\{sku\}/g, exampleData.sku);
        preview = preview.replace(/\{ram\}/g, exampleData.specs.ram);
        preview = preview.replace(/\{armazenamento\}/g, exampleData.specs.storage);
        preview = preview.replace(/\{cor\}/g, exampleData.specs.color);
        preview = preview.replace(/\{versao\}/g, exampleData.specs.version);
        preview = preview.replace(/\{bateria\}/g, exampleData.specs.battery_health);
        preview = preview.replace(/\{serial\}/g, exampleData.specs.serial);
        preview = preview.replace(/\{imei1\}/g, exampleData.specs.imei1);
        preview = preview.replace(/\{imei2\}/g, exampleData.specs.imei2);
        preview = preview.replace(/\{ncm\}/g, exampleData.ncm);
        preview = preview.replace(/\{cest\}/g, exampleData.cest);
        preview = preview.replace(/\{peso\}/g, exampleData.weight_kg);

        return preview || '(Template vazio)';
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
                🏷️ Geração Automática de Nome
            </h3>

            {/* Toggle: Ativar geração automática */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
                <input
                    type="checkbox"
                    checked={config.enabled ?? false}
                    onChange={(e) => handleToggleEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                    <label className="text-sm font-medium text-slate-700 cursor-pointer">
                        Gerar nome automaticamente
                    </label>
                    <p className="text-xs text-slate-500">
                        Nome do produto será gerado com base nos campos selecionados
                    </p>
                </div>
            </div>

            {config.enabled && (
                <div className="space-y-4">
                    {/* Template Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Template do Nome
                        </label>
                        <input
                            type="text"
                            value={config.template || ''}
                            onChange={(e) => handleTemplateChange(e.target.value)}
                            placeholder="Ex: {modelo}, {ram}/{armazenamento} - {versao}"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Use placeholders como {'{modelo}'}, {'{ram}'}, {'{armazenamento}'}, etc.
                        </p>
                    </div>

                    {/* Available Placeholders */}
                    <div>
                        <p className="text-xs font-medium text-slate-700 mb-2">
                            📋 Placeholders Disponíveis (clique para adicionar):
                        </p>
                        <div className="space-y-2">
                            {/* Row 1: Basic fields */}
                            <div className="flex flex-wrap gap-2">
                                {basicPlaceholders.map((placeholder) => (
                                    <button
                                        key={placeholder}
                                        type="button"
                                        onClick={() => addPlaceholder(placeholder)}
                                        className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-mono rounded hover:bg-blue-100 transition-colors"
                                    >
                                        {placeholder}
                                    </button>
                                ))}
                            </div>

                            {/* Row 2: Specs */}
                            <div className="flex flex-wrap gap-2">
                                {specPlaceholders.map((placeholder) => (
                                    <button
                                        key={placeholder}
                                        type="button"
                                        onClick={() => addPlaceholder(placeholder)}
                                        className="px-2 py-1 bg-green-50 text-green-700 text-xs font-mono rounded hover:bg-green-100 transition-colors"
                                    >
                                        {placeholder}
                                    </button>
                                ))}
                            </div>

                            {/* Row 3: Identifiers & Others */}
                            <div className="flex flex-wrap gap-2">
                                {otherPlaceholders.map((placeholder) => (
                                    <button
                                        key={placeholder}
                                        type="button"
                                        onClick={() => addPlaceholder(placeholder)}
                                        className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-mono rounded hover:bg-slate-200 transition-colors"
                                    >
                                        {placeholder}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Template Presets */}
                    <div>
                        <p className="text-xs font-medium text-slate-700 mb-2">
                            ⚡ Modelos Prontos:
                        </p>
                        <div className="space-y-1">
                            {presets.map((preset) => (
                                <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => handleTemplateChange(preset.template)}
                                    className="block w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded text-xs transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-slate-700">{preset.name}</span>
                                        <span className="text-[10px] text-slate-500">{preset.example}</span>
                                    </div>
                                    <div className="font-mono text-slate-600 mt-0.5">{preset.template}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    {config.template && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs font-semibold text-blue-900 mb-1">
                                📋 Preview do Nome
                            </p>
                            <p className="text-sm text-slate-700 font-mono">
                                {generatePreview(config.template)}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
