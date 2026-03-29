import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Share2, ShoppingCart, ShieldCheck, Truck, Smartphone, Monitor, Cpu, Camera, Battery, Wifi, Box, Settings, GitCompare, Facebook, Instagram, Package, Loader2, Layers } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useQuoteCart } from '@/contexts/QuoteCartContext';
import { useCompare } from '@/contexts/CompareContext';
import { PublicHeader } from '@/components/PublicHeader';
import { QuoteCartSidebar } from '@/components/catalog/QuoteCartSidebar';
import { FloatingCartButton } from '@/components/catalog/FloatingCartButton';
import { CatalogProduct } from '@/types/catalog';
import { ModernProductCard } from '@/components/catalog/ModernProductCard';
import { getEffectivePrice, useEffectiveCustomerType } from '@/hooks/useEffectiveCustomerType';
import { getCashbackSettings } from '@/services/cashbackService';
import type { CashbackSettings } from '@/types/cashback';
import { paymentFeesService, PaymentFee } from '@/services/payment-fees';
import { companySettingsService } from '@/services/companySettingsService';
import type { CompanySettings } from '@/types/companySettings';
import { toTitleCase } from '@/utils/stringFormatters';
import { shippingService } from '@/services/shippingService';
import { getCacheBustedUrl } from '@/utils/cache-buster';
/**
 * PublicProductPage
 * A dedicated SEO-friendly landing page for a single product.
 */
