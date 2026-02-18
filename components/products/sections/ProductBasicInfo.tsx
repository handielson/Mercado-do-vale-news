import React, { useState, useEffect } from 'react';
import { UseFormWatch, UseFormSetValue, Control, FieldErrors } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { Model } from '../../../types/model';
import { EANInput } from '../../ui/EANInput';
import { ModelSelect } from '../selectors/ModelSelect';
import { CategorySelect } from '../CategorySelect';
import { Package } from 'lucide-react';
import { modelService } from '../../../services/models';
import { brandService } from '../../../services/brands';
import { FIELD_DICTIONARY } from '../../../config/field-dictionary';

// Tradução de chaves técnicas do template_values para labels em português
const TEMPLATE_LABELS: Record<string, string> = {
    // Hardware
    chipset: 'Chipset',
    processor: 'Processador',
    antutu: 'AnTuTu',
    battery_mah: 'Bateria (mAh)',
    display: 'Display (pol)',
    // Conectividade
    nfc: 'NFC',
    network: 'Rede',
    rede_operadora: 'Rede Operadora',
    // Câmera
    main_camera_mpx: 'Câmera Principal (MP)',
    selfie_camera_mpx: 'Câmera Selfie (MP)',
    cam_principal_mpx: 'Câmera Principal (MP)',
    cam_selfie_mpx: 'Câmera Selfie (MP)',
    // Outros
    version: 'Versão',
    versao: 'Versão',
    resistencia: 'Resistência',
    carregamento: 'Carregamento',
    weight_kg: 'Peso (kg)',
    // Dimensões
    'dimensions.height_cm': 'Altura (cm)',
    'dimensions.width_cm': 'Largura (cm)',
    'dimensions.depth_cm': 'Profundidade (cm)',
};

