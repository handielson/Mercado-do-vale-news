import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Category, CategoryConfig, CategoryInput, FieldRequirement, CustomField } from '../../types/category';
import { categoryService } from '../../services/categories';
import { BasicInfoSection } from './sections/BasicInfoSection';
import { UniqueFieldsSection } from './sections/UniqueFieldsSection';
import { FieldConfigSection } from './sections/FieldConfigSection';
import { CustomFieldsSection } from './sections/CustomFieldsSection';

interface CategoryEditPageProps {
    categoryId?: string; // undefined = criar nova
}

/**
 * CategoryEditPage Component
 * Main container for category creation/editing
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Modular page-based architecture
 * - Orchestrates section components
 * - Centralized state management
 * - Each section < 250 lines
 */
export const CategoryEditPage: React.FC<CategoryEditPageProps> = ({
    categoryId
}) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(!!categoryId);
    const [isSaving, setIsSaving] = useState(false);
    const [name, setName] = useState('');
    const [warrantyDays, setWarrantyDays] = useState(90);
    const [config, setConfig] = useState<CategoryConfig>({
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
    const [uniqueFields, setUniqueFields] = useState<string[]>([]);

    // Load category data if editing
    useEffect(() => {
        if (categoryId) {
            loadCategory(categoryId);
        }
    }, [categoryId]);

    const loadCategory = async (id: string) => {
        try {
            setIsLoading(true);
            const category = await categoryService.getById(id);
            if (category) {
                setName(category.name);
                setWarrantyDays(category.warranty_days || 90);

                console.log('[CategoryEditPage] Loading category:', category.name);
                console.log('[CategoryEditPage] Config:', category.config);

                // Use spread operator to load ALL fields from database (Database-First Architecture)
                setConfig({
                    ...category.config,
                    // Ensure required nested objects exist
                    custom_fields: category.config.custom_fields || [],
                    ean_autofill_config: category.config.ean_autofill_config || { enabled: true, exclude_fields: [] }
                });

                // Load unique fields if they exist
                setUniqueFields(category.config.unique_fields || []);
            }
        } catch (error) {
            console.error('Error loading category:', error);
            alert('Erro ao carregar categoria');
        } finally {
            setIsLoading(false);
        }
    };

    // Handlers for section updates
    const updateFieldConfig = (field: keyof CategoryConfig, value: FieldRequirement) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const updateCustomFields = (fields: CustomField[]) => {
        console.log('🔄 [CategoryEditPage] Updating custom fields:', fields);
        setConfig(prev => ({ ...prev, custom_fields: fields }));
    };

    const updateEANExcludedFields = (fields: string[]) => {
        setConfig(prev => ({
            ...prev,
            ean_autofill_config: {
                ...prev.ean_autofill_config,
                exclude_fields: fields
            }
        }));
    };

    const updateAutoNamingFields = (fields: string[]) => {
        setConfig(prev => ({
            ...prev,
            auto_name_fields: fields
        }));
    };

    const updateUniqueFields = (fields: string[]) => {
        setUniqueFields(fields);
        setConfig(prev => ({ ...prev, unique_fields: fields }));
    };


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            alert('Por favor, preencha o nome da categoria');
            return;
        }

        try {
            setIsSaving(true);
            console.log('💾 [CategoryEditPage] Saving category:', name.trim());
            console.log('📋 [CategoryEditPage] Config:', config);

            const categoryData: CategoryInput = {
                name: name.trim(),
                config,
                warranty_days: warrantyDays
            };

            if (categoryId) {
                // Update existing
                await categoryService.update(categoryId, categoryData);
            } else {
                // Create new
                await categoryService.create(categoryData);
            }

            // Redirect back to list
            navigate('/admin/settings/categories');
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Erro ao salvar categoria');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        navigate('/admin/settings/categories');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Carregando categoria...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8">
            <div className="max-w-5xl mx-auto px-6">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={handleCancel}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para Categorias
                    </button>

                    <h1 className="text-3xl font-bold text-slate-900">
                        {categoryId ? 'Editar Categoria' : 'Nova Categoria'}
                    </h1>
                    <p className="text-slate-600 mt-1">
                        Configure os campos e comportamentos para esta categoria
                    </p>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Section 1: Basic Info */}
                    <BasicInfoSection
                        name={name}
                        onChange={setName}
                        warrantyDays={warrantyDays}
                        onWarrantyDaysChange={setWarrantyDays}
                        isEditing={!!categoryId}
                    />

                    {/* Section 2: Unique Fields */}
                    <UniqueFieldsSection
                        config={config}
                        onChange={updateFieldConfig}
                    />

                    {/* Section 3: Field Configuration */}
                    <FieldConfigSection
                        config={config}
                        onChange={updateFieldConfig}
                        eanExcludedFields={config.ean_autofill_config?.exclude_fields || []}
                        onEANExclusionChange={updateEANExcludedFields}
                        autoNamingFields={config.auto_name_fields || []}
                        onAutoNamingFieldsChange={updateAutoNamingFields}
                    />

                    {/* Section 4: Custom Fields */}
                    <CustomFieldsSection
                        fields={config.custom_fields || []}
                        onChange={updateCustomFields}
                    />

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 sticky bottom-0 bg-slate-50 py-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !name.trim()}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Salvando...' : (categoryId ? 'Salvar Alterações' : 'Criar Categoria')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
