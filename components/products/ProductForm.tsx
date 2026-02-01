import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema } from '../../schemas/product';
import { Product, ProductInput } from '../../types/product';
import { CategoryConfig } from '../../types/category';
import { categoryService } from '../../services/categories';
import { CategorySelect } from './CategorySelect';
import { BrandSelect } from './selectors/BrandSelect';
import { ModelSelect } from './selectors/ModelSelect';
import { ColorSelect } from './selectors/ColorSelect';
import { CapacitySelect } from './selectors/CapacitySelect';
import { VersionSelect } from './selectors/VersionSelect';
import { CurrencyInput } from '../ui/CurrencyInput';
import { IMEIInput } from '../ui/IMEIInput';
import { EANInput } from '../ui/EANInput';
import { SmartInput } from '../ui/SmartInput';
import { compressImage } from '../../utils/image-compression';
import { generateProductName } from '../../utils/product-name-generator';
import { Loader2, X, Upload, ChevronDown, ChevronUp, Package, FileText } from 'lucide-react';

interface ProductFormProps {
    initialData?: Product;
    onSubmit: (data: ProductInput) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export function ProductForm({ initialData, onSubmit, onCancel, isLoading }: ProductFormProps) {
    const [imagePreviews, setImagePreviews] = useState<string[]>(initialData?.images || []);
    const [isCompressing, setIsCompressing] = useState(false);

    // Estado para armazenar as regras da categoria (Traffic Light)
    const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

    // Estado para controlar qual aba da calculadora de margem está ativa
    const [activeMarginTab, setActiveMarginTab] = useState<'retail' | 'reseller' | 'wholesale'>('retail');

    // Estado para rastrear se o nome foi editado manualmente
    const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

    // Estado para EAN auto-fill
    const [isSearchingEAN, setIsSearchingEAN] = useState(false);
    const [eanSearchMessage, setEANSearchMessage] = useState<string>('');
    const [isDuplicateEAN, setIsDuplicateEAN] = useState(false);
    const [existingProduct, setExistingProduct] = useState<Product | null>(null);

    // Estado para indicadores de preço
    const [priceStats, setPriceStats] = useState<{
        lastPurchasePrice: number | null;
        averageStockPrice: number | null;
    }>({ lastPurchasePrice: null, averageStockPrice: null });

    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        watch,
        control,
        formState: { errors }
    } = useForm<ProductInput>({
        resolver: zodResolver(productSchema),
        defaultValues: initialData || {
            status: 'active',
            images: [],
            specs: {},
            origin: '0', // Padrão Nacional
            price_cost: 0,
            price_retail: 0,
            price_reseller: 0,
            price_wholesale: 0
        }
    });

    const selectedCategoryId = watch('category_id');
    const selectedBrand = watch('brand');
    const [selectedBrandId, setSelectedBrandId] = useState<string>('');

    // Load brand ID when brand name changes
    useEffect(() => {
        const loadBrandId = async () => {
            if (!selectedBrand) {
                setSelectedBrandId('');
                return;
            }
            try {
                const { brandService } = await import('../../services/brands');
                const brands = await brandService.list();
                const brand = brands.find(b => b.name === selectedBrand);
                setSelectedBrandId(brand?.id || '');
            } catch (error) {
                console.error('Error loading brand ID:', error);
            }
        };
        loadBrandId();
    }, [selectedBrand]);

    // 1. Efeito para carregar as regras quando a Categoria muda
    useEffect(() => {
        const loadCategoryConfig = async () => {
            if (!selectedCategoryId) {
                setCategoryConfig(null);
                return;
            }
            try {
                const category = await categoryService.getById(selectedCategoryId);
                if (category) {
                    console.log("Config carregada:", category.config); // Debug
                    setCategoryConfig(category.config);
                }
            } catch (error) {
                console.error("Erro ao carregar config da categoria:", error);
            }
        };
        loadCategoryConfig();
    }, [selectedCategoryId]);

