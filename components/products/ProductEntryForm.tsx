import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, type ProductInput } from '../../schemas/product';
import { EANInput } from '../ui/EANInput';
import { IMEIInput } from '../ui/IMEIInput';
import { ModelSelect } from './selectors/ModelSelect';
import { ColorSmartSelect } from './selectors/ColorSmartSelect';
import { ProductConditionSelector } from './sections/ProductConditionSelector';
import { ImageGalleryShared } from './sections/ImageGalleryShared';
import { ImageGalleryIndividual } from './sections/ImageGalleryIndividual';
import { ProductSEO } from './sections/ProductSEO';
import { ProductWarranty } from './sections/ProductWarranty';
import { ProductPricing } from './sections/ProductPricing';
import { modelService } from '../../services/models';
import { categoryService } from '../../services/categories';
import { brandService } from '../../services/brands';
import type { Model } from '../../types/model';
import type { Category } from '../../types/category';
import type { Brand } from '../../types/brand';

interface ProductEntryFormProps {
    initialData?: Partial<ProductInput>;
    onSubmit: (data: ProductInput) => Promise<void>;
    onCancel: () => void;
}

/**
 * ProductEntryForm - Simplified Product Entry
 * 
 * WORKFLOW:
 * 1. User scans EAN or selects Model
 * 2. System auto-fills: Brand, Category, all specs
 * 3. User fills ONLY: IMEI/Serial/Color, Condition, Observations, Type, Images
 * 4. System handles: SKU, Stock, Status, Warranty, Pricing, SEO
 */
