import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
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
import { useEANAutofill } from './hooks/useEANAutofill';
import { ProductSpecifications } from './sections/ProductSpecifications';
import { ProductPricing } from './sections/ProductPricing';
import { ProductImages } from './sections/ProductImages';
import { ProductBasicInfo } from './sections/ProductBasicInfo';

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

    // Estado para rastrear se o nome foi editado manualmente
    const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

    // Estado para indicadores de preço
    const [priceStats, setPriceStats] = useState<{
        lastPurchasePrice: number | null;
        averageStockPrice: number | null;
    }>({ lastPurchasePrice: null, averageStockPrice: null });

    // useForm DEVE vir ANTES de useEANAutofill
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
        defaultValues: {
            status: 'active',
            images: [],
            specs: {},
            origin: '0', // Padrão Nacional
            price_cost: 0,
            price_retail: 0,
            price_reseller: 0,
            price_wholesale: 0,
            ...initialData // Spread initialData AFTER defaults to override with actual values
        }
    });

    // DEBUG: Log initialData to see what's coming from database
    useEffect(() => {
        if (initialData) {
            console.log('🔍 ProductForm initialData:', initialData);
            console.log('💰 price_cost value:', initialData.price_cost);
            console.log('💰 price_retail value:', initialData.price_retail);
        }
    }, [initialData]);

    // EAN auto-fill hook (DEPOIS do useForm)
    const {
        isSearchingEAN,
        eanSearchMessage,
        isDuplicateEAN,
        existingProduct,
        searchByEAN
    } = useEANAutofill({ watch, setValue, initialData });

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

    // 1. Função para carregar as regras da categoria
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

    // 2. Efeito para carregar as regras quando a Categoria muda
    useEffect(() => {
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
        searchByEAN();
    }, [watch('eans')]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;

        const MAX_IMAGES = 5;
        const currentImages = getValues('images') || [];

        // Check if already at limit
        if (currentImages.length >= MAX_IMAGES) {
            alert(`Limite de ${MAX_IMAGES} imagens atingido. Remova uma imagem para adicionar outra.`);
            e.target.value = ''; // Reset input
            return;
        }

        setIsCompressing(true);
        const files = Array.from(e.target.files);

        // Calculate how many images we can still add
        const remainingSlots = MAX_IMAGES - currentImages.length;
        const filesToProcess = files.slice(0, remainingSlots);

        if (files.length > remainingSlots) {
            alert(`Você selecionou ${files.length} imagens, mas só há espaço para ${remainingSlots}. Apenas as primeiras ${remainingSlots} serão adicionadas.`);
        }

        try {
            const processedImages: string[] = [];
            for (const file of filesToProcess) {
                const compressed = await compressImage(file);

                // Convert to base64 for permanent storage
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(compressed);
                });

                const base64String = await base64Promise;
                processedImages.push(base64String);
            }
            const newImages = [...currentImages, ...processedImages];
            setValue('images', newImages);
            setImagePreviews(newImages);
        } catch (error) {
            alert('Erro ao processar imagens');
        } finally {
            setIsCompressing(false);
            e.target.value = ''; // Reset input
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

    // Wrapper para onSubmit que mostra toast de erro
    const handleFormSubmit = handleSubmit(
        onSubmit,
        (errors) => {
            console.error('Validation errors:', errors);

            // Log detalhado de cada erro
            console.group('🔴 ERROS DE VALIDAÇÃO DETALHADOS:');
            Object.entries(errors).forEach(([field, error]) => {
                console.error(`  ❌ ${field}:`, error?.message || error);
            });
            console.groupEnd();

            // Conta quantos campos têm erro
            const errorCount = Object.keys(errors).length;

            // Mostra toast com mensagem específica
            if (errorCount > 0) {
                toast.error(
                    `Preencha todos os campos obrigatórios (${errorCount} ${errorCount === 1 ? 'campo' : 'campos'} com erro)`,
                    {
                        duration: 5000,
                        description: 'Verifique os campos destacados em vermelho'
                    }
                );
            }
        }
    );

    return (
        <form onSubmit={handleFormSubmit} className="space-y-6 pb-20">
            {/* 0. SCANNER DE CÓDIGO DE BARRAS + 1. INFORMAÇÕES BÁSICAS */}
            <ProductBasicInfo
                watch={watch}
                setValue={setValue}
                control={control}
                errors={errors}
                selectedCategoryId={selectedCategoryId}
                selectedBrandId={selectedBrandId}
                eanSearchMessage={eanSearchMessage}
                isDuplicateEAN={isDuplicateEAN}
                existingProduct={existingProduct}
                isSearchingEAN={isSearchingEAN}
                handleAddAlternativeEAN={handleAddAlternativeEAN}
            />

            {/* 2. ESPECIFICAÇÕES TÉCNICAS */}
            <ProductSpecifications
                categoryConfig={categoryConfig}
                watch={watch}
                setValue={setValue}
                errors={errors}
                onRefresh={loadCategoryConfig}
            />

            {/* 3. PRECIFICAÇÃO */}
            <ProductPricing watch={watch} setValue={setValue} />

            {/* 4. IMAGENS */}
            <ProductImages
                imagePreviews={imagePreviews}
                isCompressing={isCompressing}
                handleImageUpload={handleImageUpload}
                removeImage={removeImage}
            />

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

                {/* Info box with postal limits */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm mb-4">
                    <p className="font-medium text-blue-900 mb-1">📦 Limites dos Correios</p>
                    <p className="text-blue-700 text-xs">
                        Peso: até 30kg • Dimensões: 16-105cm (C), até 105cm (L+A), até 200cm (C+L+A)
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Peso (kg)</label>
                        <input
                            type="number" step="0.001"
                            {...register('weight_kg', { valueAsNumber: true })}
                            placeholder="0.000"
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            💡 Ex: 1.5 (um quilo e meio) ou 0.250 (250 gramas)
                        </p>
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
            < div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4" >
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
                {
                    watch('track_inventory') !== false && (
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
                    )
                }
            </div >

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