export const PublicProductPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { customer } = useSupabaseAuth();
    const { addItem } = useCart();
    const { add: addToCompare, remove: removeFromCompare, isSelected: isComparing } = useCompare();

    const customerType = useEffectiveCustomerType();

    const [product, setProduct] = useState<CatalogProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string>('');
    const [siblings, setSiblings] = useState<CatalogProduct[]>([]);
    const [relatedProducts, setRelatedProducts] = useState<CatalogProduct[]>([]);
    const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
    const [crossSellProducts, setCrossSellProducts] = useState<CatalogProduct[]>([]);
    const [cep, setCep] = useState('');
    const [shippingResult, setShippingResult] = useState<{ name: string, price: string, days: string }[] | null>(null);
    const [cashbackSettings, setCashbackSettings] = useState<CashbackSettings | null>(null);
    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
    const [paymentFees, setPaymentFees] = useState<PaymentFee[]>([]);
    const [comboChildren, setComboChildren] = useState<any[]>([]);
    const [selectedKitQuantity, setSelectedKitQuantity] = useState<number>(1);

    // Config da categoria: define quais campos existem no template
    const [categoryConfig, setCategoryConfig] = useState<any>(null);
    // Dicionário de chaves para nomes amigáveis baseados nos campos customizados do BD
    const [customFieldNames, setCustomFieldNames] = useState<Record<string, string>>({});

    // Resolved video URL: prioridade video_url → HEAD check automático por SKU
    const [effectiveVideoUrl, setEffectiveVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const resolveVideoUrl = async () => {
            // 1. Se o produto tem video_url explícita, usa direto
            if (product?.video_url) {
                setEffectiveVideoUrl(product.video_url);
                return;
            }

            // 2. Se não há SKU, sem vídeo
            if (!product?.sku) {
                setEffectiveVideoUrl(null);
                return;
            }

            // 3. Verifica via VPS (evita bloqueio CORS do HEAD direto ao Synology)
            try {
                const VPS_BASE = import.meta.env.VITE_VPS_API_URL || 'https://api.xiaomipetrolina.com.br';
                const resp = await fetch(`${VPS_BASE}/public/check-video?sku=${encodeURIComponent(product.sku.trim())}`, { cache: 'no-store' });
                if (!cancelled && resp.ok) {
                    const json = await resp.json();
                    setEffectiveVideoUrl(json.exists ? json.url : null);
                }
            } catch {
                if (!cancelled) setEffectiveVideoUrl(null);
            }
        };

        if (product) resolveVideoUrl();
        else setEffectiveVideoUrl(null);

        return () => { cancelled = true; };
    }, [product?.video_url, product?.sku]);

    useEffect(() => {
        window.scrollTo(0, 0);
        getCashbackSettings().then(setCashbackSettings).catch(console.error);
        companySettingsService.get().then(setCompanySettings).catch(console.error);
        paymentFeesService.list().then(setPaymentFees).catch(console.error);
        if (!slug) {
            navigate('/');
            return;
        }

        const fetchProduct = async () => {
            setLoading(true);
            try {
                // Fetch dictionary of custom fields to get readable labels
                const { data: fieldsData } = await supabase.from('custom_fields').select('key, label');
                if (fieldsData) {
                    const dict: Record<string, string> = {};
                    fieldsData.forEach(f => { if (f.key) dict[f.key] = f.label; });
                    setCustomFieldNames(dict);
                }

                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);

                let data: any = null;
                let error: any = null;
                const { vpsApiService } = await import('@/services/vpsApiService');

                // Busca inicial no Supabase (Resolve relações como Nome da Marca e Nome da Categoria)
                let query = supabase
                    .from('products')
                    .select('*, brand:brands(name), category:categories(name, config)')
                    .eq('status', 'active');

                if (isUuid) {
                    query = query.eq('id', slug);
                } else {
                    query = query.ilike('slug', slug); // Ignora Case Sensitive
                }

                const supaResult = await query.maybeSingle();
                data = supaResult.data;
                error = supaResult.error;

                // Após termos os dados base relacionais, buscamos estoques e preços AO VIVO da VPS
                if (data && data.id) {
                    try {
                        const vpsRichData = await vpsApiService.getProductById(data.id);
                        if (vpsRichData && !vpsRichData.error) {
                            // Mescla dando preferência à VPS (dados vitais), mas protegendo campos do Supabase
                            // que podem vir como null da VPS quando não sincronizados ainda.
                            data = {
                                ...data,
                                ...vpsRichData,
                                category: data.category,
                                // Prefere brand do Supabase (JOIN object {name}), mas usa da VPS como fallback (string)
                                brand: data.brand || vpsRichData.brand,
                                sku: vpsRichData.sku || data.sku,
                                images: vpsRichData.images || data.images,
                                video_url: vpsRichData.video_url || data.video_url,
                                updated_at: vpsRichData.updated_at || data.updated_at,
                                // model_id: protege para não perder o vínculo com o modelo (que contém brand, specs etc.)
                                model_id: vpsRichData.model_id || data.model_id,
                            };
                        }
                    } catch (e) {
                        console.warn('[PublicProductPage] Failed to enrich from VPS by ID:', e);
                    }
                }

                // NOTA: O endpoint /products?sku= da VPS não filtra exatamente por SKU,
                // por isso o fallback por SKU foi removido para evitar mostrar dados do produto errado.

                if (!data || error) {
                    console.error('Produto não encontrado:', error);
                    toast.error('Produto não encontrado');
                    navigate('/');
                    return;
                }

                // Check VPS for SEO Blacklist strictly (avoids needing Supabase column)
                try {
                    const { vpsApiService } = await import('@/services/vpsApiService');
                    const vpsData = await vpsApiService.getProductById(data.id);
                    if (vpsData) {
                        data.exclude_from_seo = Boolean(vpsData.exclude_from_seo);
                        if (vpsData.is_combo) {
                            data.is_combo = true;
                            const children = await vpsApiService.getComboChildren(data.id);
                            setComboChildren(children || []);
                        }
                    }
                } catch (v_err) {
                    console.warn("Failed to check VPS SEO flag or Combo state:", v_err);
                }

                let modelData: Record<string, any> = {};
                let modelRootDescription = '';
                let modelBrandName = '';
                // Valores padrão de specs vindos do template do modelo
                let modelSpecDefaults: Record<string, any> = {};

                if (data.model_id) {
                    const { data: mData } = await supabase
                        .from('models')
                        .select('description, template_values, brand:brands(name)')
                        .eq('id', data.model_id)
                        .maybeSingle();

                    if (mData) {
                        modelRootDescription = mData.description || '';
                        if (mData.template_values) {
                            modelData = mData.template_values;
                            // Salvar todos os campos do template como specs, exceto logísticos e SEO nativos
                            const ignoredKeys = ['weight_kg', 'dimensions.width_cm', 'dimensions.height_cm', 'dimensions.depth_cm', 'slug', 'meta_title', 'meta_description', 'keywords'];
                            Object.entries(mData.template_values).forEach(([k, v]) => {
                                if (!ignoredKeys.includes(k)) {
                                    const cleanKey = k.replace(/^specs\./, ''); // remove se existir prefixo antigo
                                    modelSpecDefaults[cleanKey] = v;
                                }
                            });
                        }
                        modelBrandName = (mData.brand as any)?.name || '';
                    }
                }

                // Format it perfectly as CatalogProduct
                const categoryRaw = (data.category as any);
                // Salvar config da categoria para render dinâmico das specs
                if (categoryRaw?.config) setCategoryConfig(categoryRaw.config);

                // --- Segurança de Parsing ---
                let parsedImages = data.images;
                if (typeof data.images === 'string') {
                    try { parsedImages = JSON.parse(data.images); } catch { parsedImages = []; }
                }
                if (!Array.isArray(parsedImages)) parsedImages = [];
                data.images = parsedImages;

                let parsedSpecs = data.specs;
                if (typeof data.specs === 'string') {
                    try { parsedSpecs = JSON.parse(data.specs); } catch { parsedSpecs = {}; }
                }
                data.specs = parsedSpecs || {};
                // -----------------------------

                // Merge: template defaults + product specs + logistics fallbacks
                const mergedSpecs = {
                    ...(modelSpecDefaults),
                    ...(data.specs),
                    // Logística: valor do produto se existir, senão do template do modelo
                    weight_kg: data.weight_kg ?? modelData['weight_kg'],
                    width_cm: data.width_cm ?? modelData['dimensions.width_cm'],
                    height_cm: data.height_cm ?? modelData['dimensions.height_cm'],
                    depth_cm: data.depth_cm ?? modelData['dimensions.depth_cm'],
                };

                const formattedProduct = {
                    ...data,
                    specs: mergedSpecs,
                    brand: data.brand?.name || modelBrandName || data.brand || '',
                    category: categoryRaw?.name || data.category_id,
                    description: modelData.description || modelRootDescription || data.description,
                    meta_title: modelData.meta_title || data.meta_title,
                    meta_description: modelData.meta_description || data.meta_description,
                    keywords: modelData.keywords || data.keywords,
                };

                setProduct(formattedProduct as unknown as CatalogProduct);

                if (data.images && data.images.length > 0) {
                    setSelectedImage(data.images[0]);
                }

                // Função auxiliar global para produtos
                const enrichProductsWithModels = async (productList: any[]) => {
                    try {
                        if (!productList || productList.length === 0) return productList;
                        
                        const modelIds = Array.from(new Set(productList.map(p => p.model_id).filter(Boolean)));
                        if (modelIds.length === 0) return productList.map(p => {
                            // Sanitização de fallback básica mesmo sem modelo
                            let tempImages = p.images;
                            if (typeof tempImages === 'string') { try { tempImages = JSON.parse(tempImages); } catch { tempImages = []; } }
                            if (!Array.isArray(tempImages)) tempImages = [];
                            
                            let tempSpecs = p.specs;
                            if (typeof tempSpecs === 'string') { try { tempSpecs = JSON.parse(tempSpecs); } catch { tempSpecs = {}; } }
                            
                            return { ...p, images: tempImages, specs: tempSpecs || {} };
                        });

                        const { data: modelsData, error } = await supabase
                            .from('models')
                            .select('id, description, template_values, brand:brands(name)')
                            .in('id', modelIds as string[]);

                        if (error || !modelsData) return productList;

                        const modelsMap = modelsData.reduce((acc, m) => {
                            acc[m.id] = m;
                            return acc;
                        }, {} as Record<string, any>);

                        return productList.map(p => {
                            let tempImages = p.images;
                            if (typeof tempImages === 'string') { try { tempImages = JSON.parse(tempImages); } catch { tempImages = []; } }
                            if (!Array.isArray(tempImages)) tempImages = [];
                            
                            let tempSpecs = p.specs;
                            if (typeof tempSpecs === 'string') { try { tempSpecs = JSON.parse(tempSpecs); } catch { tempSpecs = {}; } }
                            
                            if (!p.model_id || !modelsMap[p.model_id]) return { ...p, images: tempImages, specs: tempSpecs || {} };
                            
                            const mData = modelsMap[p.model_id];
                            const mTemplate = mData.template_values || {};
                            const mergedSpecs = { ...mTemplate, ...(tempSpecs || {}) };
                            const mergedBrand = typeof p.brand === 'object' ? p.brand?.name : p.brand;
                            const modelBrand = typeof mData.brand === 'object' ? mData.brand?.name : mData.brand;
                            
                            return {
                                ...p,
                                specs: mergedSpecs,
                                images: tempImages,
                                description: mTemplate.description || mData.description || p.description,
                                meta_title: mTemplate.meta_title || p.meta_title,
                                meta_description: mTemplate.meta_description || p.meta_description,
                                keywords: mTemplate.keywords || p.keywords,
                                brand: mergedBrand || modelBrand || ''
                            };
                        });
                    } catch (err) {
                        console.error('Error enriching products with models:', err);
                        return productList;
                    }
                };

                // Buscar irmãos (variantes)
                const modelVal = data.model_id || data.model;
                if (modelVal) {
                    let sibQuery = supabase
                        .from('products')
                        .select('*, brand:brands(name), category:categories(name)')
                        .eq('status', 'active');

                    if (data.model_id) {
                        sibQuery = sibQuery.eq('model_id', data.model_id);
                    } else {
                        sibQuery = sibQuery.eq('model', data.model);
                    }

                    const { data: sibs } = await sibQuery;

                    if (sibs && sibs.length > 0) {
                        const enrichedSibs = await enrichProductsWithModels(sibs);
                        setSiblings(enrichedSibs as unknown as CatalogProduct[]);
                    }
                }

                // Buscar produtos relacionados (mesma categoria, max 4)
                if (data.category_id) {
                    const { data: related } = await supabase
                        .from('products')
                        .select('*, brand:brands(name), category:categories(name)')
                        .eq('status', 'active')
                        .eq('category_id', data.category_id)
                        .neq('id', data.id)
                        .limit(4);

                    if (related) {
                        const enrichedRelated = await enrichProductsWithModels(related);
                        const formattedRelated = enrichedRelated.map(rel => ({
                            ...rel,
                            category: (rel.category as any)?.name || rel.category_id,
                            brand: typeof rel.brand === 'object' ? (rel.brand as any)?.name : rel.brand
                        }));
                        setRelatedProducts(formattedRelated as unknown as CatalogProduct[]);
                    }
                }

                // Buscar Cross-Sell (produtos de OUTRAS categorias que compartilhem alguma Spec/Tag do produto atual)
                if (Object.keys(mergedSpecs).length > 0) {
                    const orConditions: string[] = [];
                    
                    // Lista de características muito genéricas que não servem para cruzar vendas (ex: dois itens pretos não significam que conversem)
                    const BLOCKED_CROSS_SELL_KEYS = new Set([
                        'color', 'cor', 'storage', 'armazenamento', 'ram', 'memory', 'memoria',
                        'weight_kg', 'peso_g', 'peso_kg', 'peso', 'width_cm', 'largura', 'height_cm', 'altura',
                        'depth_cm', 'profundidade', 'tamanho', 'size', 'wifi', 'bluetooth', 'nfc',
                        'versao', 'version', 'ano', 'year', 'garantia', 'warranty', 'voltagem', 'voltage',
                        'condicao', 'condition', 'estado', 'status', 'tipo', 'type', 'modelo', 'model', 
                        'marca', 'brand', 'bateria', 'battery_mah', 'battery_health', 'display', 'tela'
                    ]);

                    // Dá prioridade total se o lojista criou um campo customizado explícito para isso
                    const explicitTags = mergedSpecs['tags_venda'] || mergedSpecs['cross_sell_tags'] || mergedSpecs['tags'];
                    
                    if (explicitTags) {
                        // Usa apenas as tags explícitas
                        const tagList = Array.isArray(explicitTags) ? explicitTags : [explicitTags];
                        tagList.forEach(item => {
                            if (typeof item === 'string' && item.trim().length > 2) {
                                const cleanVal = item.trim().replace(/"/g, '');
                                // O produto alvo pode ter a tag na mesma chave ou como valor genérico nas specs
                                orConditions.push(`specs->>tags_venda.eq."${cleanVal}"`);
                                orConditions.push(`specs->>cross_sell_tags.eq."${cleanVal}"`);
                                orConditions.push(`specs->>tags.eq."${cleanVal}"`);
                            }
                        });
                    } else {
                        // Lógica automática: cruza todas as especificações técnicas, exceto as genéricas
                        Object.entries(mergedSpecs).forEach(([k, v]) => {
                            if (BLOCKED_CROSS_SELL_KEYS.has(k.toLowerCase())) return;

                            // Função auxiliar para injetar condição
                            const injectCondition = (val: any) => {
                                if (typeof val === 'string' && val.trim().length > 2 && val.trim().toLowerCase() !== 'sim' && val.trim().toLowerCase() !== 'não') {
                                    const cleanVal = val.trim().replace(/"/g, '');
                                    orConditions.push(`specs->>${k}.ilike."%${cleanVal}%"`); 
                                } else if (typeof val === 'number' && val > 0) {
                                    orConditions.push(`specs->>${k}.eq.${val}`);
                                }
                            };

                            if (Array.isArray(v)) {
                                v.forEach(item => injectCondition(item));
                            } else {
                                injectCondition(v);
                            }
                        });
                    }

                    // Construção dinâmica de tags via OR match (specs->>campo.eq.Valor)
                    if (orConditions.length > 0) {
                        const orString = orConditions.join(',');
                        
                        let csQuery = supabase
                            .from('products')
                            .select('*, brand:brands(name), category:categories(name)')
                            .eq('status', 'active')
                            .neq('id', data.id)
                            .or(orString)
                            .limit(4);

                        // Garante que o cross-sell é apenas de produtos de categorias *diferentes*
                        if (data.category_id) {
                            csQuery = csQuery.neq('category_id', data.category_id);
                        }

                        const { data: crossSellResult, error: csError } = await csQuery;
                        
                        if (!csError && crossSellResult && crossSellResult.length > 0) {
                            const enrichedCrossSell = await enrichProductsWithModels(crossSellResult);
                            const formattedCrossSell = enrichedCrossSell.map(rel => ({
                                ...rel,
                                category: (rel.category as any)?.name || rel.category_id,
                                brand: typeof rel.brand === 'object' ? (rel.brand as any)?.name : rel.brand
                            }));
                            setCrossSellProducts(formattedCrossSell as unknown as CatalogProduct[]);
                        }
                    }
                }

            } catch (err) {
                console.error(err);
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [slug, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50">
                <PublicHeader />
                <div className="flex justify-center items-center h-[60vh]">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!product) return null;

    // Calculate total stock across all siblings (variants)
    const totalGroupStock = (() => {
        let sum = (product.track_inventory && product.stock_quantity !== undefined) ? product.stock_quantity : 0;
        let hasTracked = product.track_inventory !== false;
        
        siblings.forEach(sib => {
            if (sib.id !== product.id) {
                if (sib.track_inventory !== false && sib.stock_quantity !== undefined) {
                    sum += sib.stock_quantity;
                    hasTracked = true;
                }
            }
        });
        
        return hasTracked ? sum : undefined;
    })();

    // Prices calculation
    const effectivePrice = getEffectivePrice(product, customer);
    const originalPrice = effectivePrice / 100;
    const baseDiscountedPrice = product.discount_percentage
        ? originalPrice * (1 - product.discount_percentage / 100)
        : originalPrice;

    // Aplica o preço do Kit na BuyBox se um kit estiver selecionado
    let displayPrice = baseDiscountedPrice;
    let isKitSelected = false;

    if (selectedKitQuantity > 1 && product.kits && product.kits.length > 0) {
        const kit = product.kits.find((k: any) => k.quantity === selectedKitQuantity);
        if (kit) {
            displayPrice = kit.price / 100;
            isKitSelected = true;
        }
    }

    const estimatedCoins = cashbackSettings?.active && displayPrice >= (cashbackSettings.min_purchase_for_coins || 0)
        ? Math.floor(displayPrice * (cashbackSettings.coins_per_real || 0))
        : 0;

    const presencial12x = paymentFees.find(f => f.channel === 'presencial' && f.installments === 12);
    const taxaAplicada12x = presencial12x?.applied_fee_pct || 0;
    const value12x = (displayPrice * (1 + taxaAplicada12x / 100)) / 12;

    const title = product.meta_title || `${toTitleCase(product.name)} | Mercado do Vale`;
    const description = product.meta_description || product.description || `Compre ${product.name} no Mercado do Vale.`;

    const handleAddToCart = () => {
        addItem(product, selectedKitQuantity);
        toast.success(selectedKitQuantity > 1 ? `${selectedKitQuantity}x Produtos adicionados ao carrinho!` : 'Produto adicionado ao carrinho!', {
            icon: '🛒',
            duration: 3000
        });
        navigate('/carrinho');
    };

    const isInCompare = product ? isComparing(product.id) : false;

    const handleCompare = () => {
        if (!product) return;
        if (isInCompare) {
            removeFromCompare(product.id);
            toast.success('Produto removido da comparação');
        } else {
            const error = addToCompare(product);
            if (error) {
                toast.error(error);
            } else {
                toast.success('Produto adicionado à comparação');
            }
        }
    };

    // Generate available variants (hoisted so we can use it in share text)
    const allVariants = [product as CatalogProduct, ...siblings];
    const availableVariants = allVariants.filter(
        item => !item.track_inventory || (item.stock_quantity && item.stock_quantity > 0)
    );

    availableVariants.forEach(item => {
        const labelPieces = [];
        if (item.specs?.color) labelPieces.push(item.specs.color);
        if (item.specs?.storage) labelPieces.push(item.specs.storage);
        if (item.specs?.ram) labelPieces.push(`RAM ${item.specs.ram}`);

        let itemLbl = labelPieces.join(' - ');
        if (!itemLbl) {
            if (item.name.includes(' - ')) {
                itemLbl = item.name.split(' - ').pop()?.trim() || 'Padrão';
            } else {
                itemLbl = 'Padrão';
            }
        }
        if (itemLbl.startsWith('-')) itemLbl = itemLbl.substring(1).trim();
        (item as any)._displayLabel = itemLbl;
    });

    const uniqueVariants: CatalogProduct[] = [];
    const _seenLabels = new Set<string>();
    availableVariants.forEach(item => {
        const lbl = (item as any)._displayLabel;
        if (!_seenLabels.has(lbl)) {
            _seenLabels.add(lbl);
            uniqueVariants.push(item);
        }
    });
    uniqueVariants.sort((a, b) => ((a as any)._displayLabel || '').localeCompare((b as any)._displayLabel || ''));

    const getShareText = () => {
        const variantNames = uniqueVariants.map(v => (v as any)._displayLabel).join(', ');
        
        let text = `*${toTitleCase(product.name)}*\n`;
        if (variantNames) {
            text += `Disponível: ${variantNames}\n`;
        }
        text += `R$ ${displayPrice.toFixed(2).replace('.', ',')}, em até 12x de: R$ ${value12x.toFixed(2).replace('.', ',')}\n\n`;

        if (estimatedCoins > 0) {
            text += `Ganhe ${estimatedCoins} Moedas do Vale nessa compra!\n\n`;
        }

        text += `${window.location.href}\n\n`;
        text += `Visite o nosso site para ver essa e muitas outras opções de produtos!\n`;
        text += `_www.mercadodovale.com.br_`;
        return text;
    };

    const handleShareWhatsapp = () => {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(getShareText())}`;
        window.open(url, '_blank');
    };

    const handleShareFacebook = () => {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(getShareText())}`;
        window.open(url, '_blank');
    };

    const handleShareInstagram = async () => {
        await navigator.clipboard.writeText(getShareText());
        toast.success('Texto copiado! Pronto para colar no seu Instagram.', { duration: 4000 });
        setTimeout(() => {
            window.open('https://www.instagram.com', '_blank');
        }, 1500);
    };

    const handleVariantChange = (sib: CatalogProduct) => {
        // Altera os dados instantaneamente sem reload de página
        setProduct(sib);
        if (sib.images && sib.images.length > 0) {
            setSelectedImage(sib.images[0]);
        }

        // Atualiza a URL na barra do navegador (sem triggerar novo fetch)
        const newUrl = `/produto/${sib.slug || sib.id}`;
        window.history.pushState(null, '', newUrl);

        // Scroll suave para o topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleCalculateShipping = async () => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length < 8) return toast.error("CEP inválido");

        setIsCalculatingShipping(true);
        try {
            const res = await shippingService.calculate({
                to_cep: cleanCep,
                order_value: displayPrice * 100, // needs to be in centavos
                weight: Math.max(300, product.weight_kg ? (product.weight_kg * 1000) : 300),
                height: Math.max(10, product.dimensions?.height_cm || 10),
                width: Math.max(15, product.dimensions?.width_cm || 15),
                length: Math.max(20, product.dimensions?.depth_cm || 20),
            });
            
            if (res.options.length === 0) {
                toast.error("Nenhuma opção de entrega encontrada para este CEP.");
                setShippingResult([]);
                return;
            }

            const formatted = res.options.map(opt => ({
                name: opt.name,
                price: opt.price === 0 ? "Grátis" : opt.price.toFixed(2).replace('.', ','),
                days: opt.daysLabel
            }));
            
            setShippingResult(formatted);
            toast.success("Estimativa calculada com sucesso!");
        } catch (error) {
            console.error("Erro ao calcular frete:", error);
            toast.error("Erro ao calcular frete. Tente novamente.");
        } finally {
            setIsCalculatingShipping(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Injeção JSON-LD Local via Helmet para Crawlers React-Awares (Google) */}
            <Helmet>
                <title>{title}</title>
                <meta name="description" content={description} />
                {product.exclude_from_seo && (
                    <meta name="robots" content="noindex, nofollow" />
                )}
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org/",
                        "@type": "Product",
                        "name": toTitleCase(product.name),
                        "image": product.images || [],
                        "description": description,
                        "sku": product.sku || '',
                        "brand": {
                            "@type": "Brand",
                            "name": typeof product.brand === 'string' ? product.brand : 'Mercado do Vale'
                        },
                        "offers": {
                            "@type": "Offer",
                            "url": window.location.href,
                            "priceCurrency": "BRL",
                            "price": displayPrice.toString(),
                            "availability": product.stock_quantity && product.stock_quantity > 0
                                ? "https://schema.org/InStock"
                                : "https://schema.org/OutOfStock",
                            "itemCondition": "https://schema.org/NewCondition"
                        }
                    })}
                </script>
            </Helmet>

            <PublicHeader />

            <FloatingCartButton />
            <QuoteCartSidebar />

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Breadcrumbs */}
                <nav className="flex items-center gap-2 text-sm text-slate-500 mb-8">
                    <button onClick={() => navigate('/')} className="hover:text-blue-600 transition-colors">
                        Início
                    </button>
                    {product.category && (
                        <>
                            <span>/</span>
                            <span className="text-slate-700">{typeof product.category === 'string' ? product.category : 'Categoria'}</span>
                        </>
                    )}
                    <span>/</span>
                    <span className="text-slate-900 font-medium truncate max-w-[200px] sm:max-w-xs">
                        {product.name}
                    </span>
                </nav>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Galeria de Imagens (Esquerda) */}
                    <div className="space-y-4">
                        <div className="aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center p-4">
                            {selectedImage === 'VIDEO' && effectiveVideoUrl ? (
                                effectiveVideoUrl.toLowerCase().endsWith('.mp4') ? (
                                    <video src={effectiveVideoUrl} controls autoPlay className="w-full h-full object-contain shadow-lg rounded-lg bg-black" onError={() => { setEffectiveVideoUrl(null); setSelectedImage(product?.images?.[0] || ''); }} />
                                ) : (
                                    <div className="w-full h-full flex flex-col">
                                        <iframe 
                                            src={effectiveVideoUrl.includes('youtube.com/watch?v=') ? effectiveVideoUrl.replace('watch?v=', 'embed/') : effectiveVideoUrl.includes('youtu.be/') ? effectiveVideoUrl.replace('youtu.be/', 'youtube.com/embed/') : effectiveVideoUrl} 
                                            className="w-full h-full rounded-lg shadow-sm bg-white" 
                                            allowFullScreen
                                            title="Vídeo do Produto"
                                        ></iframe>
                                        {!effectiveVideoUrl.includes('youtube.com') && !effectiveVideoUrl.includes('youtu.be') && (
                                            <a href={effectiveVideoUrl} target="_blank" rel="noreferrer" className="mt-4 text-sm text-center font-bold text-blue-600 hover:underline">
                                                🔗 O vídeo não carregou? Clique aqui para abrir
                                            </a>
                                        )}
                                    </div>
                                )
                            ) : selectedImage && selectedImage !== 'VIDEO' ? (
                                <img
                                    src={getCacheBustedUrl(selectedImage, product.updated_at || product.created_at)}
                                    alt={product.meta_title || toTitleCase(product.name)}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-slate-400 font-medium">Sem imagem</div>
                            )}
                        </div>
                        {((product.images && product.images.length > 1) || effectiveVideoUrl) && (
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {effectiveVideoUrl && (
                                    <button
                                        onClick={() => setSelectedImage('VIDEO')}
                                        className={`w-20 h-20 flex-shrink-0 bg-white rounded-lg border-2 overflow-hidden flex items-center justify-center ${selectedImage === 'VIDEO' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="text-blue-600 flex flex-col items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                            <span className="text-[10px] font-bold mt-1 tracking-wider uppercase">Vídeo</span>
                                        </div>
                                    </button>
                                )}
                                {product.images?.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImage(img)}
                                        className={`w-20 h-20 flex-shrink-0 bg-white rounded-lg border-2 overflow-hidden ${selectedImage === img ? 'border-blue-600' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <img src={getCacheBustedUrl(img, product.updated_at || product.created_at)} alt={`${product.meta_title || toTitleCase(product.name)} - Ângulo ${idx + 1}`} className="w-full h-full object-contain p-1" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Informações do Produto (Direita) */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                                {toTitleCase(product.name)}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-slate-500">
                                <span>
                                    SKU: <span className="font-mono">{product.sku || '—'}</span>
                                </span>
                                <span className="text-slate-300">|</span>
                                <span>
                                    Marca:{' '}
                                    <span>
                                        {typeof product.brand === 'string' && product.brand ? product.brand : '—'}
                                    </span>
                                </span>
                                <span className="text-slate-300">|</span>
                                <div className="flex items-center gap-1.5 border-r border-slate-300 pr-4 mr-0" title="Compartilhar">
                                    <span className="text-sm font-medium">Compartilhar:</span>
                                    <button
                                        onClick={handleShareInstagram}
                                        className="text-slate-500 hover:text-pink-600 transition-colors p-1"
                                        title="Copiar texto para o Instagram"
                                    >
                                        <Instagram size={18} />
                                    </button>
                                    <button
                                        onClick={handleShareFacebook}
                                        className="text-slate-500 hover:text-blue-600 transition-colors p-1"
                                        title="Compartilhar no Facebook"
                                    >
                                        <Facebook size={18} />
                                    </button>
                                    <button
                                        onClick={handleShareWhatsapp}
                                        className="text-slate-500 hover:text-green-600 transition-colors p-1"
                                        title="Compartilhar no WhatsApp"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                                        </svg>
                                    </button>
                                </div>
                                <button
                                    onClick={handleCompare}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-sm shadow-sm ${
                                        isInCompare 
                                            ? 'border-blue-600 bg-blue-100 text-blue-800 font-bold' 
                                            : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 hover:bg-slate-200'
                                    }`}
                                >
                                    <GitCompare size={16} className={isInCompare ? "text-blue-700" : "text-slate-600"} /> 
                                    {isInCompare ? 'Comparando' : 'Comparar'}
                                </button>
                            </div>
                        </div>

                        {/* Variantes (Cores / Capacidades) */}
                        {siblings.length > 1 && (
                            <div className="pt-2">
                                <h3 className="text-sm font-bold text-slate-900 mb-3">Opções Disponíveis:</h3>
                                <div className="flex flex-wrap gap-2">
                                    {(() => {
                                        // Usa as variações já preparadas e alinhadas lá em cima (uniqueVariants)
                                        if (uniqueVariants.length <= 1) return null;

                                        return uniqueVariants.map((sib) => {
                                            const isCurrent = sib.id === product.id;
                                            const variantLabel = (sib as any)._displayLabel;

                                            return (
                                                <button
                                                    key={sib.id}
                                                    onClick={() => handleVariantChange(sib)}
                                                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-300 ${isCurrent
                                                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600 scale-[1.03] shadow-sm transform'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {variantLabel}
                                                </button>
                                            );
                                        })
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Preço */}
                        <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden">
                            {totalGroupStock !== undefined && totalGroupStock > 0 && totalGroupStock <= 2 && (
                                <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-xs font-bold text-center py-1 animate-pulse">
                                    Últimas unidades em estoque!
                                </div>
                            )}
                            <div className={totalGroupStock !== undefined && totalGroupStock > 0 && totalGroupStock <= 2 ? "mt-4" : ""}>
                                {product.discount_percentage && !isKitSelected ? (
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg text-slate-400 line-through">
                                                R$ {originalPrice.toFixed(2).replace('.', ',')}
                                            </span>
                                            <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                                -{product.discount_percentage}% OFF
                                            </span>
                                        </div>
                                        <div className="text-4xl font-extrabold text-slate-900">
                                            R$ {displayPrice.toFixed(2).replace('.', ',')}
                                        </div>
                                        {customerType !== 'wholesale' && (
                                            <p className="text-sm font-medium text-green-600 mt-1">
                                                ou em até <span className="font-bold">12x de R$ {value12x.toFixed(2).replace('.', ',')}</span> sem juros
                                            </p>
                                        )}
                                        {customerType !== 'wholesale' && (companySettings?.pix_discount_percentage || 0) > 0 && (
                                            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-100">
                                                ✓ {companySettings?.pix_discount_percentage}% desconto direto no PIX
                                            </div>
                                        )}
                                        {customerType !== 'wholesale' && estimatedCoins > 0 && (
                                            <div className="mt-2 ml-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm font-bold border border-amber-200">
                                                <span className="text-base leading-none">🪙</span>
                                                Ganhe {estimatedCoins} Moedas do Vale
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-4xl font-extrabold text-slate-900">
                                            R$ {displayPrice.toFixed(2).replace('.', ',')}
                                        </div>
                                        {customerType !== 'wholesale' && (
                                            <p className="text-sm font-medium text-green-600 mt-1">
                                                ou em até <span className="font-bold">12x de R$ {value12x.toFixed(2).replace('.', ',')}</span> sem juros
                                            </p>
                                        )}
                                        {customerType !== 'wholesale' && (companySettings?.pix_discount_percentage || 0) > 0 && (
                                            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-100">
                                                ✓ {companySettings?.pix_discount_percentage}% desconto direto no PIX
                                            </div>
                                        )}
                                        {customerType !== 'wholesale' && estimatedCoins > 0 && (
                                            <div className="mt-2 ml-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm font-bold border border-amber-200">
                                                <span className="text-base leading-none">🪙</span>
                                                Ganhe {estimatedCoins} Moedas do Vale
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Seletor de Kits (Descontos por Volume) */}
                                {product.kits && product.kits.length > 0 && (
                                    <div className="mt-6 pt-4 border-t border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                            <Layers size={16} className="text-blue-600" />
                                            Compre mais, pague menos
                                        </h4>
                                        {/* Derivar label da unidade base a partir dos nomes dos kits */}
                                        {(() => {
                                            const singularMap: Record<string, string> = {
                                                'meses': 'mês', 'semanas': 'semana', 'anos': 'ano',
                                                'dias': 'dia', 'horas': 'hora', 'unidades': 'unidade', 'itens': 'item',
                                            };
                                            const firstNamed = product.kits?.find((k: any) => k.name && /^\d+\s+\w+/.test(k.name.trim()));
                                            const match = firstNamed?.name?.trim().match(/^\d+\s+(.+)$/);
                                            const baseUnitLabel = match
                                                ? `1 ${singularMap[match[1].toLowerCase()] ?? match[1].replace(/s$/i, '')}`
                                                : '1 Unidade';
                                            return (
                                        <div className="flex flex-col gap-2">

                                            <button
                                                onClick={() => setSelectedKitQuantity(1)}
                                                className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                                    selectedKitQuantity === 1
                                                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedKitQuantity === 1 ? 'border-blue-600' : 'border-slate-300'}`}>
                                                        {selectedKitQuantity === 1 && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                                    </div>
                                                    <span className="font-medium text-slate-800">{baseUnitLabel}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-slate-900">R$ {baseDiscountedPrice.toFixed(2).replace('.', ',')}</div>
                                                </div>
                                            </button>

                                            {/* Opções de Kits */}
                                            {[...product.kits].sort((a: any, b: any) => a.quantity - b.quantity).map((kit: any, idx) => {
                                                const unitPrice = kit.price / kit.quantity;
                                                const kitPriceDisplay = (kit.price / 100).toFixed(2).replace('.', ',');
                                                const unitPriceDisplay = (unitPrice / 100).toFixed(2).replace('.', ',');
                                                const savings = ((baseDiscountedPrice * kit.quantity) - (kit.price / 100));

                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setSelectedKitQuantity(kit.quantity)}
                                                        className={`flex flex-col p-3 rounded-xl border-2 transition-all relative overflow-hidden ${
                                                            selectedKitQuantity === kit.quantity
                                                                ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                                        }`}
                                                    >
                                                        {savings > 0 && (
                                                            <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                                                                Economia de R$ {savings.toFixed(2).replace('.', ',')}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between w-full mt-1">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${selectedKitQuantity === kit.quantity ? 'border-blue-600' : 'border-slate-300'}`}>
                                                                    {selectedKitQuantity === kit.quantity && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                                                </div>
                                                                <div className="text-left">
                                                                    <span className="font-bold text-blue-900">{kit.name || `Kit com ${kit.quantity} Unidades`}</span>
                                                                    <div className="text-xs text-blue-600 font-medium">R$ {unitPriceDisplay} cada</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right pl-2">
                                                                <div className="font-bold text-slate-900 text-lg">R$ {kitPriceDisplay}</div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {Boolean((product as unknown as any)?.is_combo) && comboChildren && comboChildren.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                            <Package size={16} className="text-teal-600" />
                                            O que vem neste Kit:
                                        </h4>
                                        <div className="space-y-2">
                                            {comboChildren.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-sm bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-teal-700 w-6 text-center">{item.quantity}x</span>
                                                        <span className="text-slate-700 font-medium">{item.name}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-6">
                                    <button
                                        onClick={handleAddToCart}
                                        disabled={!product.track_inventory ? false : (product.stock_quantity || 0) <= 0}
                                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl transition-colors shadow-blue-600/20 shadow-lg text-lg"
                                    >
                                        <ShoppingCart size={24} />
                                        {(!product.track_inventory || (product.stock_quantity || 0) > 0) ? 'Adicionar ao Carrinho' : 'Fora de Estoque'}
                                    </button>
                                </div>
                            </div>

                            {/* Calculadora de Frete */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
                                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <Truck size={16} className="text-blue-600" /> Consultar Frete e Prazo
                                </h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Digite seu CEP"
                                        maxLength={9}
                                        value={cep}
                                        onChange={(e) => setCep(e.target.value)}
                                        className="flex-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                    <button
                                        onClick={handleCalculateShipping}
                                        disabled={isCalculatingShipping || cep.length < 8}
                                        className="px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors min-w-[110px] flex justify-center items-center"
                                    >
                                        {isCalculatingShipping ? <Loader2 size={18} className="animate-spin" /> : 'Calcular'}
                                    </button>
                                </div>

                                {shippingResult && (
                                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                                        {shippingResult.map((res, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm p-3 rounded-lg bg-slate-50 border border-slate-100">
                                                <div>
                                                    <p className="font-bold text-slate-900">{res.name}</p>
                                                    <p className="text-xs text-slate-500">{res.days}</p>
                                                </div>
                                                <div className="font-bold text-blue-600">
                                                    {res.price === 'Grátis' ? 'Grátis' : `R$ ${res.price}`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Badges de Garantia e Entrega */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                                    <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-slate-900 text-sm">Garantia de {(product as any).store_warranty_period || (product as any).brand_warranty_period || 90} dias</span>
                                        <span className="text-slate-400 text-xs ml-1.5">· Compra 100% segura</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                                    <Truck className="w-5 h-5 text-blue-600 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-slate-900 text-sm">Entregamos</span>
                                        <span className="text-slate-400 text-xs ml-1.5">· Calcule o frete pelo CEP acima</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* ── Seção full-width: Descrição + Especificações ── */}
                {(product.description || (product.specs && Object.keys(product.specs).length > 0)) && (
                    <div className="mt-10 space-y-8">

                        {/* Descrição Longa */}
                        {product.description && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                                <h3 className="text-xl font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100">
                                    Descrição do Produto
                                </h3>
                                <div
                                    className="prose prose-slate prose-sm max-w-none text-slate-600 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: product.description }}
                                />
                            </div>
                        )}

                        {/* Especificações Técnicas */}
                        {product.specs && Object.keys(product.specs).length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                                <h3 className="text-xl font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100">
                                    Especificações
                                </h3>
                                <div className="mt-4">
                                    {(() => {
                                        // Campos nunca exibidos publicamente (identificadores únicos de unidade e dados logísticos de cálculo)
                                        const HIDDEN_KEYS = new Set([
                                            'imei1', 'imei2', 'imei', 'serial', 'serial_number',
                                            'weight_kg', 'width_cm', 'height_cm', 'depth_cm', 'peso_kg', 'largura_cm', 'altura_cm', 'profundidade_cm',
                                            'tags_venda', 'cross_sell_tags', 'tags',
                                            'slug', 'meta_title', 'meta_description', 'keywords', 'exclude_from_seo'
                                        ]);

                                        // UUID regex — oculta valores que são IDs internos
                                        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

                                        // Labels de fallback para campos nativos (não custom)
                                        const NATIVE_LABELS: Record<string, string> = {
                                            color: 'Cor', storage: 'Armazenamento', ram: 'Memória RAM',
                                            version: 'Versão', versao: 'Versão',
                                            battery_health: 'Saúde da Bateria', battery_mah: 'Bateria (mAh)',
                                            display: 'Display (pol)',
                                            peso_g: 'Peso (g)',
                                            // Dimensões na exibição pública
                                            'dimensions.width_cm': 'Largura (cm)',
                                            'dimensions.height_cm': 'Altura (cm)',
                                            'dimensions.depth_cm': 'Profundidade (cm)',
                                            'dimensions.weight_kg': 'Peso (kg)',
                                            // Fallbacks explícitos para campos comuns que podem falhar no fetch de custom_fields público por RLS
                                            celular_slot_para_cartao: 'Slot para cartão',
                                            celular_biometria: 'Biometria',
                                            celular_tipo_de_protecao_de_tela: 'Proteção de tela',
                                            celular_fps_display: 'Display FPS',
                                            pontuacao_dxomak: 'Pontuação Dxomak',
                                            cam_principal_mpx: 'Câm. Principal (Mpx)',
                                            cam_selfie_mpx: 'Câm. Selfie (Mpx)',
                                            rede_operadora: 'Rede Operadora',
                                            tipo_de_tela: 'Formato de tela',
                                            tipo_de_display: 'Display de',
                                            entrada_fone_de_ouvido: 'Entrada de fone',
                                            antutu: 'Antutu',
                                            chipset: 'Chipset',
                                            processador: 'Processador',
                                            carregamento: 'Carregamento',
                                            gpu: 'GPU',
                                            nfc: 'NFC',
                                            rede: 'Rede',
                                            camera: 'Câmera',
                                        };

                                        // Configuração de Grupo de Especificações e Ícones
                                        const SPEC_GROUPS = [
                                            {
                                                id: 'identificacao',
                                                label: 'Principal',
                                                icon: Smartphone,
                                                keys: ['version', 'versao', 'color', 'storage', 'ram']
                                            },
                                            {
                                                id: 'tela',
                                                label: 'Tela',
                                                icon: Monitor,
                                                keys: ['display', 'tipo_de_display', 'tipo_de_tela', 'celular_fps_display', 'celular_tipo_de_protecao_de_tela']
                                            },
                                            {
                                                id: 'camera',
                                                label: 'Câmeras',
                                                icon: Camera,
                                                keys: ['cam_principal_mpx', 'cam_selfie_mpx', 'camera', 'pontuacao_dxomak']
                                            },
                                            {
                                                id: 'desempenho',
                                                label: 'Processamento',
                                                icon: Cpu,
                                                keys: ['chipset', 'processador', 'cpu', 'gpu', 'antutu']
                                            },
                                            {
                                                id: 'bateria',
                                                label: 'Bateria',
                                                icon: Battery,
                                                keys: ['battery_mah', 'battery_health', 'carregamento']
                                            },
                                            {
                                                id: 'conexoes',
                                                label: 'Conectividade',
                                                icon: Wifi,
                                                keys: ['rede_operadora', 'rede', 'network', 'network_type', 'nfc', 'bluetooth', 'wifi', 'usb', 'sim', 'celular_slot_para_cartao', 'entrada_fone_de_ouvido']
                                            },
                                            {
                                                id: 'fisico',
                                                label: 'Físico e Segurança',
                                                icon: ShieldCheck,
                                                keys: ['celular_biometria', 'resistencia', 'peso_g']
                                            }
                                        ];

                                        const specs = product.specs as Record<string, unknown>;
                                        const renderedKeys = new Set<string>();
                                        const allItems: { key: string, label: string, strVal: string }[] = [];

                                        // Auxiliar: processa o valor e adiciona na lista se for válido
                                        const tryAddItem = (key: string, label: string, value: unknown) => {
                                            if (HIDDEN_KEYS.has(key.toLowerCase())) return;
                                            const strVal = String(value ?? '').trim();
                                            if (!strVal || strVal === '0') return;
                                            if (uuidRegex.test(strVal)) return;
                                            if (renderedKeys.has(key.toLowerCase())) return;

                                            allItems.push({ key: key.toLowerCase(), label, strVal });
                                            renderedKeys.add(key.toLowerCase());
                                        };

                                        // ── 1. CAMPOS DO TEMPLATE DA CATEGORIA ──
                                        if (categoryConfig?.custom_fields && Array.isArray(categoryConfig.custom_fields)) {
                                            for (const field of categoryConfig.custom_fields) {
                                                const key: string = field.key || field.name?.toLowerCase().replace(/\s+/g, '_') || '';
                                                if (!key) continue;
                                                if (field.requirement === 'off' || field.requirement === 'hidden') continue;
                                                const label: string = customFieldNames[key] || field.label || field.name || key.replace(/_/g, ' ');
                                                tryAddItem(key, label, specs[key]);
                                            }
                                        }

                                        // ── 2. CAMPOS NATIVOS DA CATEGORIA ──
                                        for (const [nk, nl] of Object.entries(NATIVE_LABELS)) {
                                            tryAddItem(nk, nl, specs[nk]);
                                        }

                                        // ── 3. CAMPOS EXTRAS ──
                                        for (const [key, value] of Object.entries(specs)) {
                                            const label = customFieldNames[key] || key.replace(/_/g, ' ');
                                            tryAddItem(key, label, value);
                                        }

                                        // Agrupar itens mapeados
                                        const groupedItems: { group: typeof SPEC_GROUPS[0] | { id: string, label: string, icon: any, keys: string[] }, items: typeof allItems }[] = [];
                                        
                                        SPEC_GROUPS.forEach(group => {
                                            const groupItems = allItems.filter(item => group.keys.includes(item.key));
                                            if (groupItems.length > 0) {
                                                // Ordenar os itens dentro do grupo para seguir a ordem de chaves configurada no array `keys`
                                                groupItems.sort((a, b) => group.keys.indexOf(a.key) - group.keys.indexOf(b.key));
                                                groupedItems.push({ group, items: groupItems });
                                            }
                                        });

                                        // Coletar itens restantes que não caíram em nenhum grupo (Outros)
                                        const mappedKeys = new Set(SPEC_GROUPS.flatMap(g => g.keys));
                                        const othersItems = allItems.filter(item => !mappedKeys.has(item.key));
                                        
                                        if (othersItems.length > 0) {
                                            groupedItems.push({
                                                group: { id: 'outros', label: 'Outras Características', icon: Settings, keys: [] },
                                                items: othersItems
                                            });
                                        }

                                        return (
                                            <div className="flex flex-col gap-6 w-full">
                                                {groupedItems.map((g, index) => (
                                                    <div key={g.group.id} className={index !== 0 ? "pt-6 border-t border-slate-100" : ""}>
                                                        <div className="flex items-center gap-2 mb-4 text-slate-800">
                                                            <g.group.icon className="w-5 h-5 text-blue-600" />
                                                            <h4 className="font-bold text-base">{g.group.label}</h4>
                                                        </div>
                                                        <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-6 gap-x-4 text-sm pl-7">
                                                            {g.items.map(item => (
                                                                <div key={item.key} className="flex flex-col max-w-full">
                                                                    <dt className="text-slate-500 text-xs font-semibold uppercase tracking-wide truncate pr-2" title={item.label}>{item.label}</dt>
                                                                    <dd className="font-medium text-slate-900 mt-0.5 break-words pr-2">{item.strVal}</dd>
                                                                </div>
                                                            ))}
                                                        </dl>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                    </div>
                )}

                {/* Produtos Relacionados - Ocultado temporariamente a pedido do cliente */}
                {false && relatedProducts.length > 0 && (
                    <div className="mt-16 mb-8 pt-10 border-t border-slate-200">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-2">
                            <Smartphone size={24} className="text-blue-600" /> Quem comprou, curtiu também!
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                            {relatedProducts.map(rel => (
                                <ModernProductCard key={rel.id} product={rel} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Cross-Sell Dinâmico via Tags - Ocultado temporariamente a pedido do cliente */}
                {false && crossSellProducts.length > 0 && (
                    <div className="mt-8 mb-8 pt-10 border-t border-slate-200 bg-blue-50/50 p-6 rounded-3xl">
                        <h2 className="text-2xl font-bold text-blue-900 mb-2 flex items-center gap-2">
                            <Box size={24} className="text-blue-600" /> Aproveite e leve junto!
                        </h2>
                        <p className="text-blue-700/80 mb-8 text-sm">Itens perfeitamente compatíveis com este produto.</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                            {crossSellProducts.map(rel => (
                                <ModernProductCard key={rel.id} product={rel} />
                            ))}
                        </div>
                    </div>
                )}

            </main>

            {/* Sticky Mobile CTA */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden z-40 flex items-center gap-4">
                <div className="flex-1">
                    <p className="text-xs text-slate-500 uppercase font-bold">Total à vista</p>
                    <p className="text-xl font-extrabold text-blue-600">R$ {displayPrice.toFixed(2).replace('.', ',')}</p>
                </div>
                <button
                    onClick={handleAddToCart}
                    disabled={!product.track_inventory ? false : (product.stock_quantity || 0) <= 0}
                    className="flex-shrink-0 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg"
                >
                    <ShoppingCart size={20} />
                    {(!product.track_inventory || (product.stock_quantity || 0) > 0) ? 'Comprar' : 'Esgotado'}
                </button>
            </div>
        </div>
    );
};