export const ProductEntryForm: React.FC<ProductEntryFormProps> = ({
    initialData,
    onSubmit,
    onCancel
}) => {
    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProductInput>({
        resolver: zodResolver(productSchema),
        defaultValues: initialData || {
            condition: 'NOVO',
            status: 'ATIVO',
            images: [],
            eans: []
        }
    });

    // State
    const [model, setModel] = useState<Model | null>(null);
    const [category, setCategory] = useState<Category | null>(null);
    const [brand, setBrand] = useState<Brand | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Watch fields
    const selectedEAN = watch('eans')?.[0] || '';
    const selectedModel = watch('model') || '';
    const condition = watch('condition');
    const selectedColorId = watch('specs.color_id');

    // Auto-fill from EAN
    useEffect(() => {
        const loadFromEAN = async () => {
            if (!selectedEAN || selectedEAN.length < 13) return;

            try {
                setIsLoading(true);
                // TODO: Implement EAN lookup
                // const modelData = await modelService.findByEAN(selectedEAN);
                // if (modelData) {
                //     setValue('model', modelData.name);
                // }
            } catch (error) {
                console.error('Error loading from EAN:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadFromEAN();
    }, [selectedEAN, setValue]);

    // Auto-fill from Model
    useEffect(() => {
        const loadModelData = async () => {
            if (!selectedModel) {
                setModel(null);
                setCategory(null);
                setBrand(null);
                return;
            }

            try {
                setIsLoading(true);

                // Load model
                const models = await modelService.listActive();
                const modelData = models.find(m => m.name === selectedModel);

                if (!modelData) return;

                setModel(modelData);

                // Load category
                if (modelData.category_id) {
                    const categoryData = await categoryService.getById(modelData.category_id);
                    setCategory(categoryData);
                    setValue('category_id', modelData.category_id);
                }

                // Load brand
                if (modelData.brand_id) {
                    const brandData = await brandService.getById(modelData.brand_id);
                    setBrand(brandData);
                    setValue('brand', brandData.name);
                }

                // Auto-fill specs from model (using template_values)
                if (modelData.template_values) {
                    Object.entries(modelData.template_values).forEach(([key, value]) => {
                        setValue(`specs.${key}` as any, value);
                    });
                }

            } catch (error) {
                console.error('Error loading model data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadModelData();
    }, [selectedModel, setValue]);

    const handleFormSubmit = async (data: ProductInput) => {
        try {
            await onSubmit(data);
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    // Check if category requires IMEI
    const requiresIMEI = category?.id === 'smartphones' || category?.id === 'tablets';

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* Section 1: Model Lookup */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 text-lg">
                    🔍 Buscar Modelo do Produto
                </h3>

                {/* EAN | Model */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            EAN/GTIN
                        </label>
                        <EANInput
                            value={selectedEAN}
                            onChange={(value) => setValue('eans', value ? [value] : [])}
                            error={errors.eans?.message}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Modelo
                        </label>
                        <ModelSelect
                            value={selectedModel}
                            onChange={(value) => setValue('model', value)}
                            error={errors.model?.message}
                        />
                    </div>
                </div>

                {/* Read-only Display: Brand, Category, ALL Specs */}
                {model && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 mb-2">Conferência (somente leitura):</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            {/* Always show Brand and Category */}
                            {brand && (
                                <div>
                                    <span className="text-slate-600">✓ Marca:</span>{' '}
                                    <span className="font-medium">{brand.name}</span>
                                </div>
                            )}
                            {category && (
                                <div>
                                    <span className="text-slate-600">✓ Categoria:</span>{' '}
                                    <span className="font-medium">{category.name}</span>
                                </div>
                            )}

                            {/* Dynamically show ALL specs from model */}
                            {model.template_values && Object.entries(model.template_values).map(([key, value]) => {
                                // Skip empty values and internal fields
                                if (!value || key.startsWith('_') || key === 'color_id' || key === 'color') return null;

                                // Format the label (convert snake_case to Title Case)
                                const label = key
                                    .split('_')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ');

                                return (
                                    <div key={key}>
                                        <span className="text-slate-600">✓ {label}:</span>{' '}
                                        <span className="font-medium">{String(value)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Section 2: Unique Fields (only if model selected) */}
            {model && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-semibold text-slate-800 text-lg">
                        📝 Campos Únicos do Produto
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* IMEI fields (conditional) */}
                        {requiresIMEI && (
                            <>
                                <IMEIInput
                                    label="IMEI 1"
                                    value={watch('specs.imei1') || ''}
                                    onChange={(value) => setValue('specs.imei1', value)}
                                />
                                <IMEIInput
                                    label="IMEI 2"
                                    value={watch('specs.imei2') || ''}
                                    onChange={(value) => setValue('specs.imei2', value)}
                                />
                            </>
                        )}

                        {/* Serial */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Serial
                            </label>
                            <input
                                type="text"
                                {...register('specs.serial')}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Número de série"
                            />
                        </div>

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

            {/* Section 3: Condition */}
            {model && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-semibold text-slate-800 text-lg mb-4">
                        ✨ Situação do Produto
                    </h3>
                    <ProductConditionSelector
                        value={condition || 'NOVO'}
                        onChange={(value) => setValue('condition', value)}
                    />
                </div>
            )}

            {/* Section 4: Observations */}
            {model && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-semibold text-slate-800 text-lg">
                        📝 Observações
                    </h3>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Observação Interna (uso interno)
                        </label>
                        <textarea
                            {...register('internal_notes')}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Notas internas sobre o produto..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Observação Catálogo (visível no catálogo)
                        </label>
                        <textarea
                            {...register('catalog_notes')}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Informações visíveis para clientes..."
                        />
                    </div>
                </div>
            )}

            {/* Section 5: Type */}
            {model && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-semibold text-slate-800 text-lg mb-4">
                        🏷️ Tipo de Produto
                    </h3>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                {...register('product_type')}
                                value="VENDA"
                                className="w-4 h-4"
                            />
                            <span>💰 VENDA</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                {...register('product_type')}
                                value="BRINDE"
                                className="w-4 h-4"
                            />
                            <span>🎁 BRINDE</span>
                        </label>
                    </div>
                </div>
            )}

            {/* Section 6: Images (conditional) */}
            {model && condition && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-semibold text-slate-800 text-lg mb-4">
                        📸 Imagens do Produto
                    </h3>
                    {condition === 'NOVO' ? (
                        <ImageGalleryShared
                            modelId={model.id}
                            colorId={selectedColorId || ''}
                            modelName={model.name}
                            colorName={watch('specs.color') || ''}
                        />
                    ) : (
                        <ImageGalleryIndividual
                            images={watch('images') || []}
                            onChange={(images) => setValue('images', images)}
                        />
                    )}
                </div>
            )}

            {/* TODO: Add remaining sections (SKU, Status, Warranty, Pricing, SEO) */}

            {/* Section 7: SKU & Stock */}
            {model && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-semibold text-slate-800 text-lg">
                        📦 SKU e Controle de Estoque
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                SKU (gerado automaticamente)
                            </label>
                            <input
                                {...register('sku')}
                                readOnly
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                                placeholder="Auto-gerado ao salvar"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                {...register('track_stock')}
                                id="track_stock"
                                className="w-4 h-4 rounded border-slate-300"
                            />
                            <label htmlFor="track_stock" className="text-sm font-medium text-slate-700">
                                Monitorar Estoque
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Section 8: Status */}
            {model && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-semibold text-slate-800 text-lg mb-4">
                        🚦 Status do Produto
                    </h3>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                {...register('status')}
                                value="ATIVO"
                                className="w-4 h-4"
                            />
                            <span>🟢 ATIVO</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                {...register('status')}
                                value="VENDIDO"
                                className="w-4 h-4"
                            />
                            <span>🔵 VENDIDO</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                {...register('status')}
                                value="INATIVO"
                                className="w-4 h-4"
                            />
                            <span>⚫ INATIVO</span>
                        </label>
                    </div>
                </div>
            )}

            {/* Section 9: Warranty (using existing component) */}
            {model && brand && category && (
                <ProductWarranty
                    warrantyType={watch('warranty_type') || 'brand'}
                    warrantyTemplateId={watch('warranty_template_id') || ''}
                    brandWarrantyDays={brand.warranty_days || 0}
                    categoryWarrantyDays={category.warranty_days || 0}
                    onWarrantyTypeChange={(type) => setValue('warranty_type', type)}
                    onTemplateChange={(templateId) => setValue('warranty_template_id', templateId)}
                />
            )}

            {/* Section 10: Pricing (using existing component) */}
            {model && (
                <ProductPricing watch={watch} setValue={setValue} />
            )}

            {/* Section 11: SEO (using existing component) */}
            {model && (
                <ProductSEO
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                />
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    {isLoading ? 'Salvando...' : 'Salvar Produto'}
                </button>
            </div>
        </form>
    );
};