    // Auto-generate product name based on category configuration
    useEffect(() => {
        if (!categoryConfig?.auto_name_enabled || nameManuallyEdited) return;

        const formData = {
            brand: watch('brand'),
            model: watch('model'),
            specs: {
                ram: watch('specs.ram'),
                storage: watch('specs.storage'),
                color: watch('specs.color'),
                version: watch('specs.version')
            }
        };

        const generatedName = generateProductName(categoryConfig, formData);

        if (generatedName && generatedName.trim()) {
            setValue('name', generatedName);
        }
    }, [
        categoryConfig,
        watch('brand'),
        watch('model'),
        watch('specs.ram'),
        watch('specs.storage'),
        watch('specs.color'),
        watch('specs.version'),
        nameManuallyEdited
    ]);

    // 3. Auto-fill form when scanning existing product EAN
    useEffect(() => {
        const searchByEAN = async () => {
            const eans = watch('eans');
            if (!eans || eans.length === 0 || !eans[0]) {
                setEANSearchMessage('');
                setIsDuplicateEAN(false);
                setExistingProduct(null);
                return;
            }

            const firstEAN = eans[0].trim();

            // Only search when EAN is complete (13 digits)
            if (firstEAN.length !== 13) {
                setEANSearchMessage('');
                setIsDuplicateEAN(false);
                setExistingProduct(null);
                return;
            }

            // Don't search if we're editing an existing product
            if (initialData?.id) {
                return;
            }

            setIsSearchingEAN(true);
            setEANSearchMessage('🔍 Buscando produto...');

            try {
                const { productService } = await import('../../services/products');
                const { categoryService } = await import('../../services/categories');
                const foundProduct = await productService.findByEAN(firstEAN);

                if (foundProduct) {
                    // Get category configuration
                    const category = await categoryService.getById(foundProduct.category_id);
                    const autoFillEnabled = category?.config?.ean_autofill_config?.enabled ?? true;

                    // SEMPRE bloqueia criação de produto duplicado
                    setIsDuplicateEAN(true);
                    setExistingProduct(foundProduct);
                    setEANSearchMessage('⚠️ Código de barras já cadastrado neste produto!');
                } else {
                    // EAN NOVO - Permitir criação
                    setIsDuplicateEAN(false);
                    setExistingProduct(null);
                    setEANSearchMessage('ℹ️ Produto novo - preencha os dados');
                    setTimeout(() => setEANSearchMessage(''), 3000);
                }
            } catch (error) {
                console.error('Error searching by EAN:', error);
                setEANSearchMessage('⚠️ Erro ao buscar produto');
                setTimeout(() => setEANSearchMessage(''), 3000);
            } finally {
                setIsSearchingEAN(false);
            }
        };

        searchByEAN();
    }, [watch('eans'), initialData?.id]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setIsCompressing(true);
        const files = Array.from(e.target.files);
        try {
            const processedImages: string[] = [];
            for (const file of files) {
                const compressed = await compressImage(file);
                const objectUrl = URL.createObjectURL(compressed);
                processedImages.push(objectUrl);
            }
            const currentImages = getValues('images') || [];
            const newImages = [...currentImages, ...processedImages];
            setValue('images', newImages);
            setImagePreviews(newImages);
        } catch (error) {
            alert('Erro ao processar imagens');
        } finally {
            setIsCompressing(false);
        }
    };

    const removeImage = (index: number) => {
        const current = getValues('images');
        const newImages = current.filter((_, i) => i !== index);
        setValue('images', newImages);
        setImagePreviews(newImages);
    };

    // Helper para Labels com Asterisco
    const FieldLabel = ({ label, required }: { label: string, required: boolean }) => (
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
    );

