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
import { Loader2, X, Upload, ChevronDown, ChevronUp, Package, FileText, Trash2, CheckCircle2, ListOrdered, Globe, AlertCircle } from 'lucide-react';
import { useEANAutofill } from './hooks/useEANAutofill';
import { useModelTemplate } from './hooks/useModelTemplate';
import { ProductSpecifications } from './sections/ProductSpecifications';
import { ProductPricing } from './sections/ProductPricing';
import { ProductImages } from './sections/ProductImages';
import { ProductBasicInfo } from './sections/ProductBasicInfo';
import { ProductWarranty } from './sections/ProductWarranty';
import { ProductSEO } from './sections/ProductSEO';
import { Model } from '../../types/model';
import { modelService } from '../../services/models';
import { averagePriceService } from '../../services/averagePriceService';
import { modelColorImagesService } from '../../services/model-color-images';
import { colorService } from '../../services/colors';
import { BlingLinkSection } from './sections/BlingLinkSection';
import { ShopeeLinkSection } from './sections/ShopeeLinkSection';
import { ProductKitsSection } from './sections/ProductKitsSection';

interface ProductFormProps {
    initialData?: Product;
    onSubmit: (data: ProductInput) => Promise<void>;
    onCancel: () => void;
    onBatchComplete?: () => void;
    isLoading?: boolean;
}