function getTemplateLabel(key: string): string {
    // 1. Mapa local
    if (TEMPLATE_LABELS[key]) return TEMPLATE_LABELS[key];
    // 2. FIELD_DICTIONARY global
    if (FIELD_DICTIONARY[key]) return FIELD_DICTIONARY[key].label;
    // 3. Fallback: formata o nome técnico (snake_case → Title Case)
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface ProductBasicInfoProps {
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    control: Control<ProductInput>;
    errors: FieldErrors<ProductInput>;
    initialData?: ProductInput | null;
    onModelSelected?: (model: Model | null) => void;
}

export function ProductBasicInfo({
    watch,
    setValue,
    control,
    errors,
    initialData,
    onModelSelected
}: ProductBasicInfoProps) {
    const [selectedModel, setSelectedModel] = useState<Model | null>(null);
    const [isLoadingModel, setIsLoadingModel] = useState(false);
    const [brandName, setBrandName] = useState<string>('');

    const selectedModelName = watch('model');

    // Load model data when model is selected
    useEffect(() => {
        if (selectedModelName) {
            loadModelData(selectedModelName);
        } else {
            setSelectedModel(null);
        }
    }, [selectedModelName]);

    const loadModelData = async (modelName: string) => {
        try {
            setIsLoadingModel(true);
            const models = await modelService.listActive();
            const model = models.find(m => m.name === modelName);
            if (model) {
                setSelectedModel(model);
            }
        } catch (error) {
            console.error('Error loading model:', error);
        } finally {
            setIsLoadingModel(false);
        }
    };

    // Apply model data to form fields (only category and name — do not touch other fields)
    const applyModelToForm = async (model: Model) => {
        setValue('model_id', model.id, { shouldValidate: true, shouldDirty: true });
        setValue('model', model.name, { shouldValidate: true, shouldDirty: true });
        setSelectedModel(model);
        onModelSelected?.(model);

        // Fetch brand name
        try {
            const brands = await brandService.list();
            const brand = brands.find(b => b.id === model.brand_id);
            setBrandName(brand?.name || '');
            if (brand?.name) {
                setValue('brand', brand.name, { shouldDirty: true });
            }
        } catch {
            setBrandName('');
        }

        // Auto-fill category from model
        if (model.category_id) {
            setValue('category_id', model.category_id, { shouldValidate: true, shouldDirty: true });
        }

        // Auto-fill name only if field is empty
        const currentName = watch('name');
        if (!currentName) {
            const autoName = model.description || model.name;
            setValue('name', autoName, { shouldValidate: true, shouldDirty: true });
        }
    };

    const handleEanSearch = async (ean: string) => {
        try {
            const models = await modelService.listActive();
            // Search in eans[] array (new format)
            const model = models.find(m => Array.isArray(m.eans) && m.eans.includes(ean));

            if (model) {
                console.log('📦 EAN found! Setting model:', model.name);
                applyModelToForm(model);
            }
        } catch (error) {
            console.error('Error searching EAN:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* EAN Scanner + Model Selection */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Package size={18} className="text-blue-600" />
                    Informações Básicas
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* EAN Scanner */}
                    <div className="space-y-1">
                        <EANInput
                            value={watch('eans') || []}
                            onChange={(val) => setValue('eans', val)}
                            onSearch={handleEanSearch}
                        />
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Modelo
                            <span className="ml-2 text-xs text-slate-400 font-mono">products.model</span>
                        </label>
                        <ModelSelect
                            value={watch('model') || ''}
                            onChange={async (modelName) => {
                                if (!modelName) {
                                    setValue('model', '');
                                    setValue('model_id', '');
                                    setSelectedModel(null);
                                    return;
                                }

                                try {
                                    const models = await modelService.listActive();
                                    const model = models.find(m => m.name === modelName);
                                    if (model) {
                                        applyModelToForm(model);
                                    }
                                } catch (error) {
                                    console.error('Error fetching model:', error);
                                }
                            }}
                            error={errors.model?.message}
                        />
                    </div>

                    {/* Category */}
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Categoria
                            <span className="ml-2 text-xs text-slate-400 font-mono">products.category_id</span>
                        </label>
                        <CategorySelect
                            value={watch('category_id') || ''}
                            onChange={(val) => setValue('category_id', val)}
                            error={errors.category_id?.message}
                        />
                    </div>

                    {/* Product Name */}
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Nome do Produto <span className="text-red-500">*</span>
                            <span className="ml-2 text-xs text-slate-400 font-mono">products.name</span>
                        </label>
                        <input
                            type="text"
                            value={watch('name') || ''}
                            onChange={(e) => setValue('name', e.target.value)}
                            className={`w-full rounded-md border p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.name ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-300'
                                }`}
                            placeholder="Digite o nome do produto"
                        />
                        {errors.name && (
                            <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
                        )}
                    </div>

                    {/* SKU */}
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            SKU (Código do Produto)
                            <span className="ml-2 text-xs text-slate-400 font-mono">products.sku</span>
                        </label>
                        <input
                            type="text"
                            value={watch('sku') || ''}
                            onChange={(e) => setValue('sku', e.target.value)}
                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Será gerado automaticamente se deixado vazio"
                        />
                    </div>
                </div>
            </div>

            {/* Template Data Preview (read-only) — shown when a model is selected */}
            {selectedModel?.template_values && Object.keys(selectedModel.template_values).length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2 text-sm">
                        📋 Dados do Modelo (somente leitura)
                        <span className="ml-1 text-xs text-slate-400 font-mono font-normal">models.template_values</span>
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                            <span className="text-blue-700 font-medium">Modelo:</span>
                            <span className="ml-2 text-blue-900">{selectedModel.name}</span>
                        </div>
                        {brandName && (
                            <div>
                                <span className="text-blue-700 font-medium">Marca:</span>
                                <span className="ml-2 text-blue-900">{brandName}</span>
                            </div>
                        )}
                        {Object.entries(selectedModel.template_values).map(([key, value]) => (
                            <div key={key}>
                                <span className="text-blue-700 font-medium">{getTemplateLabel(key)}:</span>
                                <span className="ml-2 text-blue-900">{String(value)}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-blue-600 mt-3">
                        💡 Estes valores serão aplicados automaticamente ao produto
                    </p>
                </div>
            )}
        </div>
    );
}
