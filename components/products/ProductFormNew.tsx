import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema } from '../../schemas/product';
import { Product, ProductInput } from '../../types/product';
import { toast } from 'sonner';

// Sections
import { ProductConditionSelector } from './sections/ProductConditionSelector';
import { ImageGalleryShared } from './sections/ImageGalleryShared';
import { ImageGalleryIndividual } from './sections/ImageGalleryIndividual';
import { ProductPricing } from './sections/ProductPricing';
import { ProductWarranty } from './sections/ProductWarranty';
import { ProductSEO } from './sections/ProductSEO';

// Selectors
import { BrandSelect } from './selectors/BrandSelect';
import { ModelSelect } from './selectors/ModelSelect';
import { ColorSmartSelect } from './selectors/ColorSmartSelect';
import { CapacitySelect } from './selectors/CapacitySelect';
import { CategorySelect } from './CategorySelect';

// UI Components
import { IMEIInput } from '../ui/IMEIInput';
import { EANInput } from '../ui/EANInput';
import { Loader2, Save, X } from 'lucide-react';

interface ProductFormNewProps {
    initialData?: Product;
    onSubmit: (data: ProductInput) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

/**
 * ProductFormNew Component
 * Simplified product form with intelligent Model+Color workflow
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Clean, modular sections
 * - Conditional image logic (NEW vs USED)
 * - Model-based auto-fill
 * - Mobile-first responsive design
 */
export function ProductFormNew({
    initialData,
    onSubmit,
    onCancel,
    isLoading
}: ProductFormNewProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors }
    } = useForm<ProductInput>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            status: 'active',
            condition: 'NOVO',
            images: [],
            specs: {},
            price_cost: 0,
            price_retail: 0,
            price_reseller: 0,
            price_wholesale: 0,
            warranty_type: 'brand',
            ...initialData
        }
    });

    // Watch key fields
    const condition = watch('condition') || 'NOVO';
    const selectedBrand = watch('brand');
    const selectedModel = watch('model');
    const selectedColorId = watch('specs.color_id');
    const categoryId = watch('category_id');

    // State
    const [selectedBrandId, setSelectedBrandId] = useState('');
    const [selectedModelId, setSelectedModelId] = useState('');
    const [brandWarrantyDays, setBrandWarrantyDays] = useState<number | null>(null);
    const [categoryWarrantyDays, setCategoryWarrantyDays] = useState<number | null>(null);

    // Load brand data when brand changes
    useEffect(() => {
        const loadBrandData = async () => {
            if (!selectedBrand) {
                setSelectedBrandId('');
                setBrandWarrantyDays(null);
                return;
            }
            try {
                const { brandService } = await import('../../services/brands');
                const brands = await brandService.list();
                const brand = brands.find(b => b.name === selectedBrand);
                setSelectedBrandId(brand?.id || '');
                setBrandWarrantyDays(brand?.warranty_days || 90);
            } catch (error) {
                console.error('Error loading brand:', error);
            }
        };
        loadBrandData();
    }, [selectedBrand]);

    // Load model data when model changes
    useEffect(() => {
        const loadModelData = async () => {
            if (!selectedModel || !selectedBrandId) {
                setSelectedModelId('');
                return;
            }
            try {
                const { modelService } = await import('../../services/models');
                const models = await modelService.listByBrand(selectedBrandId);
                const model = models.find(m => m.name === selectedModel);

                if (model) {
                    setSelectedModelId(model.id);

                    // Auto-fill category_id and brand from model
                    if (model.category_id) {
                        setValue('category_id', model.category_id);
                    }
                    if (selectedBrand) {
                        setValue('brand', selectedBrand);
                    }
                }
            } catch (error) {
                console.error('Error loading model:', error);
            }
        };
        loadModelData();
    }, [selectedModel, selectedBrandId, selectedBrand, setValue]);

    const handleFormSubmit = async (data: ProductInput) => {
        try {
            await onSubmit(data);
            toast.success('Produto salvo com sucesso!');
        } catch (error) {
            toast.error('Erro ao salvar produto');
            console.error(error);
        }
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* Section 1: Model Lookup */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 text-lg">
                    🔍 Buscar Modelo do Produto
                </h3>

                {/* EAN | Model (side by side) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            EAN/GTIN
                            <span className="ml-2 text-xs text-slate-400 font-mono">eans</span>
                        </label>
                        <EANInput
                            value={watch('eans')?.[0] || ''}
                            onChange={(value) => setValue('eans', value ? [value] : [])}
                            error={errors.eans?.message}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Modelo
                            <span className="ml-2 text-xs text-slate-400 font-mono">model</span>
                        </label>
                        <ModelSelect
                            brandId={selectedBrandId}
                            value={selectedModel || ''}
                            onChange={(value) => setValue('model', value)}
                            error={errors.model?.message}
                        />
                    </div>
                </div>
            </div>

            {/* Section 2: Unique Fields */}
            {selectedModel && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-semibold text-slate-800 text-lg">
                        📝 Campos Únicos do Produto
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* IMEI fields - only for smartphones/tablets */}
                        {(categoryId === 'smartphones' || categoryId === 'tablets') && (
                            <>
                                <IMEIInput
                                    label="IMEI 1"
                                    technicalName="specs.imei1"
                                    value={watch('specs.imei1') || ''}
                                    onChange={(value) => setValue('specs.imei1', value)}
                                />
                                <IMEIInput
                                    label="IMEI 2"
                                    technicalName="specs.imei2"
                                    value={watch('specs.imei2') || ''}
                                    onChange={(value) => setValue('specs.imei2', value)}
                                />
                            </>
                        )}

                        {/* Serial Number */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Serial
                                <span className="ml-2 text-xs text-slate-400 font-mono">specs.serial</span>
                            </label>
                            <input
                                type="text"
                                value={watch('specs.serial') || ''}
                                onChange={(e) => setValue('specs.serial', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Número de série"
                            />
                        </div>

                        {/* RAM & Storage */}
                        <CapacitySelect
                            label="RAM"
                            type="ram"
                            technicalName="specs.ram"
                            value={watch('specs.ram') || ''}
                            onChange={(value) => setValue('specs.ram', value)}
                        />

                        <CapacitySelect
                            label="Armazenamento"
                            type="storage"
                            technicalName="specs.storage"
                            value={watch('specs.storage') || ''}
                            onChange={(value) => setValue('specs.storage', value)}
                        />

                        {/* Color */}
                        <ColorSmartSelect
                            value={selectedColorId || ''}
                            onChange={(colorId, colorName) => {
                                setValue('specs.color_id', colorId);
                                setValue('specs.color', colorName);
                            }}
                            error={errors.specs?.color?.message}
                        />
                    </div>
                </div>
            )}

            {/* Section 3: Product Type */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 text-lg">
                    🏷️ Tipo de Produto
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setValue('is_gift', false)}
                        className={`p-4 rounded-lg border-2 transition-all ${!watch('is_gift')
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-blue-300'
                            }`}
                    >
                        <div className="text-center">
                            <div className="text-2xl mb-2">💰</div>
                            <div className="font-semibold">VENDA</div>
                            <div className="text-xs text-slate-600 mt-1">
                                Produto normal
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setValue('is_gift', true)}
                        className={`p-4 rounded-lg border-2 transition-all ${watch('is_gift')
                            ? 'border-green-500 bg-green-50'
                            : 'border-slate-200 hover:border-green-300'
                            }`}
                    >
                        <div className="text-center">
                            <div className="text-2xl mb-2">🎁</div>
                            <div className="font-semibold">BRINDE</div>
                            <div className="text-xs text-slate-600 mt-1">
                                Grátis no PDV
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Section 4: Condition */}
            <ProductConditionSelector
                value={condition}
                onChange={(value) => setValue('condition', value)}
            />

            {/* Section 5: Pricing */}
            <ProductPricing
                control={watch as any}
                setValue={setValue}
                watch={watch}
                errors={errors}
            />

            {/* Section 6: Images (Conditional) */}
            {selectedModelId && selectedColorId && (
                condition === 'NOVO' ? (
                    <ImageGalleryShared
                        modelId={selectedModelId}
                        colorId={selectedColorId}
                        modelName={selectedModel || ''}
                        colorName={watch('specs.color') || ''}
                    />
                ) : (
                    <ImageGalleryIndividual
                        images={watch('images') || []}
                        onChange={(images) => setValue('images', images)}
                    />
                )
            )}

            {/* Section 7: Warranty */}
            <ProductWarranty
                warrantyType={watch('warranty_type') || 'brand'}
                warrantyTemplateId={watch('warranty_template_id') || ''}
                brandWarrantyDays={brandWarrantyDays}
                categoryWarrantyDays={categoryWarrantyDays}
                onWarrantyTypeChange={(type) => setValue('warranty_type', type)}
                onTemplateChange={(id) => setValue('warranty_template_id', id)}
            />

            {/* Section 8: SEO (Read-only) */}
            <ProductSEO
                watch={watch}
                setValue={setValue}
                errors={errors}
            />

            {/* Actions */}
            <div className="flex gap-3 justify-end sticky bottom-0 bg-white p-4 border-t border-slate-200">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                    disabled={isLoading}
                >
                    <X size={18} />
                    Cancelar
                </button>

                <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Salvando...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Salvar Produto
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