    // Função para adicionar EAN alternativo ao produto existente
    const handleAddAlternativeEAN = async () => {
        if (!existingProduct) return;

        const newEAN = watch('eans')[0];
        if (!newEAN || newEAN.length !== 13) {
            alert('EAN inválido');
            return;
        }

        try {
            const { productService } = await import('../../services/products');

            // Adiciona o novo EAN à lista de EANs do produto
            const updatedEANs = [...existingProduct.eans, newEAN];

            await productService.update(existingProduct.id, {
                ...existingProduct,
                eans: updatedEANs
            });

            alert('✅ EAN alternativo adicionado com sucesso!');

            // Limpa o formulário e reseta estados
            setValue('eans', []);
            setIsDuplicateEAN(false);
            setExistingProduct(null);
            setEANSearchMessage('');

            // Opcional: redirecionar para a página do produto
            // window.location.href = `/admin/products/${existingProduct.id}`;
        } catch (error) {
            console.error('Error adding alternative EAN:', error);
            alert('❌ Erro ao adicionar EAN alternativo');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-20">

            {/* 0. SCANNER DE CÓDIGO DE BARRAS (PRIMEIRO CAMPO) */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Package size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800">Scanner de Código de Barras</h3>
                        <p className="text-xs text-slate-600">Escaneie ou digite o EAN para buscar produto existente</p>
                    </div>
                </div>

                <EANInput
                    value={watch('eans') || []}
                    onChange={(value) => setValue('eans', value)}
                />

                {/* Status message */}
                {eanSearchMessage && !isDuplicateEAN && (
                    <div className={`p-3 rounded-lg text-sm font-medium ${eanSearchMessage.includes('✅') ? 'bg-green-100 text-green-800 border border-green-300' :
                        eanSearchMessage.includes('🔍') ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                            eanSearchMessage.includes('ℹ️') ? 'bg-slate-100 text-slate-800 border border-slate-300' :
                                'bg-orange-100 text-orange-800 border border-orange-300'
                        }`}>
                        {eanSearchMessage}
                    </div>
                )}

                {/* Duplicate EAN Warning Card */}
                {isDuplicateEAN && existingProduct && (
                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-5 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-yellow-900 text-base mb-1">
                                    ⚠️ Código de Barras Já Cadastrado!
                                </h4>
                                <p className="text-sm text-yellow-800 mb-2">
                                    Este EAN já está vinculado ao seguinte produto:
                                </p>
                                <div className="bg-white rounded-lg p-3 border border-yellow-300">
                                    <p className="font-medium text-slate-900">{existingProduct.name}</p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        Marca: <span className="font-medium">{existingProduct.brand}</span> |
                                        Modelo: <span className="font-medium">{existingProduct.model}</span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        EANs cadastrados: {existingProduct.eans.join(', ')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-yellow-300 pt-4">
                            <p className="text-sm font-medium text-yellow-900 mb-3">
                                Escolha uma ação:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Opção 1: Adicionar Unidade */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        // TODO: Implementar navegação para tela de unidades
                                        alert('🚧 Tela de unidades em desenvolvimento.\nPor enquanto, use a opção "Adicionar EAN Alternativo".');
                                    }}
                                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                                >
                                    <Package size={18} />
                                    <div className="text-left">
                                        <div>Adicionar Nova Unidade</div>
                                        <div className="text-xs opacity-90">Cadastrar dispositivo físico</div>
                                    </div>
                                </button>

                                {/* Opção 2: Adicionar EAN Alternativo */}
                                <button
                                    type="button"
                                    onClick={handleAddAlternativeEAN}
                                    className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                                >
                                    <span className="text-xl">🏷️</span>
                                    <div className="text-left">
                                        <div>Adicionar EAN Alternativo</div>
                                        <div className="text-xs opacity-90">Código adicional do produto</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isSearchingEAN && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Buscando produto...</span>
                    </div>
                )}
            </div>

            {/* 1. INFORMAÇÕES BÁSICAS */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 mb-4">Informações Básicas</h3>

                <div className="grid grid-cols-1 gap-4">
                    <CategorySelect
                        value={selectedCategoryId || ''}
                        onChange={(id) => setValue('category_id', id)}
                        error={errors.category_id?.message}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Marca *</label>
                        <BrandSelect
                            value={watch('brand')}
                            onChange={(val) => setValue('brand', val)}
                            error={errors.brand?.message}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Modelo *</label>
                        <ModelSelect
                            value={watch('model')}
                            brandId={selectedBrandId}
                            onChange={(val) => setValue('model', val)}
                            error={errors.model?.message}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SmartInput control={control} name="name" />
                    <SmartInput control={control} name="sku" />
                </div>
            </div>

            {/* 2. ESPECIFICAÇÕES TÉCNICAS (O CARD QUE ESTAVA FALTANDO) */}
            {categoryConfig && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Package size={18} className="text-blue-600" />
                        Especificações Técnicas
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto min-h-fit">

                        {/* IMEI 1 */}
                        {categoryConfig.imei1 !== 'off' && (
                            <div>
                                <IMEIInput
                                    label="IMEI 1"
                                    value={watch('specs.imei1') || ''}
                                    onChange={(val) => setValue('specs.imei1', val)}
                                    required={categoryConfig.imei1 === 'required'}
                                    placeholder="Digite 15 dígitos"
                                />
                                {categoryConfig.imei1 === 'required' && errors.specs?.message && (
                                    <span className="text-xs text-red-500">{errors.specs.message}</span>
                                )}
                            </div>
                        )}

                        {/* IMEI 2 */}
                        {categoryConfig.imei2 !== 'off' && (
                            <div>
                                <IMEIInput
                                    label="IMEI 2"
                                    value={watch('specs.imei2') || ''}
                                    onChange={(val) => setValue('specs.imei2', val)}
                                    required={categoryConfig.imei2 === 'required'}
                                    placeholder="Digite 15 dígitos"
                                />
                                {categoryConfig.imei2 === 'required' && errors.specs?.message && (
                                    <span className="text-xs text-red-500">{errors.specs.message}</span>
                                )}
                            </div>
                        )}

                        {/* SERIAL */}
                        {categoryConfig.serial !== 'off' && (
                            <div>
                                <FieldLabel label="Serial" required={categoryConfig.serial === 'required'} />
                                <input
                                    type="text"
                                    value={watch('specs.serial') || ''}
                                    onChange={(e) => setValue('specs.serial', e.target.value.toUpperCase().trim())}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                                    placeholder="Ex: SN123456789"
                                />
                                {categoryConfig.serial === 'required' && errors.specs?.message && (
                                    <span className="text-xs text-red-500">{errors.specs.message}</span>
                                )}
                            </div>
                        )}

                        {/* COR */}
                        {categoryConfig.color !== 'off' && (
                            <div>
                                <FieldLabel label="Cor Predominante" required={categoryConfig.color === 'required'} />
                                <ColorSelect
                                    value={watch('specs.color')}
                                    onChange={(val) => setValue('specs.color', val)}
                                    error={categoryConfig.color === 'required' ? errors.specs?.message : undefined}
                                />
                            </div>
                        )}

                        {/* ARMAZENAMENTO */}
                        {categoryConfig.storage !== 'off' && (
                            <div>
                                <FieldLabel label="Armazenamento" required={categoryConfig.storage === 'required'} />
                                <CapacitySelect
                                    type="storage"
                                    value={watch('specs.storage')}
                                    onChange={(val) => setValue('specs.storage', val)}
                                    error={categoryConfig.storage === 'required' ? errors.specs?.message : undefined}
                                />
                            </div>
                        )}

                        {/* RAM */}
                        {categoryConfig.ram !== 'off' && (
                            <div>
                                <FieldLabel label="Memória RAM" required={categoryConfig.ram === 'required'} />
                                <CapacitySelect
                                    type="ram"
                                    value={watch('specs.ram')}
                                    onChange={(val) => setValue('specs.ram', val)}
                                    error={categoryConfig.ram === 'required' ? errors.specs?.message : undefined}
                                />
                            </div>
                        )}

                        {/* VERSÃO */}
                        {categoryConfig.version !== 'off' && (
                            <div>
                                <FieldLabel label="Versão" required={categoryConfig.version === 'required'} />
                                <VersionSelect
                                    value={watch('specs.version')}
                                    onChange={(val) => setValue('specs.version', val)}
                                    error={categoryConfig.version === 'required' ? errors.specs?.message : undefined}
                                />
                            </div>
                        )}

                        {/* SAÚDE DA BATERIA */}
                        {categoryConfig.battery_health !== 'off' && (
                            <div>
                                <FieldLabel label="Saúde Bateria" required={categoryConfig.battery_health === 'required'} />
                                <select
                                    value={watch('specs.battery_health') || ''}
                                    onChange={(e) => setValue('specs.battery_health', e.target.value)}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Selecione</option>
                                    <option value="100">100% (Nova)</option>
                                    <option value="95-99">95-99%</option>
                                    <option value="90-94">90-94%</option>
                                    <option value="85-89">85-89%</option>
                                    <option value="80-84">80-84%</option>
                                    <option value="75-79">75-79%</option>
                                    <option value="70-74">70-74%</option>
                                    <option value="<70">Abaixo de 70%</option>
                                </select>
                                {categoryConfig.battery_health === 'required' && errors.specs?.message && (
                                    <span className="text-xs text-red-500">{errors.specs.message}</span>
                                )}
                            </div>
                        )}

                        {/* CUSTOM FIELDS - Dynamic rendering */}
                        {categoryConfig.custom_fields?.map((customField) => {
                            if (customField.requirement === 'off') return null;

                            return (
                                <div key={customField.id}>
                                    <FieldLabel
                                        label={customField.name}
                                        required={customField.requirement === 'required'}
                                    />


                                    {/* Text-based inputs - includes all text formats from dictionary */}
                                    {(customField.type === 'text' ||
                                        customField.type === 'capitalize' ||
                                        customField.type === 'uppercase' ||
                                        customField.type === 'lowercase' ||
                                        customField.type === 'titlecase' ||
                                        customField.type === 'sentence' ||
                                        customField.type === 'slug' ||
                                        customField.type === 'alphanumeric' ||
                                        customField.type === 'numeric' ||
                                        customField.type === 'phone' ||
                                        customField.type === 'cpf' ||
                                        customField.type === 'cnpj' ||
                                        customField.type === 'cep' ||
                                        customField.type === 'date_br' ||
                                        customField.type === 'date_br_short' ||
                                        customField.type === 'date_iso' ||
                                        customField.type === 'ncm' ||
                                        customField.type === 'ean13' ||
                                        customField.type === 'cest') && (
                                            <input
                                                type="text"
                                                value={watch(`specs.${customField.key}`) || ''}
                                                onChange={(e) => setValue(`specs.${customField.key}`, e.target.value)}
                                                placeholder={customField.placeholder}
                                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        )}

                                    {/* Number Input */}
                                    {customField.type === 'number' && (
                                        <input
                                            type="number"
                                            value={watch(`specs.${customField.key}`) || ''}
                                            onChange={(e) => setValue(`specs.${customField.key}`, e.target.value)}
                                            placeholder={customField.placeholder}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    )}

                                    {/* Currency Input (BRL) */}
                                    {customField.type === 'brl' && (
                                        <input
                                            type="text"
                                            value={watch(`specs.${customField.key}`) || ''}
                                            onChange={(e) => setValue(`specs.${customField.key}`, e.target.value)}
                                            placeholder={customField.placeholder}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    )}

                                    {/* Dropdown */}
                                    {customField.type === 'dropdown' && (
                                        <select
                                            value={watch(`specs.${customField.key}`) || ''}
                                            onChange={(e) => setValue(`specs.${customField.key}`, e.target.value)}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">Selecione</option>
                                            {customField.options?.map((option) => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    {/* Textarea */}
                                    {customField.type === 'textarea' && (
                                        <textarea
                                            value={watch(`specs.${customField.key}`) || ''}
                                            onChange={(e) => setValue(`specs.${customField.key}`, e.target.value)}
                                            placeholder={customField.placeholder}
                                            rows={3}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        />
                                    )}

                                    {customField.requirement === 'required' && errors.specs?.message && (
                                        <span className="text-xs text-red-500">{errors.specs.message}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 3. PRECIFICAÇÃO */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 mb-4">Precificação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Custo *</label>
                        <CurrencyInput value={watch('price_cost') || 0} onChange={(val) => setValue('price_cost', val)} />
                        <p className="text-xs text-slate-500 mt-1">💰 Preço de compra</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Preço Varejo *</label>
                        <CurrencyInput value={watch('price_retail')} onChange={(val) => setValue('price_retail', val)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Preço Revenda *</label>
                        <CurrencyInput value={watch('price_reseller')} onChange={(val) => setValue('price_reseller', val)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Preço Atacado *</label>
                        <CurrencyInput value={watch('price_wholesale')} onChange={(val) => setValue('price_wholesale', val)} />
                    </div>
                </div>

                {/* Calculadora de Margem Unificada com Abas */}
                <div className="mt-4 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-800">💹 Calculadora de Margem de Lucro</h4>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-4">
                        <button
                            type="button"
                            onClick={() => setActiveMarginTab('retail')}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeMarginTab === 'retail'
                                ? 'bg-green-600 text-white shadow-md'
                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            🟢 Varejo
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveMarginTab('reseller')}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeMarginTab === 'reseller'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            🔵 Revenda
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveMarginTab('wholesale')}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeMarginTab === 'wholesale'
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            🟣 Atacado
                        </button>
                    </div>

                    {/* Conteúdo da Tab Ativa */}
                    {activeMarginTab === 'retail' && (
                        <div className="space-y-3">
                            {/* Métricas */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-white p-3 rounded-lg border border-green-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Margem (R$)</label>
                                    <div className="text-lg font-bold text-green-700">
                                        {(() => {
                                            const cost = watch('price_cost') || 0;
                                            const retail = watch('price_retail') || 0;
                                            const marginCents = retail - cost;
                                            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(marginCents / 100);
                                        })()}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Lucro por unidade</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-green-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Margem (%)</label>
                                    <div className="text-lg font-bold text-green-700">
                                        {(() => {
                                            const cost = watch('price_cost') || 0;
                                            const retail = watch('price_retail') || 0;
                                            if (cost === 0) return '0%';
                                            return `${(((retail - cost) / cost) * 100).toFixed(2)}%`;
                                        })()}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Percentual de lucro</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-green-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Markup</label>
                                    <div className="text-lg font-bold text-blue-700">
                                        {(() => {
                                            const cost = watch('price_cost') || 0;
                                            const retail = watch('price_retail') || 0;
                                            if (cost === 0) return '0x';
                                            return `${(retail / cost).toFixed(2)}x`;
                                        })()}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Multiplicador</p>
                                </div>
                            </div>
                            {/* Inputs */}
                            <div className="p-3 bg-white rounded-lg border border-green-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Margem em R$</label>
                                        <CurrencyInput value={0} onChange={(marginCents) => {
                                            const cost = watch('price_cost') || 0;
                                            if (marginCents > 0 && cost > 0) setValue('price_retail', cost + marginCents);
                                        }} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Margem em %</label>
                                        <input type="number" step="0.01" placeholder="Ex: 50" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" onChange={(e) => {
                                            const marginPercent = parseFloat(e.target.value) || 0;
                                            const cost = watch('price_cost') || 0;
                                            if (marginPercent > 0 && cost > 0) setValue('price_retail', Math.round(cost * (1 + marginPercent / 100)));
                                        }} />
                                    </div>
                                </div>
                            </div>
                            {/* Botões Rápidos */}
                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs font-medium text-slate-600">Margem rápida:</span>
                                {[10, 20, 30, 50, 100].map(percent => (
                                    <button key={percent} type="button" onClick={() => {
                                        const cost = watch('price_cost') || 0;
                                        if (cost > 0) setValue('price_retail', Math.round(cost * (1 + percent / 100)));
                                    }} className="px-2 py-1 text-xs font-medium bg-white border border-green-300 text-green-700 rounded hover:bg-green-100 transition-colors">
                                        +{percent}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeMarginTab === 'reseller' && (
                        <div className="space-y-3">
                            {/* Métricas */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-white p-3 rounded-lg border border-blue-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Margem (R$)</label>
                                    <div className="text-lg font-bold text-blue-700">
                                        {(() => {
                                            const cost = watch('price_cost') || 0;
                                            const reseller = watch('price_reseller') || 0;
                                            const marginCents = reseller - cost;
                                            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(marginCents / 100);
                                        })()}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Lucro por unidade</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-blue-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Margem (%)</label>
                                    <div className="text-lg font-bold text-blue-700">
                                        {(() => {
                                            const cost = watch('price_cost') || 0;
                                            const reseller = watch('price_reseller') || 0;
                                            if (cost === 0) return '0%';
                                            return `${(((reseller - cost) / cost) * 100).toFixed(2)}%`;
                                        })()}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Percentual de lucro</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-blue-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Markup</label>
                                    <div className="text-lg font-bold text-blue-700">
                                        {(() => {
                                            const cost = watch('price_cost') || 0;
                                            const reseller = watch('price_reseller') || 0;
                                            if (cost === 0) return '0x';
                                            return `${(reseller / cost).toFixed(2)}x`;
                                        })()}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Multiplicador</p>
                                </div>
                            </div>
                            {/* Inputs */}
                            <div className="p-3 bg-white rounded-lg border border-blue-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Margem em R$</label>
                                        <CurrencyInput value={0} onChange={(marginCents) => {
                                            const cost = watch('price_cost') || 0;
                                            if (marginCents > 0 && cost > 0) setValue('price_reseller', cost + marginCents);
                                        }} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Margem em %</label>
                                        <input type="number" step="0.01" placeholder="Ex: 40" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => {
                                            const marginPercent = parseFloat(e.target.value) || 0;
                                            const cost = watch('price_cost') || 0;
                                            if (marginPercent > 0 && cost > 0) setValue('price_reseller', Math.round(cost * (1 + marginPercent / 100)));
                                        }} />
                                    </div>
                                </div>
                            </div>
                            {/* Botões Rápidos */}
                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs font-medium text-slate-600">Margem rápida:</span>
                                {[10, 15, 20, 25, 30].map(percent => (
                                    <button key={percent} type="button" onClick={() => {
                                        const cost = watch('price_cost') || 0;
                                        if (cost > 0) setValue('price_reseller', Math.round(cost * (1 + percent / 100)));
                                    }} className="px-2 py-1 text-xs font-medium bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-100 transition-colors">
                                        +{percent}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeMarginTab === 'wholesale' && (
                        <div className="space-y-3">
                            {/* Métricas */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-white p-3 rounded-lg border border-purple-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Margem (R$)</label>
                                    <div className="text-lg font-bold text-purple-700">
                                        {(() => {
                                            const cost = watch('price_cost') || 0;
                                            const wholesale = watch('price_wholesale') || 0;
                                            const marginCents = wholesale - cost;
                                            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(marginCents / 100);
                                        })()}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Lucro por unidade</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-purple-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Margem (%)</label>
                                    <div className="text-lg font-bold text-purple-700">
                                        {(() => {
                                            const cost = watch('price_cost') || 0;
                                            const wholesale = watch('price_wholesale') || 0;
                                            if (cost === 0) return '0%';
                                            return `${(((wholesale - cost) / cost) * 100).toFixed(2)}%`;
                                        })()}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Percentual de lucro</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-purple-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Markup</label>
                                    <div className="text-lg font-bold text-purple-700">
                                        {(() => {
                                            const cost = watch('price_cost') || 0;
                                            const wholesale = watch('price_wholesale') || 0;
                                            if (cost === 0) return '0x';
                                            return `${(wholesale / cost).toFixed(2)}x`;
                                        })()}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Multiplicador</p>
                                </div>
                            </div>
                            {/* Inputs */}
                            <div className="p-3 bg-white rounded-lg border border-purple-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Margem em R$</label>
                                        <CurrencyInput value={0} onChange={(marginCents) => {
                                            const cost = watch('price_cost') || 0;
                                            if (marginCents > 0 && cost > 0) setValue('price_wholesale', cost + marginCents);
                                        }} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Margem em %</label>
                                        <input type="number" step="0.01" placeholder="Ex: 15" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" onChange={(e) => {
                                            const marginPercent = parseFloat(e.target.value) || 0;
                                            const cost = watch('price_cost') || 0;
                                            if (marginPercent > 0 && cost > 0) setValue('price_wholesale', Math.round(cost * (1 + marginPercent / 100)));
                                        }} />
                                    </div>
                                </div>
                            </div>
                            {/* Botões Rápidos */}
                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs font-medium text-slate-600">Margem rápida:</span>
                                {[5, 10, 15, 20, 25].map(percent => (
                                    <button key={percent} type="button" onClick={() => {
                                        const cost = watch('price_cost') || 0;
                                        if (cost > 0) setValue('price_wholesale', Math.round(cost * (1 + percent / 100)));
                                    }} className="px-2 py-1 text-xs font-medium bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 transition-colors">
                                        +{percent}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. IMAGENS */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 mb-4">Imagens</h3>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                    {imagePreviews.map((src, index) => (
                        <div key={index} className="relative aspect-square group">
                            <img src={src} alt="Preview" className="w-full h-full object-cover rounded-lg border border-slate-200" />
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    <label className={`flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-50 transition-colors ${isCompressing ? 'opacity-50 cursor-wait' : ''}`}>
                        {isCompressing ? <Loader2 className="animate-spin text-blue-500" /> : <Upload className="text-slate-400 mb-1" />}
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={isCompressing} />
                    </label>
                </div>
            </div >

            {/* 5. FISCAL & AUTOMAÇÃO */}
            < div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4" >
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-slate-500" />
                    Fiscal & Automação
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">NCM (8 dígitos)</label>
                        <input
                            {...register('ncm')}
                            maxLength={8}
                            placeholder="12345678"
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '') }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">CEST (7 dígitos)</label>
                        <input
                            {...register('cest')}
                            maxLength={7}
                            placeholder="1234567"
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '') }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Origem da Mercadoria</label>
                        <select
                            {...register('origin')}
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="">Selecione...</option>
                            <option value="0">0 - Nacional</option>
                            <option value="1">1 - Estrangeira (Importação Direta)</option>
                            <option value="2">2 - Estrangeira (Adq. no Mercado Interno)</option>
                        </select>
                    </div>
                </div>
            </div >

            {/* 6. LOGÍSTICA */}
            < div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4" >
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Package size={18} className="text-slate-500" />
                    Logística & Expedição
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Peso (kg)</label>
                        <input
                            type="number" step="0.001"
                            {...register('weight_kg', { valueAsNumber: true })}
                            placeholder="0.000"
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Largura (cm)</label>
                        <input
                            type="number" step="0.1"
                            {...register('dimensions.width_cm', { valueAsNumber: true })}
                            placeholder="0.0"
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Altura (cm)</label>
                        <input
                            type="number" step="0.1"
                            {...register('dimensions.height_cm', { valueAsNumber: true })}
                            placeholder="0.0"
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Profundidade (cm)</label>
                        <input
                            type="number" step="0.1"
                            {...register('dimensions.depth_cm', { valueAsNumber: true })}
                            placeholder="0.0"
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div >

            {/* 7. CONTROLE DE ESTOQUE */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Package size={18} className="text-blue-600" />
                    Controle de Estoque
                </h3>

                {/* Toggle: Monitorar Estoque */}
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <input
                        type="checkbox"
                        checked={watch('track_inventory') ?? true}
                        onChange={(e) => setValue('track_inventory', e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div>
                        <label className="font-medium text-slate-700 cursor-pointer">
                            Monitorar Estoque
                        </label>
                        <p className="text-xs text-slate-500">
                            Desmarque para produtos sem controle de estoque (serviços, sob encomenda)
                        </p>
                    </div>
                </div>

                {/* Campo: Quantidade em Estoque */}
                {watch('track_inventory') !== false && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Quantidade em Estoque *
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            {...register('stock_quantity', { valueAsNumber: true })}
                            placeholder="Ex: 10"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {errors.stock_quantity && (
                            <p className="text-xs text-red-600 mt-1">{errors.stock_quantity.message}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                            Quantidade disponível para venda
                        </p>
                    </div>
                )}
            </div>

            {/* 8. STATUS */}
            < div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" >
                <label className="block text-sm font-medium text-slate-700 mb-1">Status do Produto</label>
                <select
                    {...register('status')}
                    className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    <option value="active">Ativo (Visível)</option>
                    <option value="inactive">Inativo (Oculto)</option>
                    <option value="archived">Arquivado</option>
                </select>
            </div >

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isLoading || isCompressing || isDuplicateEAN}
                    className={`px-4 py-2 text-white text-sm font-medium rounded-md shadow-lg transition-colors ${isDuplicateEAN
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                        } disabled:opacity-50`}
                >
                    {isDuplicateEAN ? '⚠️ EAN Duplicado - Não Permitido' : isLoading ? 'Salvando...' : 'Salvar Produto'}
                </button>
            </div>
        </form >
    );
}