export function ProductForm({ initialData, onSubmit, onCancel, onBatchComplete, isLoading }: ProductFormProps) {
    const [imagePreviews, setImagePreviews] = useState<string[]>(initialData?.images || []);
    const [isCompressing, setIsCompressing] = useState(false);
    const [blingId, setBlingId] = useState<number | undefined>(initialData?.bling_id);
    const [blingParentId, setBlingParentId] = useState<number | undefined>(initialData?.bling_parent_id);
    const [shopeeItemId, setShopeeItemId] = useState<number | undefined>(initialData?.shopee_item_id);

    // Estado para armazenar as regras da categoria (Traffic Light)
    const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

    // Estado para rastrear se o nome foi editado manualmente
    const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

    // Lista de produtos para entrada em massa
    interface BatchItem {
        imei1?: string;
        imei2?: string;
        serial?: string;
        color?: string;
        storage?: string;
        ram?: string;
    }
    const [serialList, setSerialList] = useState<BatchItem[]>([]);

    const handleAddToBatchList = () => {
        const item: BatchItem = {
            imei1: watch('specs.imei1') || undefined,
            imei2: watch('specs.imei2') || undefined,
            serial: watch('specs.serial') || undefined,
            color: watch('specs.color') || undefined,
            storage: watch('specs.storage') || undefined,
            ram: watch('specs.ram') || undefined,
        };

        // Precisa ao menos de IMEI1 ou Serial
        if (!item.imei1 && !item.serial) {
            toast.warning('Preencha ao menos o IMEI 1 ou o Serial antes de adicionar.');
            return;
        }

        // Evita duplicatas por IMEI1 ou Serial
        const isDuplicate = serialList.some(existing =>
            (item.imei1 && existing.imei1 === item.imei1) ||
            (item.serial && existing.serial === item.serial)
        );
        if (isDuplicate) {
            toast.warning('Este produto (IMEI/Serial) já está na lista.');
            return;
        }

        // Adiciona à lista e limpa os campos únicos
        setSerialList(prev => [...prev, item]);
        setValue('specs.imei1', '');
        setValue('specs.imei2', '');
        setValue('specs.serial', '');
        setValue('specs.color', '');
        setValue('specs.storage', '');
        setValue('specs.ram', '');
        toast.success('Produto adicionado à lista!');
    };

    const removeFromSerialList = (index: number) => {
        setSerialList(prev => prev.filter((_, i) => i !== index));
    };

    // Estado para indicadores de preço
    const [priceStats, setPriceStats] = useState<{
        lastPurchasePrice: number | null;
        averageStockPrice: number | null;
    }>({ lastPurchasePrice: null, averageStockPrice: null });

    // useForm DEVE vir ANTES de useEANAutofill
    const {
        handleSubmit,
        setValue,
        getValues,
        watch,
        control,
        register,
        reset,
        formState: { errors }
    } = useForm<ProductInput>({
        resolver: zodResolver(productSchema) as any,
        defaultValues: {
            model_id: '',
            name: '',
            sku: '',
            status: 'active',
            images: [],
            specs: {},
            origin: '0' as any, // Padrão Nacional
            price_cost: 0,
            price_retail: 0,
            price_reseller: 0,
            price_wholesale: 0,
            track_inventory: true,
            stock_quantity: 0,
            warranty_type: 'brand', // Default to brand warranty
            warranty_template_id: '',
            ...initialData // Spread initialData AFTER defaults to override with actual values
        }
    });

    // Reset form when initialData changes (for edit mode)
    useEffect(() => {
        if (initialData) {
            console.log('🔍 [ProductForm] initialData:', initialData);
            console.log('🛡️ [ProductForm] warranty_type:', initialData.warranty_type);
            console.log('🛡️ [ProductForm] warranty_template_id:', initialData.warranty_template_id);
            console.log('💰 price_cost value:', initialData.price_cost);
            console.log('💰 price_retail value:', initialData.price_retail);
            console.log('📦 specs value:', initialData.specs);
            console.log('📦 specs type:', typeof initialData.specs);
            console.log('📦 specs keys:', initialData.specs ? Object.keys(initialData.specs) : 'NO SPECS');
            console.log('🔄 Resetting form with initialData...');
            reset(initialData);
            
            // 🔥 CRITICAL: Update external IDs state when initialData arrives asynchronously
            setBlingId(initialData.bling_id || undefined);
            setBlingParentId(initialData.bling_parent_id || undefined);
            setShopeeItemId(initialData.shopee_item_id || undefined);

            // Em modo edição, carregar o modelo explicitamente para que templateValues
            // esteja disponível e ocultando campos que vêm do modelo (battery_mah, display, etc.)
            if (initialData.model) {
                modelService.listActive().then(models => {
                    const model = models.find(m => m.name === initialData.model);
                    if (model) {
                        setSelectedModel(model);
                        console.log('🎯 [edit mode] Model pre-loaded:', model.name);
                    }
                }).catch(() => {/* silently ignore */ });
            }
        }
    }, [initialData, reset]);

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

    // Warranty states
    const [brandWarrantyDays, setBrandWarrantyDays] = useState<number | null>(null);
    const [categoryWarrantyDays, setCategoryWarrantyDays] = useState<number | null>(null);

    // Model template state
    const [selectedModel, setSelectedModel] = useState<Model | undefined>(undefined);
    const selectedModelName = watch('model');

    // Load brand ID and warranty days when brand name changes
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
                console.error('Error loading brand data:', error);
            }
        };
        loadBrandData();
    }, [selectedBrand]);

    // Load model data and template when model changes
    useEffect(() => {
        const loadModelData = async () => {
            if (!selectedModelName) {
                setSelectedModel(undefined);
                return;
            }
            try {
                const models = await modelService.listActive();
                const model = models.find(m => m.name === selectedModelName);
                setSelectedModel(model);
                console.log('🎯 Model selected:', model);
            } catch (error) {
                console.error('Error loading model data:', error);
            }
        };
        loadModelData();
    }, [selectedModelName]);

    // Apply model template when model is selected (skip in edit mode to avoid overwriting existing data)
    useModelTemplate(selectedModel, setValue, !!initialData);

    // Auto-load default images when model + color are selected
    const selectedColor = watch('specs.color');
    const [useCustomImages, setUseCustomImages] = useState(!!initialData?.images?.length);

    useEffect(() => {
        const loadDefaultImages = async () => {
            // Skip if:
            // - No model or color selected
            // - User wants custom images
            // - Already has images (editing existing product)
            if (!selectedModel?.id || !selectedColor || useCustomImages || initialData) {
                return;
            }

            try {
                console.log('📸 Loading default images for:', selectedModel.name, selectedColor);

                // Get color ID from color name
                const { colorService } = await import('../../services/colors');
                const colors = await colorService.list();
                const colorObj = colors.find(c => c.name === selectedColor);

                if (!colorObj) {
                    console.log('⚠️ Color not found:', selectedColor);
                    return;
                }

                // Load default images
                const defaultImages = await modelColorImagesService.get(selectedModel.id, colorObj.id);

                if (defaultImages?.images && defaultImages.images.length > 0) {
                    console.log('✅ Loaded', defaultImages.images.length, 'default images');
                    setValue('images', defaultImages.images);
                    setImagePreviews(defaultImages.images);
                } else {
                    console.log('ℹ️ No default images found for this variation');
                }
            } catch (error) {
                console.error('Error loading default images:', error);
            }
        };

        loadDefaultImages();
    }, [selectedModel?.id, selectedColor, useCustomImages, initialData]);

    // 1. Função para carregar as regras da categoria
    const loadCategoryConfig = async () => {
        if (!selectedCategoryId) {
            setCategoryConfig(null);
            setCategoryWarrantyDays(null);
            return;
        }
        try {
            const category = await categoryService.getById(selectedCategoryId);
            if (category) {
                console.log("Config carregada:", category.config); // Debug
                setCategoryConfig(category.config);
                setCategoryWarrantyDays(category.warranty_days || 90);
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
        // Em modo de edição, nunca sobrescrever o nome existente
        if (initialData) return;
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
            // Note: EAN state is managed internally by useEANAutofill hook

            // Opcional: redirecionar para a página do produto
            // window.location.href = `/admin/products/${existingProduct.id}`;
        } catch (error) {
            console.error('Error adding alternative EAN:', error);
            alert('❌ Erro ao adicionar EAN alternativo');
        }
    };

    const handleGenerateSynologyLink = async () => {
        const sku = watch('sku');
        if (!sku) {
            toast.warning('Preencha o SKU primeiro para gerar o link do vídeo.');
            return;
        }
        try {
            const { companySettingsService } = await import('../../services/companySettingsService');
            const settings = await companySettingsService.get() as any;
            const videoBaseUrl = settings?.synology_video_base_url || settings?.synologyVideoBaseUrl;
            
            if (!videoBaseUrl) {
                toast.error('URL base do Synology não configurada nas Definições da Empresa.');
                return;
            }

            const ext = settings?.synologyVideoExtension || settings?.synology_video_extension || '.mp4';
            const baseUrl = videoBaseUrl.endsWith('/') ? videoBaseUrl : `${videoBaseUrl}/`;
            const videoUrl = `${baseUrl}${sku.replace(/\s+/g, '')}${ext}`;
            
            setValue('video_url', videoUrl, { shouldDirty: true, shouldValidate: true });
            toast.success('Link do vídeo gerado com sucesso!');
        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.error('Erro ao buscar definições da Empresa.');
        }
    };

    // Auto-preenche o video_url sempre que o SKU mudar (se estiver vazio ou se for no mesmo domínio do Synology)
    const currentSkuForVideo = watch('sku');
    useEffect(() => {
        if (!currentSkuForVideo) return;

        const autoFillVideoUrl = async () => {
            try {
                const { companySettingsService } = await import('../../services/companySettingsService');
                const settings = await companySettingsService.get() as any;
                const videoBaseUrl = settings?.synology_video_base_url || settings?.synologyVideoBaseUrl;
                if (!videoBaseUrl) return;

                const ext = settings?.synologyVideoExtension || settings?.synology_video_extension || '.mp4';
                const baseUrl = videoBaseUrl.endsWith('/') ? videoBaseUrl : `${videoBaseUrl}/`;
                const candidateUrl = `${baseUrl}${currentSkuForVideo.replace(/\s+/g, '')}${ext}`;

                const currentVideoUrl = getValues('video_url');
                
                // Se for idêntico, não faz nada
                if (currentVideoUrl === candidateUrl) return;

                // Se não estiver vazio e também não for do Synology (ex: link do YouTube), preserva
                if (currentVideoUrl && !currentVideoUrl.startsWith(videoBaseUrl)) return;

                // Verifica se o arquivo realmente existe (opcional no form pra não travar)
                const response = await fetch(candidateUrl, { method: 'HEAD', cache: 'no-store' });
                if (response.ok) {
                    setValue('video_url', candidateUrl, { shouldDirty: true });
                    toast.info(`🎥 Vídeo vinculado automaticamente pelo SKU.`, { id: 'video-auto-fill' });
                } else if (!currentVideoUrl) {
                    // preenche mesmo se não der HTTP 200, pois pode existir na rede interna e a gente assume o formato
                    setValue('video_url', candidateUrl, { shouldDirty: true });
                }
            } catch {
                // Silencioso
            }
        };

        const timer = setTimeout(autoFillVideoUrl, 800);
        return () => clearTimeout(timer);
    }, [currentSkuForVideo, setValue, getValues]);

    // Wrapper para onSubmit que mostra toast de erro e calcula preço médio
    const handleFormSubmit = handleSubmit(
        async (data) => {
            console.log('🔍 [ProductForm] Form data received:', data);
            console.log('  - model_id:', data.model_id);
            console.log('  - brand:', data.brand);
            console.log('  - category_id:', data.category_id);
            console.log('  - model:', data.model);
            console.log('  - sku:', data.sku);
            console.log('🛡️ [ProductForm] WARRANTY FIELDS:');
            console.log('  - warranty_type:', data.warranty_type);
            console.log('  - warranty_template_id:', data.warranty_template_id);

            // 0. Buscar modelo selecionado para pegar template_values
            let mergedData = { ...data };

            // CRITICAL FIX: Manually add un-registered fields from watch() since they're not in data
            const currentWarrantyType = watch('warranty_type');
            const currentWarrantyTemplateId = watch('warranty_template_id');
            const currentVideoUrl = watch('video_url');
            
            // Injeção dos campos não registrados de SEO
            const currentExcludeFromSeo = watch('exclude_from_seo');
            const currentDescription = watch('description');
            const currentSlug = watch('slug');
            const currentMetaTitle = watch('meta_title');
            const currentMetaDescription = watch('meta_description');
            const currentKeywords = watch('keywords');

            console.log('🔧 [ProductForm] MANUAL INJECTIONS:');
            console.log('  - watch(warranty_type):', currentWarrantyType);
            console.log('  - watch(warranty_template_id):', currentWarrantyTemplateId);
            console.log('  - watch(video_url):', currentVideoUrl);
            console.log('  - watch(meta_title):', currentMetaTitle);

            mergedData.warranty_type = currentWarrantyType || 'brand';
            mergedData.warranty_template_id = currentWarrantyTemplateId || null;
            mergedData.video_url = currentVideoUrl || null;
            mergedData.exclude_from_seo = currentExcludeFromSeo || false;
            mergedData.description = currentDescription || null;
            mergedData.slug = currentSlug || null;
            mergedData.meta_title = currentMetaTitle || null;
            mergedData.meta_description = currentMetaDescription || null;
            mergedData.keywords = currentKeywords || null;

            if (data.model) {
                try {
                    const models = await modelService.listActive();
                    const model = models.find(m => m.name === data.model);

                    if (model?.template_values) {
                        console.log('📋 Merging template values from model:', model.name);

                        // Merge dimensions from template if not manually filled
                        if (!data.dimensions || Object.keys(data.dimensions).length === 0) {
                            mergedData.dimensions = {
                                width_cm: model.template_values['dimensions.width_cm'],
                                height_cm: model.template_values['dimensions.height_cm'],
                                depth_cm: model.template_values['dimensions.depth_cm']
                            };
                            console.log('✅ Applied dimensions from template:', mergedData.dimensions);
                        }

                        // Merge weight from template if not filled
                        if (!data.weight_kg) {
                            mergedData.weight_kg = model.template_values.weight_kg;
                            console.log('✅ Applied weight from template:', mergedData.weight_kg);
                        }

                        // Auto-generate SKU if empty — baseado no modelo+config para ser consistente
                        if (!data.sku || data.sku.trim() === '') {
                            const brandPrefix = data.brand?.substring(0, 2).toUpperCase() || 'XX';
                            const modelPrefix = model.name.replace(/\s+/g, '').toUpperCase();
                            const colorPart = data.specs?.color ? `-${data.specs.color.substring(0, 2).toUpperCase()}` : '';
                            const ramPart = data.specs?.ram ? `-${String(data.specs.ram).replace(/\s+/g, '')}` : '';
                            const storagePart = data.specs?.storage ? `-${String(data.specs.storage).replace(/\s+/g, '')}` : '';
                            mergedData.sku = `${brandPrefix}-${modelPrefix}${colorPart}${ramPart}${storagePart}`;
                            console.log('✅ Auto-generated base SKU:', mergedData.sku);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching model for template merge:', error);
                    // Continue without template merge
                }
            }

            // Clear stock_quantity if not tracking inventory
            if (!mergedData.track_inventory) {
                mergedData.stock_quantity = undefined;
                console.log('✅ Cleared stock_quantity (inventory tracking disabled)');
            }

            // Inject external integration IDs
            mergedData.bling_id = blingId;
            mergedData.bling_parent_id = blingParentId;
            mergedData.shopee_item_id = shopeeItemId;

            // 1. Salvar produto(s)
            console.log('📤 [ProductForm] Sending to onSubmit:', mergedData);

            if (serialList.length > 0) {
                // Entrada em massa: verificar unicidade de todos antes de salvar qualquer um
                const { supabase } = await import('../../services/supabase');
                const duplicates: string[] = [];

                for (const item of serialList) {
                    const fieldsToCheck: { key: 'imei1' | 'imei2' | 'serial'; label: string }[] = [
                        { key: 'imei1', label: 'IMEI 1' },
                        { key: 'imei2', label: 'IMEI 2' },
                        { key: 'serial', label: 'Serial' },
                    ];
                    for (const { key, label } of fieldsToCheck) {
                        const val = item[key];
                        if (!val) continue;
                        const { data: existing } = await supabase
                            .from('products')
                            .select('id')
                            .eq(`specs->>${key}`, val)
                            .limit(1);
                        if (existing && existing.length > 0) {
                            duplicates.push(`${label}: ${val}`);
                        }
                    }
                }

                if (duplicates.length > 0) {
                    toast.error(`Cadastro bloqueado: ${duplicates.length} item(s) já existem no sistema`, {
                        description: duplicates.join(' | '),
                        duration: 8000
                    });
                    return;
                }

                // Carregar cores uma vez antes do loop para resolver nome → UUID
                const allColors = await colorService.listActive().catch(() => []);

                // Todos únicos — salvar um por um
                for (const item of serialList) {
                    // Resolver imagens da cor específica do item
                    let itemImages = mergedData.images || [];
                    if (item.color && mergedData.model_id) {
                        const colorEntry = allColors.find(c => c.name === item.color);
                        if (colorEntry) {
                            try {
                                const colorImgs = await modelColorImagesService.get(mergedData.model_id, colorEntry.id);
                                if (colorImgs && colorImgs.images.length > 0) {
                                    itemImages = colorImgs.images;
                                }
                            } catch {
                                // Fallback: mantém imagens do formulário
                            }
                        }
                    }

                    const itemData = {
                        ...mergedData,
                        images: itemImages,
                        specs: {
                            ...mergedData.specs,
                            imei1: item.imei1,
                            imei2: item.imei2,
                            serial: item.serial,
                            color: item.color,
                            storage: item.storage,
                            ram: item.ram,
                        }
                    };
                    await onSubmit(itemData);
                }
                toast.success(`${serialList.length} produto(s) cadastrado(s) com sucesso!`);
                setSerialList([]);
                onBatchComplete?.();
            } else {
                // Produto único — verificar serial/IMEI do campo se preenchido
                const { supabase } = await import('../../services/supabase');
                const uniqueFields = ['serial', 'imei1', 'imei2'] as const;
                for (const field of uniqueFields) {
                    const val = mergedData.specs?.[field];
                    if (val) {
                        let query = supabase
                            .from('products')
                            .select('id')
                            .eq(`specs->>${field}`, val);

                        // Em modo edição, exclui o próprio produto da verificação
                        if (initialData?.id) {
                            query = query.neq('id', initialData.id);
                        }

                        const { data: existing } = await query.limit(1);
                        if (existing && existing.length > 0) {
                            toast.error(`${field === 'imei1' ? 'IMEI 1' : field === 'imei2' ? 'IMEI 2' : 'Serial'} já cadastrado no sistema: ${val}`);
                            return;
                        }
                    }
                }
                await onSubmit(mergedData);
                toast.success('Produto cadastrado com sucesso!');
                onBatchComplete?.();
            }

            // 2. Calcular preço médio se for novo produto com variação
            if (!initialData && selectedBrandId && mergedData.specs?.ram && mergedData.specs?.storage) {
                try {
                    console.log('📊 Calculating average prices...');
                    const result = await averagePriceService.updateAveragePrices({
                        ...mergedData,
                        model_id: selectedBrandId // Usar brand_id como model_id temporariamente
                    });

                    if (result && result.previousStock > 0) {
                        // Mostrar feedback de preços atualizados
                        const costChange = result.averages.price_cost.priceChange;
                        const retailChange = result.averages.price_retail.priceChange;

                        toast.success(
                            `📊 Preços médios atualizados!`,
                            {
                                duration: 5000,
                                description: `Estoque: ${result.previousStock} → ${result.newStock} unidades\nCusto: ${costChange >= 0 ? '+' : ''}R$ ${costChange.toFixed(2)}\nVarejo: ${retailChange >= 0 ? '+' : ''}R$ ${retailChange.toFixed(2)}`
                            }
                        );
                    }
                } catch (error) {
                    console.error('Error calculating average prices:', error);
                    // Não bloqueia o salvamento, apenas loga o erro
                }
            }
        },
        (errors) => {
            console.error('Validation errors:', errors);

            // Função recursiva para extrair erros aninhados
            const extractErrors = (obj: any, path: string = ''): string[] => {
                let errList: string[] = [];
                for (const key in obj) {
                    const newPath = path ? `${path}.${key}` : key;
                    const value = obj[key];
                    if (value && value.message) {
                        errList.push(`- ${newPath}: ${value.message}`);
                    } else if (typeof value === 'object' && value !== null) {
                        errList = errList.concat(extractErrors(value, newPath));
                    }
                }
                return errList;
            };

            const flatErrors = extractErrors(errors);

            // Log detalhado de cada erro
            console.group('🔴 ERROS DE VALIDAÇÃO DETALHADOS:');
            flatErrors.forEach((err) => {
                console.error(err);
            });
            console.groupEnd();

            // Mostra toast com mensagem específica
            if (flatErrors.length > 0) {
                toast.error(
                    `Falha de Validação (${flatErrors.length} campo${flatErrors.length === 1 ? '' : 's'})`,
                    {
                        duration: 8000,
                        description: `Verifique os seguintes campos:\n${flatErrors.join('\n')}`
                    }
                );
            }
        }
    );

    // Dynamic error extraction for the UI banner
    const extractValidationErrors = (obj: any, path: string = ''): string[] => {
        let errList: string[] = [];
        for (const key in obj) {
            const newPath = path ? `${path}.${key}` : key;
            const value = obj[key];
            if (value && value.message) {
                // Translator keys mapping if needed, otherwise raw path
                errList.push(`${newPath}: ${value.message}`);
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                errList = errList.concat(extractValidationErrors(value, newPath));
            } else if (Array.isArray(value)) {
                value.forEach((v, index) => {
                   if (typeof v === 'object' && v !== null) {
                       errList = errList.concat(extractValidationErrors(v, `${newPath}[${index}]`));
                   } else if(v && v.message) {
                       errList.push(`${newPath}[${index}]: ${v.message}`);
                   }
                });
            }
        }
        return errList;
    };

    const hasValidationErrors = Object.keys(errors).length > 0;
    const validationErrorList = hasValidationErrors ? extractValidationErrors(errors) : [];

    return (
        <form onSubmit={handleFormSubmit} className="space-y-6 pb-20">
            {hasValidationErrors && validationErrorList.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-2">
                        <AlertCircle size={18} className="text-red-600" />
                        Erros de Validação Encontrados ({validationErrorList.length})
                    </h3>
                    <p className="text-sm text-red-700 mb-2">
                        Por favor, corrija os seguintes campos antes de salvar:
                    </p>
                    <ul className="list-disc pl-5 text-sm font-medium text-red-700 space-y-1">
                        {validationErrorList.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 0. SCANNER EAN + MODELO + DADOS DO TEMPLATE */}
            <ProductBasicInfo
                watch={watch}
                setValue={setValue}
                control={control}
                errors={errors}
                initialData={initialData}
                onModelSelected={(model) => setSelectedModel(model ?? undefined)}
            />

            {/* 1. TIPO DE PRODUTO */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Globe size={18} className="text-blue-600" />
                    Tipo de Produto
                </h3>
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                    <input
                        type="checkbox"
                        checked={watch('is_virtual') ?? false}
                        onChange={(e) => setValue('is_virtual', e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="flex-1">
                        <label className="font-medium text-slate-700 cursor-pointer" onClick={() => setValue('is_virtual', !(watch('is_virtual') ?? false))}>
                            Produto Virtual / Digital
                        </label>
                        <p className="text-xs text-slate-500 mt-1">
                            Marque esta opção se o produto for um serviço, garantia estendida, assinatura ou arquivo digital.<br/>
                            <strong>Produtos virtuais não exigem peso, dimensões ou controle rígido de estoque para finalização de compra.</strong>
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. ESPECIFICAÇÕES TÉCNICAS */}
            <ProductSpecifications
                categoryConfig={categoryConfig}
                watch={watch}
                setValue={setValue}
                errors={errors}
                onRefresh={loadCategoryConfig}
                templateValues={selectedModel?.template_values}
                currentProductId={initialData?.id}
            />

            {/* BOTÃO ADICIONAR À LISTA + LISTA DE CADASTRO EM MASSA */}
            {!initialData && (
                <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm space-y-3">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <ListOrdered size={18} className="text-blue-600" />
                        Lista para Cadastro em Massa
                        <span className="ml-auto text-sm font-normal text-slate-500">{serialList.length} {serialList.length === 1 ? 'item' : 'itens'}</span>
                    </h3>

                    {serialList.length > 0 && (
                        <div className="space-y-2">
                            {serialList.map((item, index) => (
                                <div key={index} className="flex items-start gap-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                                    <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                                    <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                        {item.imei1 && <span><span className="text-xs text-slate-400 font-medium uppercase mr-1">IMEI 1</span><span className="font-mono text-slate-800">{item.imei1}</span></span>}
                                        {item.imei2 && <span><span className="text-xs text-slate-400 font-medium uppercase mr-1">IMEI 2</span><span className="font-mono text-slate-800">{item.imei2}</span></span>}
                                        {item.serial && <span><span className="text-xs text-slate-400 font-medium uppercase mr-1">SERIAL</span><span className="font-mono text-slate-800">{item.serial}</span></span>}
                                        {item.color && <span><span className="text-xs text-slate-400 font-medium uppercase mr-1">COR</span><span className="text-slate-800">{item.color}</span></span>}
                                        {item.ram && <span><span className="text-xs text-slate-400 font-medium uppercase mr-1">RAM</span><span className="text-slate-800">{item.ram}</span></span>}
                                        {item.storage && <span><span className="text-xs text-slate-400 font-medium uppercase mr-1">STORAGE</span><span className="text-slate-800">{item.storage}</span></span>}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFromSerialList(index)}
                                        className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleAddToBatchList}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        <CheckCircle2 size={16} />
                        Adicionar à Lista
                    </button>

                    {serialList.length > 0 && (
                        <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                            💡 Ao clicar em <strong>Salvar Produto</strong>, serão criados <strong>{serialList.length} produto(s)</strong> com os dados acima, um para cada item da lista.
                        </p>
                    )}
                </div>
            )}


            {/* 3. GARANTIA */}
            <ProductWarranty
                warrantyType={watch('warranty_type') || 'brand'}
                warrantyTemplateId={watch('warranty_template_id') || ''}
                brandWarrantyDays={brandWarrantyDays}
                categoryWarrantyDays={categoryWarrantyDays}
                onWarrantyTypeChange={(type) => setValue('warranty_type', type, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                onTemplateChange={(templateId) => setValue('warranty_template_id', templateId, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
            />

            {/* Simple hidden inputs to ensure warranty fields are in form submission */}
            <input
                type="hidden"
                name="warranty_type"
                value={watch('warranty_type') || 'brand'}
                readOnly
            />
            <input
                type="hidden"
                name="warranty_template_id"
                value={watch('warranty_template_id') || ''}
                readOnly
            />

            {/* 4. IMAGENS & VÍDEO */}
            <ProductImages
                imagePreviews={imagePreviews}
                isCompressing={isCompressing}
                handleImageUpload={handleImageUpload}
                removeImage={removeImage}
                useCustomImages={useCustomImages}
                onToggleCustomImages={setUseCustomImages}
                hasDefaultImages={!!selectedModel?.id && !!selectedColor}
                updatedAt={initialData?.updated || initialData?.created}
            />

            {/* VÍDEO DO PRODUTO */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-4">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                    Vídeo do Produto (Opcional)
                </h3>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                        URL do Vídeo
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="url"
                            value={watch('video_url') || ''}
                            onChange={(e) => setValue('video_url', e.target.value, { shouldDirty: true, shouldValidate: true })}
                            placeholder="Ex: https://youtube.com/watch?v=... ou https://seu-synology.to/video.mp4"
                            className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.video_url ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'}`}
                        />
                        <button
                            type="button"
                            onClick={handleGenerateSynologyLink}
                            className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center shrink-0 border border-purple-200 font-medium text-sm"
                            title="Gerar link no formato padrão usando o SKU do produto e Servidor Synology"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            Gerar do Synology
                        </button>
                        {watch('video_url') && (
                            <a
                                href={watch('video_url')}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center shrink-0 border border-blue-200 font-medium text-sm"
                                title="Testar abertura do vídeo"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                Testar Vídeo
                            </a>
                        )}
                    </div>
                    {errors.video_url && (
                        <p className="text-xs text-red-600 mt-1">{errors.video_url.message}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                        Cole o link público de um vídeo do YouTube ou do seu Synology NAS. Ele aparecerá junto com as imagens do produto.
                    </p>
                </div>
            </div>

            <BlingLinkSection
                blingId={blingId}
                blingParentId={blingParentId}
                onLink={(id, parentId) => {
                    setBlingId(id);
                    setBlingParentId(parentId);
                }}
                onUnlink={() => {
                    setBlingId(undefined);
                    setBlingParentId(undefined);
                }}
            />

            {/* VÍNCULO COM SHOPEE */}
            <ShopeeLinkSection 
                productId={initialData?.id}
                shopeeItemId={shopeeItemId}
                onLink={(id) => setShopeeItemId(id)}
                onUnlink={() => setShopeeItemId(undefined)}
            />

            {/* OTIMIZAÇÃO DE SEO */}
            <div className="bg-white p-6 rounded-xl border border-purple-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <FileText size={18} className="text-purple-600" />
                    Otimização para Buscadores (SEO)
                </h3>
                <ProductSEO
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                />
            </div>

            {/* COMPOSIÇÃO DE PREÇOS (O FINAL) */}
            {/* Aqui continuam os Preços e Botão Salvar (abaixo) */}

            {/* 5. CONTROLE DE ESTOQUE */}
            {!watch('is_virtual') && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Package size={18} className="text-blue-600" />
                    Controle de Estoque
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Checkbox: Monitorar Estoque */}
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                        <input
                            type="checkbox"
                            checked={watch('track_inventory') ?? true}
                            onChange={(e) => setValue('track_inventory', e.target.checked)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mt-0.5"
                        />
                        <div className="flex-1">
                            <label className="font-medium text-slate-700 cursor-pointer">
                                Monitorar Estoque
                            </label>
                            <p className="text-xs text-slate-500 mt-1">
                                Desmarque para produtos sem controle de estoque (serviços, sob encomenda)
                            </p>
                        </div>
                    </div>

                    {/* Campo: Quantidade em Estoque */}
                    {watch('track_inventory') !== false && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Quantidade em Estoque *
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={watch('stock_quantity') || 0}
                                onChange={(e) => setValue('stock_quantity', e.target.valueAsNumber || 0)}
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
            </div>
            )}

            {/* 6. PRECIFICAÇÃO */}
            <ProductPricing watch={watch} setValue={setValue} errors={errors} modelId={watch('model_id') || undefined} />

            {/* 6.5 KITS E DESCONTOS POR VOLUME */}
            <ProductKitsSection
                control={control}
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
            />

            {/* 7. FISCAL & AUTOMAÇÃO */}
            < div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4" >
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-slate-500" />
                    Fiscal & Automação
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">NCM (8 dígitos)</label>
                        <input
                            value={watch('ncm') || ''}
                            onChange={(e) => setValue('ncm', e.target.value)}
                            maxLength={8}
                            placeholder="12345678"
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">CEST (7 dígitos)</label>
                        <input
                            value={watch('cest') || ''}
                            onChange={(e) => setValue('cest', e.target.value)}
                            maxLength={7}
                            placeholder="1234567"
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Origem da Mercadoria</label>
                        <select
                            value={watch('origin') || '0'}
                            onChange={(e) => setValue('origin', e.target.value as any)}
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
                    {isDuplicateEAN ? '⚠️ EAN Duplicado - Não Permitido' : isLoading ? 'Salvando...' : serialList.length > 1 ? `Salvar ${serialList.length} Produtos` : 'Salvar Produto'}
                </button>
            </div>
        </form >
    );
}

