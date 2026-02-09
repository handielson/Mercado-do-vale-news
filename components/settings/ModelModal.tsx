import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Settings } from 'lucide-react';
import { Model, ModelInput } from '../../types/model';
import { Brand } from '../../types/brand';
import { Category } from '../../types/category';
import { modelService } from '../../services/models';
import { brandService } from '../../services/brands';
import { categoryService } from '../../services/categories';
import { customFieldsService, CustomField } from '../../services/custom-fields';
import { applyFieldFormat, getFieldDefinition } from '../../config/field-dictionary';
import { UNIQUE_FIELDS } from '../../config/product-fields';
import { CurrencyInput } from '../ui/CurrencyInput';

interface ModelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    model?: Model | null;
}

type TabType = 'basic' | 'template';

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

    // Data
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [customFields, setCustomFields] = useState<CustomField[]>([]);

    // UI State
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

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
        } else {
            setName('');
            setBrandId('');
            setActive(true);
            setCategoryId('');
            setDescription('');
            setTemplateValues({});
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
            const input: ModelInput = {
                name: name.trim(),
                brand_id: brandId,
                active,
                category_id: categoryId || undefined,
                description: description || undefined,
                template_values: Object.keys(templateValues).length > 0 ? templateValues : undefined
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
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Basic Tab */}
                    {activeTab === 'basic' && (
                        <>
                            {/* Brand Select */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Marca <span className="text-red-500">*</span>
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
                                    Nome do Modelo <span className="text-red-500">*</span>
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
                                    📋 <strong>Template de Modelo:</strong> Configure valores padrão que serão preenchidos automaticamente ao cadastrar produtos deste modelo.
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

                                {/* Price Fields */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Preço Custo
                                        </label>
                                        <CurrencyInput
                                            value={templateValues.price_cost || 0}
                                            onChange={(value) => handleTemplateValueChange('price_cost', value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Preço Varejo
                                        </label>
                                        <CurrencyInput
                                            value={templateValues.price_retail || 0}
                                            onChange={(value) => handleTemplateValueChange('price_retail', value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Preço Revenda
                                        </label>
                                        <CurrencyInput
                                            value={templateValues.price_reseller || 0}
                                            onChange={(value) => handleTemplateValueChange('price_reseller', value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Preço Atacado
                                        </label>
                                        <CurrencyInput
                                            value={templateValues.price_wholesale || 0}
                                            onChange={(value) => handleTemplateValueChange('price_wholesale', value)}
                                        />
                                    </div>
                                </div>

                                {/* Spec Fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    {customFields
                                        .filter(f => f.category === 'spec')
                                        .map((field) => (
                                            <div key={field.id}>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                                    {field.label}
                                                </label>
                                                <input
                                                    type={field.field_type === 'number' ? 'number' : 'text'}
                                                    value={templateValues[field.key] || ''}
                                                    onChange={(e) => handleTemplateValueChange(field.key, e.target.value)}
                                                    placeholder={field.placeholder || ''}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </>
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
