import React, { useState, useEffect } from 'react';
import { UseFormWatch, UseFormSetValue, Control, FieldErrors } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { Model } from '../../../types/model';
import { EANInput } from '../../ui/EANInput';
import { ModelSelect } from '../selectors/ModelSelect';
import { CategorySelect } from '../CategorySelect';
import { Package } from 'lucide-react';
import { modelService } from '../../../services/models';

interface ProductBasicInfoProps {
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    control: Control<ProductInput>;
    errors: FieldErrors<ProductInput>;
    initialData?: ProductInput | null;
}

export function ProductBasicInfo({
    watch,
    setValue,
    control,
    errors,
    initialData
}: ProductBasicInfoProps) {
    const [selectedModel, setSelectedModel] = useState<Model | null>(null);
    const [isLoadingModel, setIsLoadingModel] = useState(false);

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

    const handleEanSearch = async (ean: string) => {
        try {
            const models = await modelService.listActive();
            const model = models.find(m => m.ean === ean);

            if (model) {
                console.log('📦 EAN found! Setting model:', model.name);
                setValue('model_id', model.id, { shouldValidate: true, shouldDirty: true });
                setValue('model', model.name, { shouldValidate: true, shouldDirty: true });
                setSelectedModel(model);
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            EAN (Código de Barras)
                            <span className="ml-2 text-xs text-slate-400 font-mono">products.ean</span>
                        </label>
                        <EANInput
                            value={watch('ean') || ''}
                            onChange={(val) => setValue('ean', val)}
                            onSearch={handleEanSearch}
                        />
                        {errors.ean && (
                            <p className="text-xs text-red-600 mt-1">{errors.ean.message}</p>
                        )}
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
                                        setValue('model_id', model.id, { shouldValidate: true, shouldDirty: true });
                                        setValue('model', model.name, { shouldValidate: true, shouldDirty: true });
                                        setSelectedModel(model);
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
                        <p className="text-xs text-slate-400 mt-1">
                            💡 Será gerado automaticamente se deixado vazio
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
