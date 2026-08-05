import React, { useState, useEffect } from 'react';
import { UseFormWatch, UseFormSetValue, Control, FieldErrors } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { Model } from '../../../types/model';
import { EANInput } from '../../ui/EANInput';
import { ModelSelect } from '../selectors/ModelSelect';
import { CategorySelect } from '../CategorySelect';
import { ExternalLink, GitBranch, Link2, Loader2, Package } from 'lucide-react';
import { modelService } from '../../../services/models';
import { brandService } from '../../../services/brands';
import { versionService } from '../../../services/versions-vps';
import { FIELD_DICTIONARY } from '../../../config/field-dictionary';
import { productService } from '../../../services/products';
import { Product } from '../../../types/product';

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
    blingId?: number;
    blingParentId?: number;
    blingParentProduct?: Product;
    isAutoLinkingBling?: boolean;
    blingLookupError?: string | null;
}

function VinculoBlingCompacto({
    blingId,
    blingParentId,
    sku,
    isAutoLinkingBling,
    blingLookupError
}: {
    blingId?: number;
    blingParentId?: number;
    sku?: string;
    isAutoLinkingBling?: boolean;
    blingLookupError?: string | null;
}) {
    const hasSku = !!sku?.trim();

    if (isAutoLinkingBling) {
        return (
            <div className="min-h-[46px] rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin shrink-0" />
                <span className="truncate">Buscando no Bling pelo SKU...</span>
            </div>
        );
    }

    if (blingId) {
        return (
            <div className="min-h-[46px] rounded-md border border-green-200 bg-green-50 px-3 py-2">
                <div className="flex h-full min-h-[28px] items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 text-sm">
                        <Link2 size={14} className="text-green-700 shrink-0" />
                        <span className="font-medium text-green-900 truncate">Vinculado ao Bling</span>
                        <span className="font-mono text-xs text-green-700 shrink-0">ID: {blingId}</span>
                        {blingParentId && (
                            <span className="font-mono text-xs text-green-600 shrink-0">Pai: {blingParentId}</span>
                        )}
                    </div>
                    <a
                        href={`https://app.bling.com.br/produtos/${blingId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 shrink-0"
                    >
                        Ver <ExternalLink size={11} />
                    </a>
                </div>
            </div>
        );
    }

    if (blingLookupError) {
        return (
            <div className="min-h-[46px] rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between gap-3">
                <span>{blingLookupError}</span>
                <a href="/admin/settings/bling" className="font-semibold underline shrink-0">
                    Reconectar
                </a>
            </div>
        );
    }

    return (
        <div className="min-h-[46px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 flex items-center">
            {hasSku
                ? 'Sem vinculo exato no Bling para este SKU.'
                : 'Digite o SKU para vincular automaticamente pelo Bling.'}
        </div>
    );
}

export function ProductBasicInfo({
    watch,
    setValue,
    control,
    errors,
    initialData,
    onModelSelected,
    blingId,
    blingParentId,
    blingParentProduct,
    isAutoLinkingBling,
    blingLookupError
}: ProductBasicInfoProps) {
    const [selectedModel, setSelectedModel] = useState<Model | null>(null);
    const [isLoadingModel, setIsLoadingModel] = useState(false);
    const [brandName, setBrandName] = useState<string>('');
    const [resolvedTemplateValues, setResolvedTemplateValues] = useState<Record<string, string>>({});
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [parentSearch, setParentSearch] = useState('');
    const [selectedParent, setSelectedParent] = useState<Product | null>(null);

    // Carrega lista de produtos para busca de pai
    useEffect(() => {
        productService.list().then(setAllProducts).catch(() => { });
    }, []);

    // Preenche selectedParent ao editar um produto que já tem parent_id
    useEffect(() => {
        const pid = watch('parent_id');
        if (pid && allProducts.length > 0) {
            const parent = allProducts.find(p => p.id === pid);
            setSelectedParent(parent || null);
        }
    }, [watch('parent_id'), allProducts]);

    useEffect(() => {
        if (blingParentProduct?.id) {
            setAllProducts(current => current.some(product => product.id === blingParentProduct.id)
                ? current
                : [...current, blingParentProduct]);
            setSelectedParent(blingParentProduct);
            setParentSearch('');
            setValue('parent_id', blingParentProduct.id, { shouldValidate: true, shouldDirty: true });
            return;
        }
        if (!blingParentId || watch('parent_id') || allProducts.length === 0) return;

        const parent = allProducts.find(product =>
            String(product.bling_id || '') === String(blingParentId)
        );
        if (!parent) return;

        setSelectedParent(parent);
        setParentSearch('');
        setValue('parent_id', parent.id, { shouldValidate: true, shouldDirty: true });
    }, [blingParentId, blingParentProduct, allProducts, setValue, watch('parent_id')]);

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

                // Resolve UUIDs nos template_values para nomes legíveis
                if (model.template_values) {
                    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    const resolved: Record<string, string> = {};
                    for (const [key, value] of Object.entries(model.template_values)) {
                        const strVal = String(value);
                        if (UUID_REGEX.test(strVal)) {
                            try {
                                const version = await versionService.getById(strVal);
                                resolved[key] = version?.name ?? strVal;
                            } catch {
                                resolved[key] = strVal;
                            }
                        } else {
                            resolved[key] = strVal;
                        }
                    }
                    setResolvedTemplateValues(resolved);
                } else {
                    setResolvedTemplateValues({});
                }
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
            setValue('name', model.name, { shouldValidate: true, shouldDirty: true });
        }
    };

    const handleEanSearch = async (ean: string) => {
        try {
            const models = await modelService.listActive();
            // Search in eans[] array (new format)
            let model = models.find(m => Array.isArray(m.eans) && m.eans.includes(ean));

            if (model) {
                console.log('📦 EAN found! Setting model:', model.name);
                applyModelToForm(model);
                return;
            }

            const product = await productService.getByEan(ean);
            if (product?.model_id) {
                model = models.find(m => m.id === product.model_id);
            }
            if (!model && product?.model) {
                model = models.find(m => m.name === product.model);
            }

            if (model) {
                console.log('EAN de produto cadastrado encontrado. Selecionando modelo:', model.name);
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

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Bling
                            <span className="ml-2 text-xs text-slate-400 font-mono">products.bling_id</span>
                        </label>
                        <VinculoBlingCompacto
                            blingId={blingId}
                            blingParentId={blingParentId}
                            sku={watch('sku') || ''}
                            isAutoLinkingBling={isAutoLinkingBling}
                            blingLookupError={blingLookupError}
                        />
                    </div>

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
                            onChange={async (modelName, selectedModelFromList) => {
                                if (!modelName) {
                                    setValue('model', '');
                                    setValue('model_id', '');
                                    setSelectedModel(null);
                                    return;
                                }

                                if (selectedModelFromList) {
                                    applyModelToForm(selectedModelFromList);
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

                    {/* Produto Pai (Variação) */}
                    <div className="space-y-1 md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                            <GitBranch size={14} className="text-slate-400" />
                            Produto Pai
                            <span className="ml-1 text-xs text-slate-400 font-mono">products.parent_id</span>
                            <span className="ml-2 text-xs text-slate-400">(opcional — vincule se este é uma variação de cor/versão)</span>
                        </label>

                        {selectedParent ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
                                <GitBranch size={14} className="text-amber-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-amber-900">{selectedParent.name}</span>
                                    <span className="ml-2 font-mono text-xs text-amber-600">SKU: {selectedParent.sku}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedParent(null);
                                        setParentSearch('');
                                        setValue('parent_id', undefined);
                                    }}
                                    className="text-amber-400 hover:text-red-500 transition-colors text-xs px-2 py-1 rounded hover:bg-red-50"
                                >
                                    Remover
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    value={parentSearch}
                                    onChange={(e) => setParentSearch(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Buscar por SKU ou nome do produto pai..."
                                />
                                {parentSearch.length >= 2 && (() => {
                                    const filtered = allProducts.filter(p =>
                                        !p.parent_id && // só pais
                                        p.id !== initialData?.id && // não ele mesmo
                                        (p.sku?.toLowerCase().includes(parentSearch.toLowerCase()) ||
                                            p.name.toLowerCase().includes(parentSearch.toLowerCase()))
                                    ).slice(0, 6);
                                    if (filtered.length === 0) return null;
                                    return (
                                        <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                                            {filtered.map(p => (
                                                <li
                                                    key={p.id}
                                                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm"
                                                    onClick={() => {
                                                        setSelectedParent(p);
                                                        setParentSearch('');
                                                        setValue('parent_id', p.id);
                                                        // Sugere SKU filho se o campo estiver vazio
                                                        const currentSku = watch('sku');
                                                        if (!currentSku?.trim() && p.sku) {
                                                            const colorPart = watch('specs.color')
                                                                ? `-${watch('specs.color').substring(0, 3).toUpperCase()}`
                                                                : '-VAR';
                                                            setValue('sku', `${p.sku}${colorPart}`);
                                                        }
                                                    }}
                                                >
                                                    <span className="font-mono text-xs text-slate-400 w-32 shrink-0 truncate">{p.sku || '—'}</span>
                                                    <span className="text-slate-800 truncate">{p.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    );
                                })()}
                            </div>
                        )}
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
                            {(() => {
                                // Deduplica por label — quando dois campos têm o mesmo label, mostra o primeiro
                                const seenLabels = new Set<string>();
                                return Object.entries(resolvedTemplateValues)
                                    .filter(([key]) => {
                                        const label = getTemplateLabel(key);
                                        if (seenLabels.has(label)) return false;
                                        seenLabels.add(label);
                                        return true;
                                    })
                                    .map(([key, value]) => (
                                        <div key={key}>
                                            <span className="text-blue-700 font-medium">{getTemplateLabel(key)}:</span>
                                            <span className="ml-2 text-blue-900">{value}</span>
                                        </div>
                                    ));
                            })()}
                        </div>
                        <p className="text-xs text-blue-600 mt-3">
                            💡 Estes valores serão aplicados automaticamente ao produto
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
