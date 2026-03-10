import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Settings, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Model, type ModelInput } from '../../types/model';
import { type Brand } from '../../types/brand';
import { type Category } from '../../types/category';
import { modelService } from '../../services/models';
import { brandService } from '../../services/brands';
import { categoryService } from '../../services/categories';
import { customFieldsService, type CustomField } from '../../services/custom-fields';
import { applyFieldFormat, getFieldDefinition } from '../../config/field-dictionary';
import { UNIQUE_FIELDS } from '../../config/product-fields';
import { CurrencyInput } from '../ui/CurrencyInput';
import { tableDataService, type TableOption } from '../../services/table-data';
import { ColorImageManager } from './ColorImageManager';

interface ModelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    model?: Model | null;
}

type TabType = 'basic' | 'template' | 'seo' | 'photos';

/**
 * TemplateFieldInput Component
 * Renders appropriate input based on field type
 */
interface TemplateFieldInputProps {
    field: CustomField;
    value: any;
    onChange: (value: any) => void;
}

const TemplateFieldInput: React.FC<TemplateFieldInputProps> = ({ field, value, onChange }) => {
    const [options, setOptions] = useState<TableOption[]>([]);
    const [loading, setLoading] = useState(false);


    useEffect(() => {
        if (field.field_type === 'table_relation' && field.table_config) {
            loadTableOptions();
        }
    }, [field]);

    const loadTableOptions = async () => {
        if (!field.table_config) return;

        setLoading(true);
        try {
            const data = await tableDataService.loadOptions(
                field.table_config.table_name,
                field.table_config.value_column,
                field.table_config.label_column,
                field.table_config.order_by
            );
            setOptions(data);
        } catch (error) {
            console.error(`Error loading options for ${field.key}: `, error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
                {field.label} <span className="text-slate-400 font-mono">({field.key})</span>
            </label>
            {field.field_type === 'table_relation' ? (
                // Dropdown from database table
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    <option value="">Selecione...</option>
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            ) : field.field_type === 'select' && field.options ? (
                // Dropdown from manual options
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Selecione...</option>
                    {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            ) : (
                // Text or number input
                <input
                    type={field.field_type === 'number' ? 'number' : 'text'}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            )}
        </div>
    );
};

/**
 * Model Modal Component with Template Support
 * Add/Edit model with brand association and template configuration
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Tab-based interface (Basic + Template)
 * - Template tab allows configuring default values
 * - Integrates with custom_fields for dynamic fields
 */
export const ModelModal: React.FC<ModelModalProps> = ({ isOpen, onClose, onSave, model }) => {
    const [activeTab, setActiveTab] = useState<TabType>('basic');

    // Basic fields
    const [name, setName] = useState('');
    const [brandId, setBrandId] = useState('');
    const [active, setActive] = useState(true);

    // Template fields
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [templateValues, setTemplateValues] = useState<Record<string, any>>({});
    const [eans, setEans] = useState<string[]>([]);

    // Data
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [categoryConfig, setCategoryConfig] = useState<any>(null);

    // UI State
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const eanInputRef = useRef<HTMLInputElement>(null);

    // AI Generation State
    const [aiPrompt, setAiPrompt] = useState('');
    const [promptCopied, setPromptCopied] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update AI Prompt automatically when model data changes
    useEffect(() => {
        const brandObj = brands.find(b => b.id === brandId);
        const categoryObj = categories.find(c => c.id === categoryId);

        const defaultPrompt = `Gere conteúdo SEO otimizado para o seguinte produto:

Nome: ${name || '[Nome do Modelo]'}
Marca: ${brandObj?.name || '[Marca]'}
Categoria: ${categoryObj?.name || '[Categoria]'}

Retorne APENAS um JSON válido no seguinte formato (sem markdown, sem explicações):
{
    "description": "descrição detalhada do modelo com mínimo 300 palavras, destacando benefícios, especificações técnicas e diferenciais",
    "slug": "url-amigavel-sem-acentos-minusculas",
    "meta_title": "título SEO com máximo 60 caracteres incluindo nome da loja",
    "meta_description": "meta descrição persuasiva com máximo 160 caracteres destacando benefícios",
    "keywords": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"]
}`;
        setAiPrompt(defaultPrompt);
    }, [name, brandId, categoryId, brands, categories]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleCopyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(aiPrompt);
            setPromptCopied(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setPromptCopied(false);
                timeoutRef.current = null;
            }, 2000);
        } catch (err) {
            console.error('Erro ao copiar prompt:', err);
        }
    };

    const handleApplyJson = () => {
        try {
            if (!jsonInput.trim()) {
                toast.error('Cole o JSON gerado pela IA primeiro.');
                return;
            }

            let jsonText = jsonInput.replace(/```json\n?/g, '').replace(/```/g, '').trim();
            const start = jsonText.indexOf('{');
            const end = jsonText.lastIndexOf('}') + 1;
            if (start !== -1 && end !== 0) {
                jsonText = jsonText.substring(start, end);
            }

            const data = JSON.parse(jsonText);

            if (data.description) setDescription(data.description);
            if (data.slug) handleTemplateValueChange('slug', data.slug);
            if (data.meta_title) handleTemplateValueChange('meta_title', data.meta_title);
            if (data.meta_description) handleTemplateValueChange('meta_description', data.meta_description);
            if (data.keywords && Array.isArray(data.keywords)) handleTemplateValueChange('keywords', data.keywords);

            setJsonInput('');
            toast.success('Campos SEO preenchidos com sucesso pela Inteligência Artificial!');
        } catch (err) {
            console.error('Erro no parser do JSON', err);
            toast.error('O formato JSON é inválido. Tente novamente ou cole apenas o código da resposta.');
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (model) {
            setName(model.name);
            setBrandId(model.brand_id);
            setActive(model.active);
            setCategoryId(model.category_id || '');
            setDescription(model.description || '');
            setTemplateValues(model.template_values || {});
            setEans(model.eans || []);
        } else {
            setName('');
            setBrandId('');
            setActive(true);
            setCategoryId('');
            setDescription('');
            setTemplateValues({});
            setEans([]);
        }
        setError('');
        setActiveTab('basic');
    }, [model, isOpen]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [brandsData, categoriesData, fieldsData] = await Promise.all([
                brandService.listActive(),
                categoryService.list(),
                customFieldsService.list()
            ]);
            setBrands(brandsData);
            setCategories(categoriesData);
            // Filter out unique fields
            setCustomFields(fieldsData.filter(f => !UNIQUE_FIELDS.includes(f.key)));
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Load category configuration when category changes
    useEffect(() => {
        const loadCategoryConfig = async () => {
            if (!categoryId) {
                setCategoryConfig(null);
                return;
            }
            try {
                const category = await categoryService.getById(categoryId);
                if (category) {
                    setCategoryConfig(category.config);
                }
            } catch (error) {
                console.error('Error loading category config:', error);
                setCategoryConfig(null);
            }
        };
        loadCategoryConfig();
    }, [categoryId]);

    const handleTemplateValueChange = (key: string, value: any) => {
        setTemplateValues(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSave = async () => {
        // Validation
        if (!name.trim()) {
            setError('Nome do modelo é obrigatório');
            setActiveTab('basic');
            return;
        }

        if (!brandId) {
            setError('Marca é obrigatória');
            setActiveTab('basic');
            return;
        }

        if (name.trim().length < 2) {
            setError('Nome deve ter pelo menos 2 caracteres');
            setActiveTab('basic');
            return;
        }

        setSaving(true);
        setError('');

        try {
            // Capture any pending EAN value in the input before saving
            const pendingEan = eanInputRef.current?.value.trim();
            const finalEans = pendingEan && !eans.includes(pendingEan)
                ? [...eans, pendingEan]
                : eans;
            if (pendingEan && eanInputRef.current) {
                eanInputRef.current.value = '';
            }

            const input: ModelInput = {
                name: name.trim(),
                brand_id: brandId,
                active,
                category_id: categoryId || undefined,
                description: description || undefined,
                template_values: Object.keys(templateValues).length > 0 ? templateValues : undefined,
                eans: finalEans.length > 0 ? finalEans : undefined
            };

            if (model) {
                await modelService.update(model.id, input);
            } else {
                await modelService.create(input);
            }

            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar modelo');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8 animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">
                        {model ? 'Editar Modelo' : 'Novo Modelo'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('basic')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'basic'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Settings size={18} />
                            Básico
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('template')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'template'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <FileText size={18} />
                            Template
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('seo')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'seo'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Search size={18} />
                            SEO
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('photos')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'photos'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                        disabled={!model}
                        title={!model ? 'Salve o modelo primeiro para gerenciar fotos' : ''}
                    >
                        <div className="flex items-center justify-center gap-2">
                            📸 Fotos por Cor
                        </div>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Basic Tab */}
                    {activeTab === 'basic' && (
                        <>
                            {/* Brand Select */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Marca <span className="text-red-500">*</span> <span className="text-slate-400 font-mono text-xs">(models.brand_id)</span>
                                </label>
                                {loading ? (
                                    <div className="text-sm text-slate-500">Carregando marcas...</div>
                                ) : (
                                    <select
                                        value={brandId}
                                        onChange={(e) => setBrandId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Selecione uma marca</option>
                                        {brands.map((brand) => (
                                            <option key={brand.id} value={brand.id}>
                                                {brand.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Name Input */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Nome do Modelo <span className="text-red-500">*</span> <span className="text-slate-400 font-mono text-xs">(models.name)</span>
                                </label>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        const cursorPosition = e.target.selectionStart || 0;
                                        const rawValue = e.target.value;
                                        const fieldDef = getFieldDefinition('name');
                                        const format = fieldDef?.format || 'capitalize';
                                        const formatted = applyFieldFormat(rawValue, format);
                                        setName(formatted);
                                        setTimeout(() => {
                                            if (inputRef.current) {
                                                inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
                                            }
                                        }, 0);
                                    }}
                                    placeholder="Ex: iPhone 14 Pro Max"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>

                            {/* EAN Codes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Códigos EAN/GTIN (Referência) <span className="text-slate-400 font-mono text-xs">(models.eans)</span>
                                </label>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            ref={eanInputRef}
                                            type="text"
                                            placeholder="Digite um EAN e pressione Enter"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const input = e.currentTarget;
                                                    const value = input.value.trim();
                                                    if (value && !eans.includes(value)) {
                                                        setEans([...eans, value]);
                                                        input.value = '';
                                                    }
                                                }
                                            }}
                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const value = eanInputRef.current?.value.trim();
                                                if (value && !eans.includes(value)) {
                                                    setEans([...eans, value]);
                                                    if (eanInputRef.current) eanInputRef.current.value = '';
                                                }
                                            }}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
                                            title="Adicionar EAN"
                                        >+</button>
                                    </div>
                                    {eans.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {eans.map((ean, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                                                >
                                                    {ean}
                                                    <button
                                                        type="button"
                                                        onClick={() => setEans(eans.filter((_, i) => i !== index))}
                                                        className="hover:text-blue-900"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-500">
                                        📷 EANs de referência para identificação rápida via scanner. Cada produto terá seu próprio EAN único.
                                    </p>
                                </div>
                            </div>

                            {/* Active Checkbox */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="model-active"
                                    checked={active}
                                    onChange={(e) => setActive(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="model-active" className="text-sm text-slate-700 cursor-pointer">
                                    Modelo Ativo (visível no cadastro de produtos)
                                </label>
                            </div>
                        </>
                    )}

                    {/* Template Tab */}
                    {activeTab === 'template' && (
                        <>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p className="text-sm text-blue-900">
                                    📋 <strong>Template de Modelo</strong> <span className="text-slate-500 font-mono text-xs">(models.template_values)</span>: Configure valores padrão que serão preenchidos automaticamente ao cadastrar produtos deste modelo.
                                </p>
                                <p className="text-xs text-blue-700 mt-1">
                                    Campos únicos (Cor, IMEI, Serial, EAN, SKU) não são preenchidos automaticamente.
                                </p>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Categoria Padrão
                                </label>
                                <select
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Nenhuma</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Descrição Padrão
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Ex: Smartphone Apple com tela de 6.1 polegadas..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Dynamic Fields */}
                            <div className="border-t border-slate-200 pt-4">
                                <h4 className="font-medium text-slate-800 mb-3">Valores Padrão</h4>

                                {/* Category Info */}
                                {categoryId && categoryConfig && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                        <p className="text-xs text-blue-800">
                                            📋 Mostrando apenas campos configurados para a categoria selecionada
                                        </p>
                                    </div>
                                )}

                                {/* Spec Fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    {customFields
                                        .filter(f => f.category === 'spec')
                                        .filter(field => {
                                            // If no category selected, show all fields
                                            if (!categoryId || !categoryConfig) {
                                                return true;
                                            }

                                            // Check if field is configured in category
                                            const fieldKey = field.key;
                                            const configValue = categoryConfig[fieldKey];

                                            // If field is explicitly set to 'off', hide it
                                            if (configValue === 'off') {
                                                return false;
                                            }

                                            // Show field if it's required, optional, or not configured
                                            return true;
                                        })
                                        .map((field) => (
                                            <TemplateFieldInput
                                                key={field.id}
                                                field={field}
                                                value={templateValues[field.key]}
                                                onChange={(value) => handleTemplateValueChange(field.key, value)}
                                            />
                                        ))}
                                </div>

                                {/* No fields message */}
                                {categoryId && categoryConfig && customFields
                                    .filter(f => f.category === 'spec')
                                    .filter(field => {
                                        const configValue = categoryConfig[field.key];
                                        return configValue !== 'off';
                                    }).length === 0 && (
                                        <div className="text-center py-8 text-slate-500">
                                            <p className="text-sm">Nenhum campo de especificação configurado para esta categoria</p>
                                        </div>
                                    )}
                            </div>

                            {/* Logistics Fields */}
                            <div className="border-t border-slate-200 pt-4 mt-4">
                                <h4 className="font-medium text-slate-800 mb-3">Logística Padrão</h4>

                                {/* Info box with postal limits */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm mb-4">
                                    <p className="font-medium text-blue-900 mb-1">📦 Limites dos Correios</p>
                                    <p className="text-blue-700 text-xs">
                                        Peso: até 30kg • Dimensões: 16-105cm (C), até 105cm (L+A), até 200cm (C+L+A)
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Peso (kg)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={templateValues['weight_kg'] || ''}
                                            onChange={(e) => handleTemplateValueChange('weight_kg', e.target.value ? parseFloat(e.target.value) : undefined)}
                                            placeholder="0.000"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Ex: 0.250 (250g)
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Largura (cm)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={templateValues['dimensions.width_cm'] || ''}
                                            onChange={(e) => handleTemplateValueChange('dimensions.width_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                                            placeholder="0.0"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Altura (cm)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={templateValues['dimensions.height_cm'] || ''}
                                            onChange={(e) => handleTemplateValueChange('dimensions.height_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                                            placeholder="0.0"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Profundidade (cm)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={templateValues['dimensions.depth_cm'] || ''}
                                            onChange={(e) => handleTemplateValueChange('dimensions.depth_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                                            placeholder="0.0"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* SEO Tab */}
                    {activeTab === 'seo' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p className="text-sm text-blue-900">
                                    🔍 <strong>SEO (Otimização de Buscas)</strong>: Configure as tags padrão para todos os produtos deste modelo.
                                </p>
                            </div>

                            {/* Seção de Ajuda com Links para IAs */}
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
                                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                    <ExternalLink size={18} />
                                    💡 Gerar Conteúdo SEO com IA
                                </h4>
                                <p className="text-sm text-blue-700 mb-3">
                                    Use uma das ferramentas abaixo para gerar conteúdo SEO otimizado. Copie o prompt e cole na IA escolhida.
                                </p>

                                {/* Campo de Prompt Editável */}
                                <div className="mb-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-medium text-blue-900">
                                            Prompt para IA (editável)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleCopyPrompt}
                                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                                        >
                                            {promptCopied ? '✓ Copiado!' : '📋 Copiar Prompt'}
                                        </button>
                                    </div>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        rows={12}
                                        className="w-full px-3 py-2 text-xs font-mono border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                                        placeholder="Edite o prompt conforme necessário..."
                                    />
                                    <p className="text-xs text-blue-600 mt-1">
                                        💡 Dica: O prompt é atualizado automaticamente quando você preenche Nome, Marca e Categoria.
                                    </p>
                                </div>

                                {/* Botões de Links para IAs */}
                                <div className="flex flex-wrap gap-2">
                                    <a
                                        href="https://gemini.google.com/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                                    >
                                        <ExternalLink size={16} /> Abrir Gemini
                                    </a>
                                    <a
                                        href="https://www.perplexity.ai/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm"
                                    >
                                        <ExternalLink size={16} /> Abrir Perplexity
                                    </a>
                                    <a
                                        href="https://x.com/i/grok"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm"
                                    >
                                        <ExternalLink size={16} /> Abrir Grok
                                    </a>
                                    <a
                                        href="https://chat.openai.com/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                                    >
                                        <ExternalLink size={16} /> Abrir ChatGPT
                                    </a>
                                </div>

                                {/* Campo de Cola do JSON */}
                                <div className="mt-4 pt-4 border-t border-blue-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-semibold text-blue-900">
                                            Colar Resposta da IA (JSON)
                                        </label>
                                    </div>
                                    <div className="flex flex-col gap-2 relative">
                                        <textarea
                                            value={jsonInput}
                                            onChange={(e) => setJsonInput(e.target.value)}
                                            rows={4}
                                            className="w-full px-3 py-2 text-xs font-mono border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                                            placeholder='Ex: { "description": "...", "slug": "...", "meta_title": "..." }'
                                        />
                                        <button
                                            type="button"
                                            onClick={handleApplyJson}
                                            className="self-end px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors shadow-md"
                                        >
                                            Preencher Campos Automaticamente ✨
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    URL Amigável Padrão (Slug)
                                </label>
                                <input
                                    type="text"
                                    value={templateValues['slug'] || ''}
                                    onChange={(e) => handleTemplateValueChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ex: iphone-14-pro"
                                />
                                <p className="text-xs text-slate-500 mt-1">Os produtos herdarão esse slug. Dica: deixe vazio para o Auto-Gerador criar único por variação.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Título SEO
                                </label>
                                <input
                                    type="text"
                                    value={templateValues['meta_title'] || ''}
                                    onChange={(e) => handleTemplateValueChange('meta_title', e.target.value)}
                                    maxLength={60}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Máx 60 caracteres"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Meta Descrição
                                </label>
                                <textarea
                                    value={templateValues['meta_description'] || ''}
                                    onChange={(e) => handleTemplateValueChange('meta_description', e.target.value)}
                                    maxLength={160}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Descrição curta (Máx 160 caracteres)"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Palavras-chave (Keywords)
                                </label>
                                <input
                                    type="text"
                                    value={templateValues['keywords'] ? templateValues['keywords'].join(', ') : ''}
                                    onChange={(e) => {
                                        const values = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                                        handleTemplateValueChange('keywords', values);
                                    }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="palavra1, palavra2, smartphone..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Photos Tab */}
                    {activeTab === 'photos' && model && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm text-blue-900 font-medium">
                                    📸 <strong>Fotos por Cor</strong>
                                </p>
                                <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-mono">
                                    {model.name}
                                </span>
                            </div>
                            <p className="text-xs text-blue-700 mb-2">
                                • Estas fotos serão usadas automaticamente em todos os produtos novos<br />
                                • Produtos usados podem ter fotos customizadas
                            </p>
                            <div className="bg-green-50 border border-green-300 rounded p-2 mt-2">
                                <p className="text-xs text-green-800">
                                    ✅ <strong>As fotos são salvas automaticamente!</strong> Você pode cadastrar várias cores sem fechar este modal. Basta selecionar outra cor no dropdown e fazer upload.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'photos' && model && (
                        <ColorImageManager modelId={model.id} />
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
