import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, BookMarked, ChevronDown } from 'lucide-react';
import { Category, CategoryConfig, CategoryInput, FieldRequirement, CustomField } from '../../types/category';
import { categoryService } from '../../services/categories';
import { BasicInfoSection } from './sections/BasicInfoSection';
import { UniqueFieldsSection } from './sections/UniqueFieldsSection';
import { FieldConfigSection } from './sections/FieldConfigSection';
import { CustomFieldsSection } from './sections/CustomFieldsSection';
import { toast } from 'react-hot-toast';
import { vpsApiService, FieldPreset } from '../../services/vpsApiService';

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
    const [parentId, setParentId] = useState<string | null>(null);
    const [availableParents, setAvailableParents] = useState<Category[]>([]);
    const [warrantyDays, setWarrantyDays] = useState(90);
    const [productionDays, setProductionDays] = useState(0);
    const [extendedWarrantyEnabled, setExtendedWarrantyEnabled] = useState(false);
    const [marginWholesale, setMarginWholesale] = useState<number | undefined>();
    const [marginReseller, setMarginReseller] = useState<number | undefined>();
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
    const [presets, setPresets] = useState<FieldPreset[]>([]);
    const [presetMergeMode, setPresetMergeMode] = useState<'replace' | 'merge'>('replace');
    const [presetOpen, setPresetOpen] = useState(false);

    // Load category data if editing and load available parents
    useEffect(() => {
        const initData = async () => {
            try {
                // Fetch all categories to populate the "Parent Category" dropdown
                const allCategories = await categoryService.list();
                setAvailableParents(allCategories.filter(c => c.id !== categoryId && c.parent_id === null));

                // Load field presets from VPS
                const presetsData = await vpsApiService.getFieldPresets();
                setPresets(presetsData ?? []);

                if (categoryId) {
                    await loadCategory(categoryId);
                }
            } catch (error) {
                console.error('Error initializing CategoryEditPage:', error);
            }
        };

        initData();
    }, [categoryId]);

    const loadCategory = async (id: string) => {
        try {
            setIsLoading(true);
            const category = await categoryService.getById(id);
            if (category) {
                setName(category.name);
                setParentId(category.parent_id || null);
                setWarrantyDays(category.warranty_days || 90);
                setProductionDays(category.production_days || 0);
                setExtendedWarrantyEnabled(category.extended_warranty_enabled ?? false);
                setMarginWholesale(category.margin_wholesale);
                setMarginReseller(category.margin_reseller);

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
            toast.error('Por favor, preencha o nome da categoria');
            return;
        }

        try {
            setIsSaving(true);
            console.log('💾 [CategoryEditPage] Saving category:', name.trim());
            console.log('📋 [CategoryEditPage] Config:', config);

            const categoryData: CategoryInput = {
                name: name.trim(),
                parent_id: parentId,
                config,
                warranty_days: warrantyDays,
                production_days: productionDays,
                extended_warranty_enabled: extendedWarrantyEnabled,
                margin_wholesale: marginWholesale,
                margin_reseller: marginReseller
            };

            if (categoryId) {
                // Update existing
                await categoryService.update(categoryId, categoryData);
                toast.success('Categoria atualizada com sucesso!');
            } else {
                // Create new
                await categoryService.create(categoryData);
                toast.success('Categoria criada com sucesso!');
            }

            // Redirect back to list
            navigate('/admin/settings/categories');
        } catch (error: any) {
            console.error('Error saving category:', error);
            toast.error(error.message || 'Erro ao salvar categoria');
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
                        parentId={parentId}
                        onParentIdChange={setParentId}
                        availableParents={availableParents}
                        warrantyDays={warrantyDays}
                        onWarrantyDaysChange={setWarrantyDays}
                        productionDays={productionDays}
                        onProductionDaysChange={setProductionDays}
                        isEditing={!!categoryId}
                    />

                    {/* Margens de Precificação */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            💰 Margens de Precificação
                        </h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Defina o desconto automático que esta categoria recebe em relação ao <b>Preço de Varejo</b>. O Bling sempre enviará o Preço de Varejo, e o sistema preencherá o Atacado e a Revenda baseado nestas porcentagens.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Desconto Atacado (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ex: 30"
                                        value={marginWholesale ?? ''}
                                        onChange={e => setMarginWholesale(e.target.value ? parseFloat(e.target.value) : undefined)}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-slate-400 sm:text-sm">%</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Ex: Se varejo = R$100 e desconto = 30%, atacado será R$70.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Desconto Revenda (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ex: 15"
                                        value={marginReseller ?? ''}
                                        onChange={e => setMarginReseller(e.target.value ? parseFloat(e.target.value) : undefined)}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-slate-400 sm:text-sm">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Toggle: Garantia Estendida */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            🛡️ Garantia Estendida
                        </h3>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={extendedWarrantyEnabled}
                                    onChange={e => setExtendedWarrantyEnabled(e.target.checked)}
                                />
                                <div className={`w-11 h-6 rounded-full transition-colors ${extendedWarrantyEnabled ? 'bg-blue-600' : 'bg-slate-200'
                                    }`} />
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${extendedWarrantyEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-800">
                                    Oferecer garantia estendida para produtos desta categoria
                                </p>
                                <p className="text-xs text-slate-500">
                                    Quando ativo, o cliente verá as opções de garantia estendida ao comprar
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Section 2: Unique Fields */}
                    <UniqueFieldsSection
                        config={config}
                        onChange={updateFieldConfig}
                    />

                    {/* Preset Selector */}
                    {presets.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                            <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                <BookMarked className="w-4 h-4 text-blue-600" />
                                Aplicar Preset de Campos
                            </h3>
                            <p className="text-sm text-slate-500 mb-4">
                                Selecione um grupo pré-configurado para preencher rapidamente a visibilidade dos campos.
                            </p>

                            {/* Merge mode toggle */}
                            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <span className="text-xs font-medium text-slate-600">Modo:</span>
                                <button
                                    type="button"
                                    onClick={() => setPresetMergeMode('replace')}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        presetMergeMode === 'replace'
                                            ? 'bg-red-100 text-red-700 border border-red-300'
                                            : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    🔄 Substituir tudo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPresetMergeMode('merge')}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        presetMergeMode === 'merge'
                                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                            : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    🔀 Mesclar (mantém configurados)
                                </button>
                                <span className="text-xs text-slate-400 ml-1">
                                    {presetMergeMode === 'replace'
                                        ? 'O preset sobrescreve todos os campos'
                                        : 'Preset preenche apenas campos ainda em Oculto'}
                                </span>
                            </div>

                            {/* Preset dropdown */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setPresetOpen(!presetOpen)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                                >
                                    <span>Escolher preset...</span>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${presetOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {presetOpen && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                                        {presets.map(preset => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => {
                                                    const presetConfig = preset.config as Record<string, FieldRequirement>;
                                                    if (presetMergeMode === 'replace') {
                                                        setConfig(prev => ({
                                                            ...prev,
                                                            ...presetConfig,
                                                        }));
                                                    } else {
                                                        // Mesclar: só aplica nos campos que ainda estão 'off' ou sem valor
                                                        setConfig(prev => {
                                                            const merged = { ...prev };
                                                            for (const [key, value] of Object.entries(presetConfig)) {
                                                                if (!merged[key as keyof CategoryConfig] || merged[key as keyof CategoryConfig] === 'off') {
                                                                    (merged as any)[key] = value;
                                                                }
                                                            }
                                                            return merged;
                                                        });
                                                    }
                                                    setPresetOpen(false);
                                                    toast.success(`Preset "${preset.name}" aplicado!`);
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                                            >
                                                <p className="font-medium text-slate-800 text-sm">{preset.name}</p>
                                                {preset.description && (
                                                    <p className="text-xs text-slate-500 mt-0.5">{preset.description}</p>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

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
