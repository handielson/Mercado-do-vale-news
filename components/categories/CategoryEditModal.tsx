import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Category, CategoryConfig, CategoryInput, FieldRequirement, CustomField } from '../../types/category';
import { CustomFieldsEditor } from './CustomFieldsEditor';

interface CategoryEditModalProps {
    category: Category | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string | null, data: CategoryInput) => Promise<void>;
}

/**
 * CategoryEditModal Component
 * Modal for creating new or editing existing category configurations
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Supports both create (category = null) and edit modes
 * - Traffic Light configuration for all fields
 * - Custom fields support
 */
export const CategoryEditModal: React.FC<CategoryEditModalProps> = ({
    category,
    isOpen,
    onClose,
    onSave
}) => {
    const [name, setName] = useState('');
    const [config, setConfig] = useState<CategoryConfig>({
        imei1: 'optional',
        imei2: 'optional',
        serial: 'optional',
        color: 'optional',
        storage: 'optional',
        ram: 'optional',
        version: 'optional',
        battery_health: 'optional',
        custom_fields: []
    });
    const [isSaving, setIsSaving] = useState(false);

    // Load category data when modal opens or reset for new category
    useEffect(() => {
        if (category) {
            setName(category.name);
            // Preserve ALL config fields, including optional ones
            setConfig({
                imei1: category.config.imei1 || 'optional',
                imei2: category.config.imei2 || 'optional',
                serial: category.config.serial || 'optional',
                color: category.config.color || 'optional',
                storage: category.config.storage || 'optional',
                ram: category.config.ram || 'optional',
                version: category.config.version || 'optional',
                battery_health: category.config.battery_health || 'optional',
                custom_fields: category.config.custom_fields || [],
                ean_autofill_config: category.config.ean_autofill_config || { enabled: true, exclude_fields: [] },
                auto_name_enabled: category.config.auto_name_enabled,
                auto_name_template: category.config.auto_name_template,
                auto_name_fields: category.config.auto_name_fields,
                auto_name_separator: category.config.auto_name_separator
            });
        } else {
            // Reset for new category
            setName('');
            setConfig({
                imei1: 'optional',
                imei2: 'optional',
                serial: 'optional',
                color: 'optional',
                storage: 'optional',
                ram: 'optional',
                version: 'optional',
                battery_health: 'optional',
                custom_fields: [],
                ean_autofill_config: { enabled: true, exclude_fields: [] }
            });
        }
    }, [category, isOpen]);

    const updateFieldConfig = (field: keyof CategoryConfig, value: FieldRequirement) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) return;

        try {
            setIsSaving(true);
            console.log('💾 [CategoryEditModal] Saving category:', name.trim());
            console.log('📋 [CategoryEditModal] Config being saved:', config);
            console.log('🔢 [CategoryEditModal] Custom fields count:', config.custom_fields?.length || 0);
            console.log('📝 [CategoryEditModal] Custom fields:', config.custom_fields?.map(f => f.name));

            await onSave(category?.id || null, {
                name: name.trim(),
                config
            });
            onClose();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Erro ao salvar categoria');
        } finally {
            setIsSaving(false);
        }
    };

    const fieldLabels: Record<keyof Omit<CategoryConfig, 'custom_fields'>, string> = {
        imei1: 'IMEI 1',
        imei2: 'IMEI 2',
        serial: 'Serial',
        color: 'Cor',
        storage: 'Armazenamento',
        ram: 'RAM',
        version: 'Versão',
        battery_health: 'Saúde Bateria'
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-900">
                        {category ? `Editar Categoria: ${category.name}` : 'Nova Categoria'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                        disabled={isSaving}
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Category Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Nome da Categoria *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    {/* Field Requirements Configuration Table */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Configuração de Campos
                        </label>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-slate-700">Campo</th>
                                        <th className="px-4 py-3 text-center font-medium text-slate-700">🔴 Oculto</th>
                                        <th className="px-4 py-3 text-center font-medium text-slate-700">🟡 Opcional</th>
                                        <th className="px-4 py-3 text-center font-medium text-slate-700">🟢 Obrigatório</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {(Object.keys(fieldLabels) as Array<keyof CategoryConfig>).map((field) => (
                                        <tr key={field} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                {fieldLabels[field]}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="radio"
                                                    name={field}
                                                    checked={config[field] === 'off'}
                                                    onChange={() => updateFieldConfig(field, 'off')}
                                                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="radio"
                                                    name={field}
                                                    checked={config[field] === 'optional'}
                                                    onChange={() => updateFieldConfig(field, 'optional')}
                                                    className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="radio"
                                                    name={field}
                                                    checked={config[field] === 'required'}
                                                    onChange={() => updateFieldConfig(field, 'required')}
                                                    className="w-4 h-4 text-green-600 focus:ring-green-500"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Configure quais campos serão exibidos e obrigatórios para produtos desta categoria
                        </p>
                    </div>

                    {/* Custom Fields Section */}
                    <div className="pt-6 border-t border-slate-200">
                        <CustomFieldsEditor
                            fields={config.custom_fields || []}
                            onChange={(fields) => setConfig({ ...config, custom_fields: fields })}
                        />
                    </div>

                    {/* EAN Auto-Fill Configuration */}
                    <div className="pt-6 border-t border-slate-200">
                        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            📦 Preenchimento Automático por EAN
                        </h4>

                        {/* Toggle: Ativar auto-fill */}
                        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <input
                                type="checkbox"
                                checked={config.ean_autofill_config?.enabled ?? true}
                                onChange={(e) => setConfig({
                                    ...config,
                                    ean_autofill_config: {
                                        enabled: e.target.checked,
                                        exclude_fields: config.ean_autofill_config?.exclude_fields || []
                                    }
                                })}
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

                        {(config.ean_autofill_config?.enabled ?? true) && (
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
                                        {[
                                            { key: 'category_id', label: 'Categoria' },
                                            { key: 'brand', label: 'Marca' },
                                            { key: 'model', label: 'Modelo' },
                                            { key: 'name', label: 'Nome do Produto' },
                                            { key: 'sku', label: 'SKU' },
                                            { key: 'description', label: 'Descrição' }
                                        ].map(field => (
                                            <label
                                                key={field.key}
                                                className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={config.ean_autofill_config?.exclude_fields?.includes(field.key) ?? false}
                                                    onChange={(e) => {
                                                        const currentExcluded = config.ean_autofill_config?.exclude_fields || [];
                                                        const newExcluded = e.target.checked
                                                            ? [...currentExcluded, field.key]
                                                            : currentExcluded.filter(f => f !== field.key);

                                                        setConfig({
                                                            ...config,
                                                            ean_autofill_config: {
                                                                enabled: config.ean_autofill_config?.enabled ?? true,
                                                                exclude_fields: newExcluded
                                                            }
                                                        });
                                                    }}
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
                                        {[
                                            { key: 'specs.imei1', label: 'IMEI 1' },
                                            { key: 'specs.imei2', label: 'IMEI 2' },
                                            { key: 'specs.serial', label: 'Serial' },
                                            { key: 'specs.color', label: 'Cor' },
                                            { key: 'specs.storage', label: 'Armazenamento' },
                                            { key: 'specs.ram', label: 'RAM' },
                                            { key: 'specs.version', label: 'Versão' },
                                            { key: 'specs.battery_health', label: 'Saúde da Bateria' }
                                        ].map(field => (
                                            <label
                                                key={field.key}
                                                className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={config.ean_autofill_config?.exclude_fields?.includes(field.key) ?? false}
                                                    onChange={(e) => {
                                                        const currentExcluded = config.ean_autofill_config?.exclude_fields || [];
                                                        const newExcluded = e.target.checked
                                                            ? [...currentExcluded, field.key]
                                                            : currentExcluded.filter(f => f !== field.key);

                                                        setConfig({
                                                            ...config,
                                                            ean_autofill_config: {
                                                                enabled: config.ean_autofill_config?.enabled ?? true,
                                                                exclude_fields: newExcluded
                                                            }
                                                        });
                                                    }}
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
                                        {[
                                            { key: 'price_cost', label: 'Preço de Custo' },
                                            { key: 'price_retail', label: 'Preço Varejo' },
                                            { key: 'price_reseller', label: 'Preço Revenda' },
                                            { key: 'price_wholesale', label: 'Preço Atacado' }
                                        ].map(field => (
                                            <label
                                                key={field.key}
                                                className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={config.ean_autofill_config?.exclude_fields?.includes(field.key) ?? false}
                                                    onChange={(e) => {
                                                        const currentExcluded = config.ean_autofill_config?.exclude_fields || [];
                                                        const newExcluded = e.target.checked
                                                            ? [...currentExcluded, field.key]
                                                            : currentExcluded.filter(f => f !== field.key);

                                                        setConfig({
                                                            ...config,
                                                            ean_autofill_config: {
                                                                enabled: config.ean_autofill_config?.enabled ?? true,
                                                                exclude_fields: newExcluded
                                                            }
                                                        });
                                                    }}
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
                                        {[
                                            { key: 'ncm', label: 'NCM' },
                                            { key: 'cest', label: 'CEST' },
                                            { key: 'origin', label: 'Origem' }
                                        ].map(field => (
                                            <label
                                                key={field.key}
                                                className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={config.ean_autofill_config?.exclude_fields?.includes(field.key) ?? false}
                                                    onChange={(e) => {
                                                        const currentExcluded = config.ean_autofill_config?.exclude_fields || [];
                                                        const newExcluded = e.target.checked
                                                            ? [...currentExcluded, field.key]
                                                            : currentExcluded.filter(f => f !== field.key);

                                                        setConfig({
                                                            ...config,
                                                            ean_autofill_config: {
                                                                enabled: config.ean_autofill_config?.enabled ?? true,
                                                                exclude_fields: newExcluded
                                                            }
                                                        });
                                                    }}
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
                                        {[
                                            { key: 'weight_kg', label: 'Peso (kg)' },
                                            { key: 'dimensions', label: 'Dimensões' },
                                            { key: 'stock_quantity', label: 'Quantidade em Estoque' }
                                        ].map(field => (
                                            <label
                                                key={field.key}
                                                className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={config.ean_autofill_config?.exclude_fields?.includes(field.key) ?? false}
                                                    onChange={(e) => {
                                                        const currentExcluded = config.ean_autofill_config?.exclude_fields || [];
                                                        const newExcluded = e.target.checked
                                                            ? [...currentExcluded, field.key]
                                                            : currentExcluded.filter(f => f !== field.key);

                                                        setConfig({
                                                            ...config,
                                                            ean_autofill_config: {
                                                                enabled: config.ean_autofill_config?.enabled ?? true,
                                                                exclude_fields: newExcluded
                                                            }
                                                        });
                                                    }}
                                                    className="w-3 h-3 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                                                />
                                                <span className="text-slate-700">{field.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Fields (Dynamic) */}
                                {config.custom_fields && config.custom_fields.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Campos Personalizados</p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {config.custom_fields.map(field => (
                                                <label
                                                    key={field.key}
                                                    className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={config.ean_autofill_config?.exclude_fields?.includes(`specs.${field.key}`) ?? false}
                                                        onChange={(e) => {
                                                            const currentExcluded = config.ean_autofill_config?.exclude_fields || [];
                                                            const fieldKey = `specs.${field.key}`;
                                                            const newExcluded = e.target.checked
                                                                ? [...currentExcluded, fieldKey]
                                                                : currentExcluded.filter(f => f !== fieldKey);

                                                            setConfig({
                                                                ...config,
                                                                ean_autofill_config: {
                                                                    enabled: config.ean_autofill_config?.enabled ?? true,
                                                                    exclude_fields: newExcluded
                                                                }
                                                            });
                                                        }}
                                                        className="w-3 h-3 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                                                    />
                                                    <span className="text-slate-700">{field.name}</span>
                                                </label>
                                            ))}
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

                    {/* Auto-naming Configuration */}
                    <div className="pt-6 border-t border-slate-200">
                        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            🏷️ Geração Automática de Nome
                        </h4>

                        {/* Toggle: Ativar geração automática */}
                        <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
                            <input
                                type="checkbox"
                                checked={config.auto_name_enabled ?? false}
                                onChange={(e) => setConfig({
                                    ...config,
                                    auto_name_enabled: e.target.checked,
                                    auto_name_separator: config.auto_name_separator || ' '
                                })}
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

                        {config.auto_name_enabled && (
                            <div className="space-y-4">
                                {/* Template Input */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Template do Nome
                                    </label>
                                    <input
                                        type="text"
                                        value={config.auto_name_template || ''}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            auto_name_template: e.target.value
                                        })}
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
                                            {[
                                                '{marca}', '{modelo}', '{sku}'
                                            ].map((placeholder) => (
                                                <button
                                                    key={placeholder}
                                                    type="button"
                                                    onClick={() => {
                                                        const current = config.auto_name_template || '';
                                                        setConfig({
                                                            ...config,
                                                            auto_name_template: current + placeholder
                                                        });
                                                    }}
                                                    className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-mono rounded hover:bg-blue-100 transition-colors"
                                                >
                                                    {placeholder}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Row 2: Specs */}
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                '{ram}', '{armazenamento}', '{cor}', '{versao}', '{bateria}'
                                            ].map((placeholder) => (
                                                <button
                                                    key={placeholder}
                                                    type="button"
                                                    onClick={() => {
                                                        const current = config.auto_name_template || '';
                                                        setConfig({
                                                            ...config,
                                                            auto_name_template: current + placeholder
                                                        });
                                                    }}
                                                    className="px-2 py-1 bg-green-50 text-green-700 text-xs font-mono rounded hover:bg-green-100 transition-colors"
                                                >
                                                    {placeholder}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Row 3: Identifiers & Others */}
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                '{serial}', '{imei1}', '{imei2}', '{ncm}', '{cest}', '{peso}'
                                            ].map((placeholder) => (
                                                <button
                                                    key={placeholder}
                                                    type="button"
                                                    onClick={() => {
                                                        const current = config.auto_name_template || '';
                                                        setConfig({
                                                            ...config,
                                                            auto_name_template: current + placeholder
                                                        });
                                                    }}
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
                                        {[
                                            { name: 'Simples', template: '{modelo} {ram} {armazenamento} {cor}', example: 'iPhone 13 4GB 128GB Azul' },
                                            { name: 'Com vírgula e barra', template: '{modelo}, {ram}/{armazenamento} - {versao}', example: 'Redmi Note 14, 6GB/256GB - Global' },
                                            { name: 'Completo', template: '{marca} {modelo} ({ram}/{armazenamento}) - {cor}', example: 'Apple iPhone 13 (4GB/128GB) - Azul' }
                                        ].map((preset) => (
                                            <button
                                                key={preset.name}
                                                type="button"
                                                onClick={() => setConfig({
                                                    ...config,
                                                    auto_name_template: preset.template
                                                })}
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
                                {config.auto_name_template && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-xs font-semibold text-blue-900 mb-1">
                                            📋 Preview do Nome
                                        </p>
                                        <p className="text-sm text-slate-700 font-mono">
                                            {(() => {
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
                                                // Simple inline template generation for preview
                                                let preview = config.auto_name_template;
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
                                            })()}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !name.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Salvando...' : (category ? 'Salvar Alterações' : 'Criar Categoria')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
