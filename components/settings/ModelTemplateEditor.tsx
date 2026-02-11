import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Model } from '../../types/model';
import { CategoryConfig } from '../../types/category';
import { categoryService } from '../../services/categories';
import { modelService } from '../../services/models';
import { CategorySelect } from '../products/CategorySelect';
import { UNIQUE_FIELDS } from '../../config/product-fields';
import { toast } from 'sonner';

interface ModelTemplateEditorProps {
    model: Model;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

/**
 * ModelTemplateEditor Component
 * Allows configuring default values for product fields when a model is selected
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Filters out unique fields (IMEI, Serial, Color, EAN, SKU)
 * - Dynamic field rendering based on category config
 * - Saves to model.template_values, model.category_id, model.description
 */
export const ModelTemplateEditor: React.FC<ModelTemplateEditorProps> = ({
    model,
    isOpen,
    onClose,
    onSave
}) => {
    const [categoryId, setCategoryId] = useState<string>(model.category_id || '');
    const [description, setDescription] = useState<string>(model.description || '');
    const [templateValues, setTemplateValues] = useState<Record<string, any>>(
        model.template_values || {}
    );
    const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Load category config when category changes
    useEffect(() => {
        const loadCategoryConfig = async () => {
            if (!categoryId) {
                setCategoryConfig(null);
                return;
            }
            try {
                const category = await categoryService.getById(categoryId);
                if (category?.config) {
                    setCategoryConfig(category.config);
                }
            } catch (error) {
                console.error('Error loading category config:', error);
            }
        };
        loadCategoryConfig();
    }, [categoryId]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await modelService.update(model.id, {
                ...model,
                category_id: categoryId || undefined,
                description: description || undefined,
                template_values: Object.keys(templateValues).length > 0 ? templateValues : undefined
            });
            toast.success('Template do modelo salvo com sucesso!');
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving model template:', error);
            toast.error('Erro ao salvar template do modelo');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFieldChange = (fieldKey: string, value: any) => {
        setTemplateValues(prev => ({
            ...prev,
            [fieldKey]: value
        }));
    };

    const getFieldsToRender = () => {
        if (!categoryConfig) return [];

        const fields: Array<{ key: string; label: string; type: string }> = [];

        // Add custom fields from category config
        if (categoryConfig.custom_fields) {
            categoryConfig.custom_fields.forEach(field => {
                // Skip unique fields
                if (UNIQUE_FIELDS.includes(field.key)) return;

                fields.push({
                    key: `specs.${field.key}`,
                    label: field.label,
                    type: field.type || 'text'
                });
            });
        }

        return fields;
    };

    if (!isOpen) return null;

    const fieldsToRender = getFieldsToRender();

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">
                                Configurar Template
                            </h2>
                            <p className="text-sm text-slate-600 mt-1">
                                Modelo: <span className="font-semibold">{model.name}</span>
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-600" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Info Box */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900">
                                <strong>💡 Como funciona:</strong> Configure valores padrão para este modelo.
                                Quando você selecionar este modelo ao cadastrar um produto, esses campos serão
                                preenchidos automaticamente.
                            </p>
                        </div>

                        {/* Category Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Categoria Padrão
                            </label>
                            <CategorySelect
                                value={categoryId}
                                onChange={setCategoryId}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Categoria que será selecionada automaticamente ao usar este modelo
                            </p>
                        </div>

                        {/* Description Template */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Descrição Padrão (SEO)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                placeholder="Descrição padrão que será usada para produtos deste modelo..."
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Descrição que será preenchida automaticamente (pode ser editada depois)
                            </p>
                        </div>

                        {/* Dynamic Fields */}
                        {categoryId && categoryConfig && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                                    Especificações Padrão
                                </h3>

                                {fieldsToRender.length === 0 ? (
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                                        <p className="text-sm text-slate-600">
                                            Nenhum campo configurável disponível para esta categoria.
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Configure campos personalizados nas configurações da categoria.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {fieldsToRender.map(field => (
                                            <div key={field.key}>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    {field.label}
                                                </label>
                                                <input
                                                    type={field.type}
                                                    value={templateValues[field.key] || ''}
                                                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder={`Ex: valor padrão para ${field.label}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <p className="text-xs text-yellow-800">
                                        <strong>⚠️ Campos únicos não aparecem aqui:</strong> IMEI, Serial, Cor, EAN e SKU
                                        devem ser preenchidos manualmente para cada produto.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!categoryId && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                                <p className="text-sm text-slate-600">
                                    Selecione uma categoria para configurar especificações padrão
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Salvar Template
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
