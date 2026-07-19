import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Share2, ShoppingCart, ShieldCheck, Truck, Smartphone, Monitor, Cpu, Camera, Battery, Wifi, Box, Settings, GitCompare, Facebook, Instagram, Package, Loader2, Layers, Pencil } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { useVpsAuth } from '@/contexts/VpsAuthContext';
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
import { calculateInstallmentFromFees, calculatePixPrice, formatPrice as formatCurrency } from '@/services/installmentCalculator';
import { publicCompanySettingsService, type PublicCompanySettings } from '@/services/publicCompanySettings';
import { generateGroupKey } from '@/services/productGrouping';
import { toTitleCase } from '@/utils/stringFormatters';
import { shippingService } from '@/services/shippingService';
import { getCacheBustedUrl } from '@/utils/cache-buster';
import { normalizeProduct } from '@/services/productNormalizer';
import { trackViewItem } from '@/utils/analytics';
import { catalogConfigService } from '@/services/catalogConfigService';
import type { CatalogSettings } from '@/types/catalogSettings';
import { vpsApiService } from '@/services/vpsApiService';
import { modelService } from '@/services/models';
import { modelColorImagesService } from '@/services/model-color-images';
import { colorService } from '@/services/colors';
import { buildProductVideoPlaylist, isMp4VideoUrl } from '@/utils/product-video-playlist';
import { getPublicProductName } from './publicProductName.js';
import { getPublicProductRouteTarget, getPublicProductVariantRouteTarget } from './productRouteTarget.js';
import { customFieldsService } from '@/services/custom-fields';
/**
 * PublicProductPage
 * A dedicated SEO-friendly landing page for a single product.
 */
export const PublicProductPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { customer } = useVpsAuth();
    const { addItem } = useCart();
    const { add: addToCompare, remove: removeFromCompare, isSelected: isComparing } = useCompare();

    const customerType = useEffectiveCustomerType();

    const [product, setProduct] = useState<CatalogProduct | null>(null);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string>('');
    const [siblings, setSiblings] = useState<CatalogProduct[]>([]);
    const [relatedProducts, setRelatedProducts] = useState<CatalogProduct[]>([]);
    const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
    const [crossSellProducts, setCrossSellProducts] = useState<CatalogProduct[]>([]);
    const [cep, setCep] = useState('');
    const [shippingResult, setShippingResult] = useState<{ name: string, price: string, days: string }[] | null>(null);
    const [cashbackSettings, setCashbackSettings] = useState<CashbackSettings | null>(null);
    const [companySettings, setCompanySettings] = useState<PublicCompanySettings | null>(null);
    const [paymentFees, setPaymentFees] = useState<PaymentFee[]>([]);
    const [catalogTheme, setCatalogTheme] = useState<Pick<CatalogSettings, 'primary_color' | 'secondary_color' | 'accent_color' | 'background_color' | 'card_background' | 'text_primary' | 'text_secondary'> | null>(null);
    const [comboChildren, setComboChildren] = useState<any[]>([]);
    const [selectedComboOptions, setSelectedComboOptions] = useState<Record<string, any>>({});
    const [selectedKitQuantity, setSelectedKitQuantity] = useState<number>(1);
    const [isQuoteCartOpen, setIsQuoteCartOpen] = useState(false);

    // Config da categoria: define quais campos existem no template
    const [categoryConfig, setCategoryConfig] = useState<any>(null);
    // Dicionário de chaves para nomes amigáveis baseados nos campos customizados do BD
    const [customFieldNames, setCustomFieldNames] = useState<Record<string, string>>({});
    // Frases que viram cabeçalho com negrito + linha em branco no render da descrição.
    // Carregadas da VPS; fallback hardcoded mantém a UX caso a chamada falhe.
    const [sectionHeaders, setSectionHeaders] = useState<string[]>([
        'Características do Produto',
        'Conteúdo da embalagem',
    ]);

    // Resolved video URL: prioridade video_url → HEAD check automático por SKU
    const [effectiveVideoUrl, setEffectiveVideoUrl] = useState<string | null>(null);
    const [videoLoadError, setVideoLoadError] = useState(false);
    const [videoPlaylistIndex, setVideoPlaylistIndex] = useState(0);
    const primaryColor = catalogTheme?.primary_color || '#2563eb';
    const secondaryColor = catalogTheme?.secondary_color || '#1d4ed8';
    const accentColor = catalogTheme?.accent_color || '#10b981';
    const backgroundColor = catalogTheme?.background_color || '#f8fafc';
    const cardBackground = catalogTheme?.card_background || '#ffffff';
    const textPrimary = catalogTheme?.text_primary || '#0f172a';
    const textSecondary = catalogTheme?.text_secondary || '#64748b';
    const productVideoPlaylist = useMemo(() => buildProductVideoPlaylist(effectiveVideoUrl), [effectiveVideoUrl]);
    const currentVideoUrl = productVideoPlaylist[videoPlaylistIndex] || effectiveVideoUrl;
    const formatDisplayPrice = (value: number) => value.toFixed(2).replace('.', ',');
    const resolveModelColorImagesForProduct = async (productLike: any): Promise<string[]> => {
        const modelId = productLike?.model_id;
        const specs = productLike?.specs || {};
        const colorName = String(specs.color || specs.cor || '').trim();
        if (!modelId || !colorName) return [];

        try {
            const colors = await colorService.listActive();
            const normalizedTarget = colorName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const color = colors.find((item: any) =>
                String(item.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === normalizedTarget ||
                String(item.id || '') === colorName
            );
            if (!color?.id) return [];

            const colorImages = await modelColorImagesService.get(String(modelId), String(color.id));
            return Array.isArray(colorImages?.images) ? colorImages.images.filter(Boolean) : [];
        } catch (error) {
            console.warn('[PublicProductPage] Falha ao carregar imagens por cor do modelo', error);
            return [];
        }
    };
    const getComboOptionStock = (option: any) => Math.max(0, Math.trunc(Number(option?.stock_quantity ?? 0) || 0));
    const getComboOptionDisplayName = (option: any, groupLabel: string) => {
        const name = String(option?.name || '').trim();
        const colorMatch = name.match(/\bCor\s*:\s*(.+)$/i);
        if (colorMatch?.[1]) return colorMatch[1].trim();

        const label = String(groupLabel || '').trim();
        if (label && name.toLowerCase().startsWith(label.toLowerCase())) {
            return name.slice(label.length).replace(/^[-\s|:]+/, '').trim() || name;
        }

        return name || option?.sku || 'Opcao';
    };
    const fixedComboChildren = useMemo(
        () => comboChildren.filter(item => item?.component_type !== 'choice_group'),
        [comboChildren]
    );
    const comboChoiceGroups = useMemo(() => {
        const groups = new Map<string, { group_key: string; label: string; quantity: number; options: any[] }>();
        comboChildren
            .filter(item => item?.component_type === 'choice_group')
            .forEach(item => {
                const key = String(item.group_key || item.parent_product_id || item.parent_id || item.id);
                const current = groups.get(key) || {
                    group_key: key,
                    label: item.group_label || item.label || item.name || 'Escolha uma opcao',
                    quantity: Math.max(1, Number(item.quantity) || 1),
                    options: [],
                };
                if (getComboOptionStock(item) > 0) current.options.push(item);
                groups.set(key, current);
            });
        return Array.from(groups.values());
    }, [comboChildren]);
    const visibleComboChoiceGroups = useMemo(
        () => comboChoiceGroups.filter(group => group.options.length > 1),
        [comboChoiceGroups]
    );
    const autoSelectedComboGroups = useMemo(
        () => comboChoiceGroups.filter(group => group.options.length === 1),
        [comboChoiceGroups]
    );
    const hasMissingComboChoice = useMemo(
        () => comboChoiceGroups.some(group => group.options.length === 0 || (group.options.length > 1 && !selectedComboOptions[group.group_key])),
        [comboChoiceGroups, selectedComboOptions]
    );
    const variantPriceRange = useMemo(() => {
        if (!product || selectedKitQuantity > 1) {
            return { min: 0, max: 0, hasRange: false };
        }

        const variantsById = new Map<string, CatalogProduct>();
        [product as CatalogProduct, ...siblings].forEach((item) => {
            if (item?.id) variantsById.set(String(item.id), item);
        });

        const prices = Array.from(variantsById.values())
            .map((item) => {
                const price = getEffectivePrice(item, customer) / 100;
                const discounted = item.discount_percentage
                    ? price * (1 - item.discount_percentage / 100)
                    : price;
                return Number.isFinite(discounted) && discounted > 0 ? discounted : null;
            })
            .filter((price): price is number => price !== null);

        if (prices.length < 2) {
            return { min: prices[0] || 0, max: prices[0] || 0, hasRange: false };
        }

        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return { min, max, hasRange: Math.round(min * 100) !== Math.round(max * 100) };
    }, [product, siblings, customer, selectedKitQuantity]);

    useEffect(() => {
        let cancelled = false;

        const resolveVideoUrl = async () => {
            setVideoLoadError(false);
            // 1. Se o produto tem video_url explícita, usa a URL salva
            if (product?.video_url) {
                setEffectiveVideoUrl(product.video_url);
                return;
            }

            // 2. Se não há SKU, sem vídeo
            if (!product?.sku) {
                setEffectiveVideoUrl(null);
                return;
            }

            // 3. Verifica via VPS proxy (evita bloqueio CORS)
            try {
                const json = await vpsApiService.checkVideoBySku(product.sku.trim());
                if (!cancelled) {
                    setEffectiveVideoUrl(json?.exists ? json.url || null : null);
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
        setVideoPlaylistIndex(0);
    }, [effectiveVideoUrl]);

    useEffect(() => {
        window.scrollTo(0, 0);
        getCashbackSettings().then(setCashbackSettings).catch(console.error);
        publicCompanySettingsService.get().then(setCompanySettings).catch(console.error);
        paymentFeesService.list().then(setPaymentFees).catch(console.error);
        vpsApiService.getPdpSectionHeaders()
            .then(rows => {
                if (Array.isArray(rows) && rows.length > 0) {
                    setSectionHeaders(rows.map(r => r.phrase).filter(Boolean));
                }
            })
            .catch(console.error);
        catalogConfigService
            .getSettings(customer?.user_id)
            .then((settings) => setCatalogTheme({
                primary_color: settings.primary_color || '#2563eb',
                secondary_color: settings.secondary_color || '#1d4ed8',
                accent_color: settings.accent_color || '#10b981',
                background_color: settings.background_color || '#f8fafc',
                card_background: settings.card_background || '#ffffff',
                text_primary: settings.text_primary || '#0f172a',
                text_secondary: settings.text_secondary || '#64748b',
            }))
            .catch(console.error);
        if (customer?.customer_type === 'ADMIN') {
            customFieldsService.list()
                .then((fieldsData) => {
                    if (fieldsData.length > 0) {
                        const dict: Record<string, string> = {};
                        fieldsData.forEach(f => { if (f.key) dict[f.key] = f.label; });
                        setCustomFieldNames(dict);
                    }
                })
                .catch((fieldError) => {
                    console.warn('[PublicProductPage] Dicionario de campos customizados indisponivel.', fieldError);
                });
        }
        if (!slug) {
            navigate('/');
            return;
        }

        const fetchProduct = async () => {
            setLoading(true);
            let criticalProductLoaded = false;
            try {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);

                let data: any = null;
                let error: any = null;
                const { vpsApiService } = await import('@/services/vpsApiService');

                // 1. Busca Direta do Produto na VPS (com 1 retry para evitar falsos positivos por latência)
                if (isUuid) {
                    data = await vpsApiService.getProductById(slug, true);
                } else {
                    data = await vpsApiService.getProductBySlug(slug);
                }


                // Fallback: se by-slug ainda não encontrou, tentar busca por search
                // (cobre produtos que existem na VPS mas não têm o campo slug preenchido)
                if (!data || data.error) {
                    try {
                        const searchTerms = Array.from(new Set([slug, slug.replace(/-/g, ' ')]));
                        let searchResults: any[] | null = null;

                        for (const term of searchTerms) {
                            searchResults = await vpsApiService.getProducts({ search: term, status: 'active', limit: 5 });
                            if (searchResults && searchResults.length > 0) break;
                        }

                        if (searchResults && searchResults.length > 0) {
                            // Prioriza match exato de slug, depois sku, depois primeiro resultado
                            const exactMatch = searchResults.find(p =>
                                p.slug === slug || p.sku?.toLowerCase() === slug.toLowerCase()
                            );
                            data = exactMatch || searchResults[0];
                        }
                    } catch (e) {
                         // Ignorar erros de rede na VPS
                    }
                }



                // Pai (agregador) - backend retorna redirect_to_slug pro primeiro filho disponivel.
                // Navega imediatamente pra URL do filho (replace=true para nao poluir historico).
                if (data?.is_parent_redirect && data?.redirect_to_slug) {
                    navigate(`/produto/${data.redirect_to_slug}`, { replace: true });
                    return;
                }

                if (data && data.hide_from_catalog) {
                    console.error('Not found: produto oculto do site:', slug);
                    toast.error('Produto não encontrado');
                    navigate('/');
                    return;
                }

                if (!data || data.error || data.status === 'inactive') {
                    console.error('Produto não encontrado ou inativo na VPS:', slug);
                    toast.error('Produto não encontrado');
                    navigate('/');
                    return;
                }

                const canonicalRouteTarget = getPublicProductRouteTarget(data);
                if (canonicalRouteTarget && canonicalRouteTarget !== slug) {
                    window.history.replaceState(null, '', `/produto/${encodeURIComponent(canonicalRouteTarget)}`);
                }

                if (data.offer_type && data.offer_visibility === 'hidden') {
                    toast.error('Produto não encontrado');
                    navigate('/');
                    return;
                }

                // Busca marca/descrição do modelo pela VPS como fallback quando o produto não envia.
                // Modelo guarda uma descrição padrão herdada por todos os produtos do mesmo modelo.
                // Trata descrições obviamente inválidas ('0', '<p>0</p>', muito curtas) como
                // ausentes — defensivo contra dados-lixo que surgem em alguns paths de save.
                const isMeaningfulDesc = (s: unknown): boolean => {
                    if (!s || typeof s !== 'string') return false;
                    const text = s.replace(/<[^>]+>/g, '').trim();
                    if (text.length < 5) return false;
                    if (/^[0-9\s]+$/.test(text)) return false;
                    return true;
                };
                const needsBrand = !data.brand && data.model_id;
                const needsDescription = !isMeaningfulDesc(data.description) && data.model_id;
                let modelTemplateValues: Record<string, unknown> = {};
                if (!isMeaningfulDesc(data.description)) data.description = null;
                if (data.model_id && (needsBrand || needsDescription)) {
                    try {
                        const modelData = await modelService.getById(data.model_id);

                        modelTemplateValues = modelData?.template_values || {};
                        const modelBrand = (modelData as any)?.brand || (modelData as any)?.brand_name;
                        if (needsBrand && modelBrand) {
                            data.brand = modelBrand;
                        }
                        if (needsDescription && modelData?.description) {
                            data.description = modelData.description;
                        }
                    } catch (e) {
                        console.warn('Falha ao tentar recuperar marca/descrição da VPS', e);
                    }
                }

                let parsedSpecs = data.specs;
                if (typeof parsedSpecs === 'string') {
                    try { parsedSpecs = JSON.parse(parsedSpecs); } catch { parsedSpecs = {}; }
                }
                data.specs = {
                    ...(modelTemplateValues || {}),
                    ...(parsedSpecs || {})
                };

                // Trata Combos e busca Filhos via VPS
                data.exclude_from_seo = Boolean(data.exclude_from_seo);
                if (data.is_combo) {
                    const children = await vpsApiService.getComboChildren(data.id);
                    setComboChildren(children || []);
                    setSelectedComboOptions({});

                    // Auto-generate combo description from children if empty
                    if (!data.description && children && children.length > 0) {
                        let mergedDesc = '';
                        let mergedSpecs = '';
                        
                        // Busca a descrição rica de cada item do combo diretamente da VPS
                        for (const child of children.filter((item: any) => item?.component_type !== 'choice_group')) {
                            try {
                                const childData = await vpsApiService.getProductById(child.id);
                                if (childData && !childData.error) {
                                    const cDesc = childData.description || '';
                                    const cSpecs = childData.technical_specifications || (childData.specs && childData.specs.technical_specifications ? childData.specs.technical_specifications : '');
                                    
                                    if (cDesc) {
                                        mergedDesc += (mergedDesc ? '<br><hr class="my-6 border-slate-200">' : '') + `<div style="margin:20px 0;"><h4 style="color:#000; font-weight:bold; margin-bottom:10px;">Item: ${child.name}</h4>${cDesc}</div>`;
                                    }
                                    if (cSpecs) {
                                        mergedSpecs += (mergedSpecs ? '<br><hr class="my-6 border-slate-200">' : '') + `<div style="margin:20px 0;"><h4 style="color:#000; font-weight:bold; margin-bottom:10px;">Ficha Técnica - ${child.name}</h4>${cSpecs}</div>`;
                                    }
                                }
                            } catch (e) {
                                console.warn('[PublicProductPage] Failed to fetch child for combo auto-description', child.id);
                            }
                        }

                        if (mergedDesc) data.description = mergedDesc;
                        if (mergedSpecs && !data.technical_specifications) data.technical_specifications = mergedSpecs;
                    }
                }
                
                // Categoria: a VPS fornece nome e config usados na PDP.
                const loadCategoryDetails = () => {
                    if (!data.category_id) return;
                    vpsApiService.getCategories()
                        .then((vpsCategories) => {
                            const vpscat = vpsCategories?.find((c: any) => String(c.id) === String(data.category_id));
                            if (vpscat?.config) setCategoryConfig(vpscat.config);
                            if (vpscat?.name) {
                                setProduct((current) => current && String(current.id) === String(data.id)
                                    ? { ...current, category: vpscat.name } as CatalogProduct
                                    : current
                                );
                            }
                        })
                        .catch((e) => {
                            console.warn('[PublicProductPage] Falha ao carregar categoria da VPS', e);
                        });
                };

                // VPS é a única fonte de verdade para description/technical_specifications.
                // Migração do VPS → VPS concluída em 31/03/2026 (568 produtos).
                
                const formattedProduct = {
                    ...normalizeProduct(data),
                    // Garante que o frontend ache que tem uma string de marca
                    brand: typeof data.brand === 'object' ? data.brand?.name : (data.brand || ''),
                };
                const resolvedImages = await resolveModelColorImagesForProduct(formattedProduct);
                const displayProduct = resolvedImages.length > 0
                    ? { ...formattedProduct, images: resolvedImages, image_url: resolvedImages[0] }
                    : formattedProduct;

                setSelectedVariantId(null);
                setProduct(displayProduct as unknown as CatalogProduct);
                criticalProductLoaded = true;
                trackViewItem(displayProduct);
                loadCategoryDetails();

                if (data.is_combo && data.tags?.includes('mosaic_combo') && displayProduct.images.length > 1) {
                    setSelectedImage('MOSAIC');
                } else if (displayProduct.images.length > 0) {
                    setSelectedImage(resolvedImages[0] || displayProduct.images[0]);
                }

                // Release the critical product view before secondary sections finish.
                setLoading(false);

                // -- Siblings (Variantes do mesmo modelo) via VPS --
                // IMPORTANTE: model_id pode ser generico em produtos importados. Reusamos
                // a mesma chave segura do catalogo para separar produtos sem variacao real.
                if (data.model_id && String(data.model_id) !== '0' && String(data.model_id) !== 'null') {
                    const currentGroupKey = generateGroupKey(data as unknown as CatalogProduct);
                    const sibs = await vpsApiService.getProducts({ model_id: data.model_id, status: 'active', limit: 50 });
                    if (sibs) {
                        const cleanSibs = sibs.map(s => normalizeProduct(s)).filter(s =>
                            (!s.offer_type || s.offer_visibility !== 'hidden') &&
                            String(s.model_id) === String(data.model_id) &&
                            generateGroupKey(s as unknown as CatalogProduct) === currentGroupKey
                        );
                        setSiblings(cleanSibs as unknown as CatalogProduct[]);
                    }
                } else if (data.parent_id && String(data.parent_id) !== '0' && String(data.parent_id) !== 'null') {
                    const sibs = await vpsApiService.getProducts({ parent_id: data.parent_id, status: 'active', limit: 50 });
                    if (sibs) {
                        const cleanSibs = sibs.map(s => normalizeProduct(s)).filter(s =>
                            (!s.offer_type || s.offer_visibility !== 'hidden') &&
                            String(s.parent_id) === String(data.parent_id)  // ← validação: só produtos do mesmo pai
                        );
                        setSiblings(cleanSibs as unknown as CatalogProduct[]);
                    }
                } else {
                    // Fallback para agrupar por nome (para produtos sem model_id ou parent_id)
                    const myGroupKey = generateGroupKey(data as unknown as CatalogProduct);
                    const searchStr = myGroupKey.replace(/^unknown_/, '').replace(/[-_]/g, ' ');
                    
                    if (searchStr.trim().length > 2) {
                        const searchResults = await vpsApiService.getProducts({ search: searchStr, status: 'active', limit: 50 });
                        if (searchResults) {
                            const cleanSibs = searchResults.map(s => normalizeProduct(s)).filter(s =>
                                (!s.offer_type || s.offer_visibility !== 'hidden') &&
                                generateGroupKey(s as unknown as CatalogProduct) === myGroupKey
                            );
                            setSiblings(cleanSibs as unknown as CatalogProduct[]);
                        }
                    }
                }

                // -- Relacionados (Mesma categoria) via VPS --
                if (data.category_id) {
                    const related = await vpsApiService.getProducts({ category: data.category_id, status: 'active', limit: 5 });
                    if (related) {
                        const cleanRelated = related.map(s => normalizeProduct(s))
                            .filter(s => (!s.offer_type || s.offer_visibility !== 'hidden') && s.id !== data.id)
                            .slice(0, 4);
                        setRelatedProducts(cleanRelated as unknown as CatalogProduct[]);
                    }
                }

                // -- Cross-sells (Recomendações Dinâmicas baseada na primeira tag) via VPS --
                const explicitTags = data.specs['tags_venda'] || data.specs['cross_sell_tags'] || data.specs['tags'];
                if (explicitTags) {
                    const tagList = Array.isArray(explicitTags) ? explicitTags : [explicitTags];
                    // Tenta achar qualquer tag com string minima e limpa
                    const firstTag = tagList.find(t => typeof t === 'string' && t.trim().length > 2);
                    if (firstTag) {
                        const crossSells = await vpsApiService.getProducts({ search: firstTag.trim(), status: 'active', limit: 8 });
                        if (crossSells) {
                            const cleanCross = crossSells.map(s => normalizeProduct(s))
                            // Evita sugerir os que já são relacionados da msm categoria
                            .filter(s => (!s.offer_type || s.offer_visibility !== 'hidden') && s.id !== data.id && s.category_id !== data.category_id)
                            .slice(0, 4);
                            
                            setCrossSellProducts(cleanCross as unknown as CatalogProduct[]);
                        }
                    }
                }
            } catch (err) {
                console.error('[PublicProductPage] Error fetching product:', err);
                if (!criticalProductLoaded) {
                    navigate('/');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [slug, navigate, customer?.user_id, customer?.customer_type]);

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
    const shouldShowVariantPriceRange = variantPriceRange.hasRange && !selectedVariantId && !isKitSelected;

    const pixDiscountPercent = Math.max(0, Number(companySettings?.pix_discount_percentage || 0));
    const pixPriceCents = calculatePixPrice(Math.round(displayPrice * 100), pixDiscountPercent);
    const pixPrice = pixPriceCents / 100;
    const pixDiscountLabel = pixDiscountPercent > 0 ? ` (${pixDiscountPercent}% de desconto)` : '';
    const installment12x = calculateInstallmentFromFees(Math.round(displayPrice * 100), paymentFees, 12);
    const value12x = installment12x.value / 100;
    const total12x = installment12x.total / 100;
    const installment12xLabel = `ou no cartão em até 12x de ${formatCurrency(installment12x.value)} (total ${formatCurrency(installment12x.total)})`;

    // Descrições salvas via admin podem ser texto puro (com \n) — vira bloco único
    // sob dangerouslySetInnerHTML. Converte para HTML quando não vier marcado.
    // Cabeçalhos vindos da VPS ganham negrito + margem extra para "pular linha".
    // Limpa HTML "sujo" vindo do Bling/admin: parágrafos vazios (com &nbsp;,
    // NBSP ou só whitespace) e sequências de <br> que viram linhas em branco.
    const cleanRichHtml = (html: string): string => {
        let result = html
            // A página já possui um H1 com o nome do produto. Conteúdo vindo do
            // cadastro pode conter outro H1; rebaixe-o para preservar a hierarquia.
            .replace(/<h1\b([^>]*)>/gi, '<h2$1>')
            .replace(/<\/h1>/gi, '</h2>')
            // <p>&nbsp;</p>, <p> </p>, <p><br></p>, <p> </p> etc — parágrafo vazio
            .replace(/<p\b[^>]*>(?:\s|&nbsp;|&#160;| |Â |<br\s*\/?\s*>)*<\/p>/gi, '')
            // 3+ <br> consecutivos viram apenas 2 (= 1 linha em branco)
            .replace(/(?:<br\s*\/?\s*>\s*){3,}/gi, '<br><br>')
            // múltiplas quebras de linha cruas entre tags viram só uma
            .replace(/(\r?\n\s*){3,}/g, '\n\n');

        // Aplica a regra de cabeçalhos conhecidos também em descrições HTML:
        // quando a frase aparece sozinha dentro de <p>, vira <strong> com
        // margem extra. Necessário pra descrições do Bling em HTML.
        const cleanHeaders = sectionHeaders.filter(h => h && h.trim());
        if (cleanHeaders.length > 0) {
            for (const h of cleanHeaders) {
                const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = new RegExp(`<p\\b[^>]*>\\s*(${escaped})\\s*<\\/p>`, 'gi');
                result = result.replace(pattern, '<p style="margin-top:1.5em"><strong>$1</strong></p>');
            }
        }
        return result;
    };

    const normalizeRichText = (raw: string): string => {
        if (/<\/?(p|div|br|h[1-6]|ul|ol|li|table|img|span|strong|em)\b/i.test(raw)) {
            return cleanRichHtml(raw);
        }
        const escape = (s: string) => s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const HDR_OPEN = String.fromCharCode(1);
        const HDR_CLOSE = String.fromCharCode(2);
        const cleanHeaders = sectionHeaders.filter(h => h && h.trim());
        let withMarkers = raw;
        if (cleanHeaders.length > 0) {
            const escapedHeaders = cleanHeaders
                .map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('|');
            const headerPattern = new RegExp(`\\s*(${escapedHeaders})\\s*`, 'gi');
            withMarkers = raw.replace(headerPattern, `\n\n${HDR_OPEN}$1${HDR_CLOSE}\n`);
        }
        return withMarkers
            .split(/\r?\n\s*\r?\n+/)
            .map(p => p.trim())
            .filter(Boolean)
            .map(p => {
                const isHeader = p.startsWith(HDR_OPEN);
                const body = escape(p)
                    .replace(new RegExp(HDR_OPEN, 'g'), '<strong>')
                    .replace(new RegExp(HDR_CLOSE, 'g'), '</strong>')
                    .replace(/\r?\n/g, '<br>');
                return isHeader
                    ? `<p style="margin-top:1.5em">${body}</p>`
                    : `<p>${body}</p>`;
            })
            .join('');
    };

    const pickFirstString = (candidates: unknown[]): string => {
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) {
                return normalizeRichText(candidate);
            }
        }
        return '';
    };

    const resolvedDescription = pickFirstString([
        product.description,
        (product as any).long_description,
        (product as any).descricao,
        product.specs?.description,
        product.specs?.descricao,
    ]);

    const resolvedTechnicalSpecifications = pickFirstString([
        (product as any).technical_specifications,
        (product as any).technicalSpecifications,
        product.specs?.technical_specifications,
        product.specs?.technicalSpecifications,
        product.specs?.ficha_tecnica,
    ]);

    const publicProductName = getPublicProductName(product);
    const publicProductTitle = toTitleCase(publicProductName);
    const title = `${publicProductTitle} | Mercado do Vale`;
    const description = product.meta_description || resolvedDescription || `Compre ${publicProductName} no Mercado do Vale.`;

    const handleAddToCart = () => {
        if (comboChoiceGroups.length > 0) {
            const missingGroup = comboChoiceGroups.find(group => group.options.length === 0 || (group.options.length > 1 && !selectedComboOptions[group.group_key]));
            if (missingGroup) {
                toast.error(`Escolha uma opcao para ${missingGroup.label}`);
                return;
            }
        }

        const comboSelections = comboChoiceGroups.map(group => ({
            group_key: group.group_key,
            label: group.label,
            quantity: group.quantity,
            option: {
                id: (selectedComboOptions[group.group_key] || group.options[0])?.id,
                name: (selectedComboOptions[group.group_key] || group.options[0])?.name,
                sku: (selectedComboOptions[group.group_key] || group.options[0])?.sku,
            },
        }));

        addItem(product, selectedKitQuantity, { comboSelections });
        toast.success(selectedKitQuantity > 1 ? `${selectedKitQuantity}x Produtos adicionados ao carrinho!` : 'Produto adicionado ao carrinho!', {
            icon: '🛒',
            duration: 3000
        });
        navigate('/carrinho');
    };

    const isInCompare = product ? isComparing(product.id) : false;
    const isAdmin = customer?.customer_type === 'ADMIN';
    const productModelId = String(product.model_id || '').trim();
    const productSlug = getPublicProductRouteTarget(product);
    const publicProductUrl = `https://www.mercadodovale.com.br/produto/${encodeURIComponent(productSlug)}`;
    const adminProductUrl = isAdmin && product?.id
        ? `/admin/products/${encodeURIComponent(product.id)}/${encodeURIComponent(productSlug)}`
        : '';
    const adminModelPanelUrl = isAdmin && productModelId && productModelId !== '0' && productModelId !== 'null'
        ? `/admin/products/models/${encodeURIComponent(productModelId)}`
        : '';

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

    // Monta o grupo completo de variacoes e evita desaparecimento ao trocar variante
    const allVariants = [product as CatalogProduct, ...siblings];
    const variantsById = new Map<string, CatalogProduct>();
    allVariants.forEach((item) => {
        if (item?.id) variantsById.set(String(item.id), item);
    });
    const variantPool = Array.from(variantsById.values());

    variantPool.forEach(item => {
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
    variantPool.forEach(item => {
        const lbl = (item as any)._displayLabel;
        if (!_seenLabels.has(lbl)) {
            _seenLabels.add(lbl);
            uniqueVariants.push(item);
        }
    });
    uniqueVariants.sort((a, b) => ((a as any)._displayLabel || '').localeCompare((b as any)._displayLabel || ''));

    const isSellableCatalogProduct = (item: CatalogProduct): boolean => {
        if (item.track_inventory === false) return true;
        return Number(item.stock_quantity || 0) > 0;
    };
    const sellableVariantOptions = uniqueVariants.filter(isSellableCatalogProduct);

    const readVariantSpec = (item: CatalogProduct, keys: string[]): string => {
        const specs = (item.specs || {}) as Record<string, unknown>;
        for (const key of keys) {
            const value = specs[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
            if (typeof value === 'number') return String(value);
            if (value && typeof value === 'object' && 'name' in value) {
                const name = (value as { name?: unknown }).name;
                if (typeof name === 'string' && name.trim()) return name.trim();
            }
        }
        return '';
    };

    const normalizeStorageLabel = (value: string): string => {
        const cleaned = value.replace(/\s+/g, '').toUpperCase();
        const match = cleaned.match(/(\d+(?:GB|TB))/i);
        return match ? match[1].toUpperCase() : value.trim();
    };

    function formatPdpListItem(item: string): string {
        const normalized = normalizePdpSpecText(item);
        if (normalized === 'adaptador') return 'Adaptador de tomada';
        return item;
    }

    function normalizePdpListItems(value: string): string[] {
        const seen = new Set<string>();
        return value
            .split(/\r?\n|[,;]+/)
            .map(item => item
                .replace(/^\s*(?:[-*•]|\d+[.)-]?|1\s*x?\s*)\s*/i, '')
                .trim()
            )
            .map(formatPdpListItem)
            .filter(item => {
                if (!item || seen.has(item.toLowerCase())) return false;
                seen.add(item.toLowerCase());
                return true;
            });
    }

    function normalizePdpSpecText(value: string): string {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function isListStyleSpecItem(item: { key: string, label: string }): boolean {
        const normalized = normalizePdpSpecText(`${item.key} ${item.label}`);
        return (
            normalized.includes('itens_que_acompanham') ||
            normalized.includes('conteudo_da_embalagem') ||
            normalized.includes('acompanha') ||
            normalized.includes('acessorios_inclusos') ||
            normalized.includes('brindes') ||
            normalized.includes('brinde')
        );
    }

    const getMemoryGroupLabel = (parts: { storage: string; ram: string }) => {
        if (parts.ram && parts.storage && !parts.storage.toLowerCase().startsWith('outras')) {
            return `${parts.ram} de Ram | ${parts.storage} de armazenamento`;
        }
        if (parts.ram) return `${parts.ram} de Ram`;
        return parts.storage;
    };

    const getVariantColorBorder = (colorName: string): string => {
        const normalized = normalizePdpSpecText(colorName);
        const colorMap: Record<string, string> = {
            preto: '#111827',
            preta: '#111827',
            black: '#111827',
            azul: '#2563eb',
            blue: '#2563eb',
            branco: '#d1d5db',
            branca: '#d1d5db',
            white: '#d1d5db',
            verde: '#16a34a',
            green: '#16a34a',
            vermelho: '#dc2626',
            vermelha: '#dc2626',
            red: '#dc2626',
            rosa: '#db2777',
            pink: '#db2777',
            roxo: '#7c3aed',
            roxa: '#7c3aed',
            purple: '#7c3aed',
            amarelo: '#ca8a04',
            amarela: '#ca8a04',
            yellow: '#ca8a04',
            cinza: '#6b7280',
            grafite: '#374151',
            prata: '#9ca3af',
            dourado: '#b45309',
            ouro: '#b45309',
        };
        return colorMap[normalized] || '#94a3b8';
    };

    const getStorageFromLabel = (label: string): string => {
        const matches = [...label.matchAll(/(\d+)\s*(GB|TB)/gi)];
        const storageMatch = matches.find(match => {
            const before = label.slice(Math.max(0, match.index - 5), match.index).toLowerCase();
            return !before.includes('ram');
        });
        return storageMatch ? `${storageMatch[1]}${storageMatch[2]}`.toUpperCase() : '';
    };

    const getVariantParts = (item: CatalogProduct) => {
        const displayLabel = String((item as any)._displayLabel || '');
        const storage = normalizeStorageLabel(
            readVariantSpec(item, ['storage', 'armazenamento', 'capacidade', 'memoria_interna']) ||
            getStorageFromLabel(displayLabel)
        );
        const ramFromSpec = readVariantSpec(item, ['ram', 'memoria_ram']);
        const ramFromLabel = displayLabel.match(/RAM\s*([0-9]+\s*(?:GB|MB|TB)?)/i)?.[1] || '';
        const ram = ramFromSpec || ramFromLabel;
        const colorFromSpec = readVariantSpec(item, ['color', 'cor']);
        const colorFromLabel = displayLabel
            .replace(/RAM\s*[0-9]+\s*(?:GB|MB|TB)?/gi, '')
            .replace(/[0-9]+\s*(?:GB|TB)/gi, '')
            .split('-')
            .map(part => part.trim())
            .filter(Boolean)[0] || '';
        const color = colorFromSpec || colorFromLabel || displayLabel || 'Padrão';

        return {
            storage: storage || 'Outras opções',
            ram: ram ? normalizeStorageLabel(ram) : '',
            color,
        };
    };

    const groupedVariantOptions = Array.from(sellableVariantOptions.reduce((groups, item) => {
        const parts = getVariantParts(item);
        const key = getMemoryGroupLabel(parts);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ item, ...parts });
        return groups;
    }, new Map<string, Array<{ item: CatalogProduct; storage: string; ram: string; color: string }>>()))
        .map(([memoryLabel, options]) => {
            const ramCount = new Set(options.map(option => option.ram).filter(Boolean)).size;
            return {
                memoryLabel,
                storage: options[0]?.storage || memoryLabel,
                options: options.sort((a, b) => a.color.localeCompare(b.color)),
                showRam: ramCount > 1,
            };
        })
        .sort((a, b) => {
            const parse = (value: string) => {
                const match = value.match(/(\d+)(GB|TB)/i);
                if (!match) return Number.MAX_SAFE_INTEGER;
                const size = Number(match[1]);
                return match[2].toUpperCase() === 'TB' ? size * 1024 : size;
            };
            return parse(a.storage) - parse(b.storage) || a.storage.localeCompare(b.storage);
        });
    const shouldShowVariantOptions = sellableVariantOptions.length > 1 || sellableVariantOptions.some((item) => {
        const parts = getVariantParts(item);
        return parts.storage !== 'Outras opções' || parts.color !== 'Padrão' || Boolean(parts.ram);
    });

    const getShareText = () => {
        const shareableVariants = sellableVariantOptions;
        const variantNames = shareableVariants.map(v => (v as any)._displayLabel).join(', ');
        const shareUrl = publicProductUrl;
        
        let text = `*${publicProductTitle}*\n`;
        if (variantNames) {
            text += `Disponível: ${variantNames}\n`;
        }
        text += `À vista no PIX: R$ ${pixPrice.toFixed(2).replace('.', ',')}${pixDiscountLabel}\n`;
        text += `Cartão: 12x de R$ ${value12x.toFixed(2).replace('.', ',')} (total R$ ${total12x.toFixed(2).replace('.', ',')})\n\n`;

        if (estimatedCoins > 0) {
            text += `Ganhe ${estimatedCoins} Moedas do Vale nessa compra!\n\n`;
        }

        text += `${shareUrl}\n\n`;
        text += `Visite o nosso site para ver essa e muitas outras opções de produtos!\n`;
        text += `_www.mercadodovale.com.br_`;
        return text;
    };

    const handleShareWhatsapp = () => {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(getShareText())}`;
        window.open(url, '_blank');
    };

    const handleShareFacebook = () => {
        const productUrl = publicProductUrl;
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}&quote=${encodeURIComponent(getShareText())}`;
        window.open(url, '_blank');
    };

    const handleShareInstagram = async () => {
        await navigator.clipboard.writeText(getShareText());
        toast.success('Texto copiado! Pronto para colar no seu Instagram.', { duration: 4000 });
        setTimeout(() => {
            window.open('https://www.instagram.com', '_blank');
        }, 1500);
    };

    const handleVariantChange = async (sib: CatalogProduct) => {
        // Altera os dados instantaneamente sem reload de página.
        // Algumas variantes podem vir "compactas" sem descrição/ficha completa.
        // Faz merge com o produto atual para não sumir conteúdo textual.
        const resolvedImages = await resolveModelColorImagesForProduct(sib);
        const mergedVariant = {
            ...sib,
            images: resolvedImages.length > 0 ? resolvedImages : sib.images,
            image_url: resolvedImages[0] || (sib as any).image_url,
            description: sib.description || product.description,
            meta_title: sib.meta_title || product.meta_title,
            meta_description: sib.meta_description || product.meta_description,
            specs: {
                ...(product.specs || {}),
                ...(sib.specs || {})
            },
            technical_specifications:
                (sib as any).technical_specifications ||
                (sib as any).technicalSpecifications ||
                (product as any).technical_specifications ||
                (product as any).technicalSpecifications,
        } as CatalogProduct;

        setSelectedVariantId(String(sib.id));
        setProduct(mergedVariant);
        if (mergedVariant.images && mergedVariant.images.length > 0) {
            setSelectedImage(resolvedImages[0] || mergedVariant.images[0]);
        }

        // Atualiza a URL na barra do navegador (sem triggerar novo fetch)
        const newUrl = `/produto/${getPublicProductVariantRouteTarget(sib, variantPool)}`;
        window.history.pushState(null, '', newUrl);

        // Scroll suave para o topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleComboOptionSelect = (groupKey: string, option: any) => {
        setSelectedComboOptions(prev => ({ ...prev, [groupKey]: option }));
        if (Array.isArray(option?.images) && option.images[0]) {
            setSelectedImage(option.images[0]);
        }
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

    const themeVars = {
        '--mdv-primary': primaryColor,
        '--mdv-secondary': secondaryColor,
        '--mdv-accent': accentColor,
        '--mdv-bg': backgroundColor,
        '--mdv-card': cardBackground,
        '--mdv-text-primary': textPrimary,
        '--mdv-text-secondary': textSecondary,
        '--mdv-primary-soft': `${primaryColor}22`,
        '--mdv-primary-soft-2': `${primaryColor}14`,
    } as React.CSSProperties;

    return (
        <div className="min-h-screen pb-20 mdv-theme-runtime" style={{ ...themeVars, backgroundColor }}>
            <style>{`
                .mdv-theme-runtime .mdv-text-primary{color:var(--mdv-text-primary)!important;}
                .mdv-theme-runtime .mdv-text-secondary{color:var(--mdv-text-secondary)!important;}
                .mdv-theme-runtime .mdv-text-primary-color{color:var(--mdv-primary)!important;}
                .mdv-theme-runtime .mdv-border-primary{border-color:var(--mdv-primary)!important;}
                .mdv-theme-runtime .mdv-bg-primary-soft{background-color:var(--mdv-primary-soft)!important;}
                .mdv-theme-runtime .mdv-bg-primary-soft-2{background-color:var(--mdv-primary-soft-2)!important;}
                .mdv-theme-runtime .mdv-card{background-color:var(--mdv-card)!important;}

                .mdv-theme-runtime .text-slate-900{color:var(--mdv-text-primary)!important;}
                .mdv-theme-runtime .text-slate-700,
                .mdv-theme-runtime .text-slate-600,
                .mdv-theme-runtime .text-slate-500,
                .mdv-theme-runtime .text-slate-400{color:var(--mdv-text-secondary)!important;}

                .mdv-theme-runtime .text-blue-900,
                .mdv-theme-runtime .text-blue-800,
                .mdv-theme-runtime .text-blue-700,
                .mdv-theme-runtime .text-blue-600{color:var(--mdv-primary)!important;}

                .mdv-theme-runtime .hover\:text-blue-600:hover,
                .mdv-theme-runtime .hover\:text-blue-700:hover{color:var(--mdv-primary)!important;}

                .mdv-theme-runtime .bg-blue-700,
                .mdv-theme-runtime .bg-blue-600{background-color:var(--mdv-primary)!important;}
                .mdv-theme-runtime .bg-blue-100,
                .mdv-theme-runtime .bg-blue-50{background-color:var(--mdv-primary-soft)!important;}

                .mdv-theme-runtime .border-blue-600,
                .mdv-theme-runtime .border-blue-100{border-color:var(--mdv-primary)!important;}

                .mdv-theme-runtime .ring-blue-600{--tw-ring-color:var(--mdv-primary)!important;}
                .mdv-theme-runtime .focus\:border-blue-500:focus{border-color:var(--mdv-primary)!important;}
                .mdv-theme-runtime .focus\:ring-blue-500\/20:focus{--tw-ring-color:var(--mdv-primary-soft)!important;}

                .mdv-theme-runtime .bg-white{background-color:var(--mdv-card)!important;}
                .mdv-theme-runtime .bg-slate-100,
                .mdv-theme-runtime .bg-slate-50{background-color:var(--mdv-bg)!important;}
            `}</style>
            <Helmet>
                <title>{title}</title>
                <meta name="description" content={description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)} />
                <link rel="canonical" href={publicProductUrl} />

                {/* Open Graph — WhatsApp, Facebook, LinkedIn */}
                <meta property="og:type" content="product" />
                <meta property="og:site_name" content="Mercado do Vale" />
                <meta property="og:title" content={title} />
                <meta property="og:description" content={description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)} />
                <meta property="og:image" content={product.images?.[0] || 'https://www.mercadodovale.com.br/og-cover.jpg'} />
                <meta property="og:url" content={publicProductUrl} />
                <meta property="og:locale" content="pt_BR" />

                {/* Twitter Card */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={title} />
                <meta name="twitter:description" content={description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)} />
                <meta name="twitter:image" content={product.images?.[0] || 'https://www.mercadodovale.com.br/og-cover.jpg'} />

                {product.exclude_from_seo && (
                    <meta name="robots" content="noindex, nofollow" />
                )}
            </Helmet>

            <PublicHeader />

            <FloatingCartButton onClick={() => setIsQuoteCartOpen(true)} />
            <QuoteCartSidebar
                isOpen={isQuoteCartOpen}
                onClose={() => setIsQuoteCartOpen(false)}
            />

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Breadcrumbs */}
                <nav className="flex items-center gap-2 text-sm text-slate-500 mb-8">
                    <button onClick={() => navigate('/')} className="hover:text-blue-600 transition-colors">
                        Início
                    </button>
                    {product.category && (
                        <>
                            <span>/</span>
                            <a
                                href={`/?categoria=${encodeURIComponent(typeof product.category === 'string' ? product.category : 'Categoria')}`}
                                className="hover:text-blue-600 transition-colors"
                                title="Ver produtos desta categoria"
                            >
                                {typeof product.category === 'string' ? product.category : 'Categoria'}
                            </a>
                        </>
                    )}
                    <span>/</span>
                    <span className="text-slate-900 font-medium truncate max-w-[200px] sm:max-w-xs">
                        {publicProductTitle}
                    </span>
                </nav>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Galeria de Imagens (Esquerda) */}
                    <div className="space-y-4">
                        <div className="aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center p-4">
                            {selectedImage === 'VIDEO' && currentVideoUrl ? (
                                videoLoadError ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                        <p className="text-sm font-medium">Vídeo temporariamente indisponível</p>
                                        <a href={currentVideoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                                            Tentar abrir diretamente
                                        </a>
                                    </div>
                                ) : isMp4VideoUrl(currentVideoUrl) ? (
                                    <video
                                        key={currentVideoUrl}
                                        src={currentVideoUrl}
                                        controls
                                        autoPlay
                                        className="w-full h-full object-contain shadow-lg rounded-lg bg-black"
                                        onEnded={() => {
                                            setVideoPlaylistIndex((index) => {
                                                const nextIndex = index + 1;
                                                return nextIndex < productVideoPlaylist.length ? nextIndex : index;
                                            });
                                        }}
                                        onError={() => setVideoLoadError(true)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col">
                                        <iframe
                                            src={currentVideoUrl.includes('youtube.com/watch?v=') ? currentVideoUrl.replace('watch?v=', 'embed/') : currentVideoUrl.includes('youtu.be/') ? currentVideoUrl.replace('youtu.be/', 'youtube.com/embed/') : currentVideoUrl}
                                            className="w-full h-full rounded-lg shadow-sm bg-white"
                                            allowFullScreen
                                            title="Vídeo do Produto"
                                        ></iframe>
                                        {!currentVideoUrl.includes('youtube.com') && !currentVideoUrl.includes('youtu.be') && (
                                            <a href={currentVideoUrl} target="_blank" rel="noreferrer" className="mt-4 text-sm text-center font-bold text-blue-600 hover:underline">
                                                O vídeo não carregou? Clique aqui para abrir
                                            </a>
                                        )}
                                    </div>
                                )
                            ) : selectedImage === 'MOSAIC' && product.images ? (
                                <div className={`w-full h-full grid gap-2 p-2 ${product.images.length === 2 ? 'grid-cols-2' : product.images.length === 3 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2 grid-rows-2'}`}>
                                    {product.images.slice(0, 4).map((img, i) => (
                                        <div key={i} className={`relative bg-white rounded-lg border border-slate-100 flex items-center justify-center p-2 overflow-hidden shadow-sm ${product.images!.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
                                            <img src={getCacheBustedUrl(img, product.updated_at || product.created_at)} alt={`Combo Item ${i+1}`} className="w-full h-full object-contain hover:scale-110 transition-transform duration-500" />
                                        </div>
                                    ))}
                                </div>
                            ) : selectedImage && selectedImage !== 'VIDEO' && selectedImage !== 'MOSAIC' ? (
                                <img
                                    src={getCacheBustedUrl(selectedImage, product.updated_at || product.created_at)}
                                    alt={product.meta_title || publicProductTitle}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-slate-400 font-medium">Sem imagem</div>
                            )}
                        </div>
                        {((product.images && product.images.length > 1) || effectiveVideoUrl || (Boolean(product.is_combo) && product.tags?.includes('mosaic_combo'))) && (
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {effectiveVideoUrl && (
                                    <button
                                        onClick={() => {
                                            setVideoLoadError(false);
                                            setVideoPlaylistIndex(0);
                                            setSelectedImage('VIDEO');
                                        }}
                                        className={`w-20 h-20 flex-shrink-0 bg-white rounded-lg border-2 overflow-hidden flex items-center justify-center ${selectedImage === 'VIDEO' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="text-blue-600 flex flex-col items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                            <span className="text-[10px] font-semibold mt-1 tracking-wider uppercase">Vídeo</span>
                                        </div>
                                    </button>
                                )}
                                {Boolean(product.is_combo) && product.tags?.includes('mosaic_combo') && product.images && product.images.length > 1 && (
                                    <button
                                        onClick={() => setSelectedImage('MOSAIC')}
                                        className={`w-20 h-20 flex-shrink-0 bg-white rounded-lg border-2 overflow-hidden flex items-center justify-center ${selectedImage === 'MOSAIC' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="text-blue-600 flex flex-col items-center">
                                            <Layers size={24} />
                                            <span className="text-[10px] font-semibold mt-1 tracking-wider uppercase">Kit</span>
                                        </div>
                                    </button>
                                )}
                                {product.images?.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImage(img)}
                                        className={`w-20 h-20 flex-shrink-0 bg-white rounded-lg border-2 overflow-hidden ${selectedImage === img ? 'border-blue-600' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <img src={getCacheBustedUrl(img, product.updated_at || product.created_at)} alt={`${product.meta_title || publicProductTitle} - Ângulo ${idx + 1}`} className="w-full h-full object-contain p-1" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Informações do Produto (Direita) */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
                                {publicProductTitle}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-slate-500">
                                <span>
                                    SKU: <span className="font-mono">{product.sku || '—'}</span>
                                </span>
                                {!(product as any).is_combo && (
                                    <>
                                        <span className="text-slate-300">|</span>
                                        <span>
                                            Marca:{' '}
                                            <span>
                                                {typeof product.brand === 'string' && product.brand ? toTitleCase(product.brand) : '—'}
                                            </span>
                                        </span>
                                    </>
                                )}
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
                                            ? 'border-blue-600 bg-blue-100 text-blue-800 font-semibold' 
                                            : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 hover:bg-slate-200'
                                    }`}
                                >
                                    <GitCompare size={16} className={isInCompare ? "text-blue-700" : "text-slate-600"} />
                                    {isInCompare ? 'Comparando' : 'Comparar'}
                                </button>
                                {adminProductUrl && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(adminProductUrl)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-100 text-amber-900 hover:border-amber-400 hover:bg-amber-200 transition-all text-sm font-semibold shadow-sm"
                                        title="Editar produto no admin"
                                    >
                                        <Pencil size={16} className="text-amber-800" />
                                        Editar produto
                                    </button>
                                )}
                                {adminModelPanelUrl && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(adminModelPanelUrl)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100 transition-all text-sm font-semibold shadow-sm"
                                        title="Abrir painel do modelo"
                                    >
                                        <Settings size={16} className="text-amber-700" />
                                        Painel do modelo
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Variantes (Cores / Capacidades) */}
                        {shouldShowVariantOptions && (
                            <div className="pt-2">
                                <h3 className="text-sm font-semibold text-slate-900 mb-3">Opções disponíveis:</h3>
                                <div className="space-y-4">
                                    {groupedVariantOptions.map((group) => (
                                        <div key={group.memoryLabel} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                            <div className="mb-2">
                                                <h4 className="text-sm font-semibold text-slate-800">{group.memoryLabel}</h4>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {group.options.map(({ item: sib, color, ram }) => {
                                                    const isCurrent = sib.id === product.id;
                                                    const isOutOfStock = Boolean(sib.track_inventory) && ((sib.stock_quantity || 0) <= 0);
                                                    const buttonLabel = color;
                                                    const variantButtonStateClasses = isOutOfStock
                                                        ? 'relative overflow-hidden border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed opacity-75 shadow-inner'
                                                        : isCurrent
                                                            ? 'border-slate-950 bg-white text-slate-950 ring-2 ring-slate-950 shadow-sm'
                                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-white';

                                                    return (
                                                        <button
                                                            key={sib.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isOutOfStock) return;
                                                                handleVariantChange(sib);
                                                            }}
                                                            disabled={isOutOfStock}
                                                            aria-disabled={isOutOfStock}
                                                            title={isOutOfStock ? `${buttonLabel} esgotado` : buttonLabel}
                                                            className={`min-h-11 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-300 ${variantButtonStateClasses}`}
                                                            style={{ borderColor: getVariantColorBorder(color) }}
                                                        >
                                                            <span className={isOutOfStock ? 'line-through decoration-2 decoration-slate-500/70' : ''}>
                                                                {buttonLabel}
                                                            </span>
                                                            {isOutOfStock && (
                                                                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                    Esgotado
                                                                </span>
                                                            )}
                                                            {isOutOfStock && (
                                                                <span className="pointer-events-none absolute inset-x-[-20%] top-1/2 h-px -rotate-12 bg-slate-400/60" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Preço */}
                        <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden">
                            {totalGroupStock !== undefined && totalGroupStock > 0 && totalGroupStock <= 2 && (
                                <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-xs font-semibold text-center py-1 animate-pulse">
                                    Últimas unidades em estoque!
                                </div>
                            )}
                            <div className={totalGroupStock !== undefined && totalGroupStock > 0 && totalGroupStock <= 2 ? "mt-4" : ""}>
                                {product.discount_percentage && !isKitSelected ? (
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg text-slate-400 line-through">
                                                R$ {formatDisplayPrice(originalPrice)}
                                            </span>
                                            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                                -{product.discount_percentage}% OFF
                                            </span>
                                        </div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">À vista no PIX{pixDiscountLabel}</p>
                                        <div className="text-3xl sm:text-4xl font-bold text-slate-900">
                                            {shouldShowVariantPriceRange ? (
                                                <>
                                                    R$ {formatDisplayPrice(variantPriceRange.min)}
                                                    <span className="mx-2 text-2xl text-slate-500">a</span>
                                                    R$ {formatDisplayPrice(variantPriceRange.max)}
                                                </>
                                            ) : (
                                                <>R$ {formatDisplayPrice(customerType !== 'wholesale' ? pixPrice : displayPrice)}</>
                                            )}
                                        </div>
                                        {customerType !== 'wholesale' && (
                                            <p className="text-sm font-medium text-green-600 mt-1">
                                                {installment12xLabel}
                                            </p>
                                        )}
                                        {customerType !== 'wholesale' && estimatedCoins > 0 && (
                                            <div className="mt-2 ml-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm font-semibold border border-amber-200">
                                                <span className="text-base leading-none">🪙</span>
                                                Ganhe {estimatedCoins} Moedas do Vale
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">À vista no PIX{pixDiscountLabel}</p>
                                        <div className="text-3xl sm:text-4xl font-bold text-slate-900">
                                            {shouldShowVariantPriceRange ? (
                                                <>
                                                    R$ {formatDisplayPrice(variantPriceRange.min)}
                                                    <span className="mx-2 text-2xl text-slate-500">a</span>
                                                    R$ {formatDisplayPrice(variantPriceRange.max)}
                                                </>
                                            ) : (
                                                <>R$ {formatDisplayPrice(customerType !== 'wholesale' ? pixPrice : displayPrice)}</>
                                            )}
                                        </div>
                                        {customerType !== 'wholesale' && (
                                            <p className="text-sm font-medium text-green-600 mt-1">
                                                {installment12xLabel}
                                            </p>
                                        )}
                                        {customerType !== 'wholesale' && estimatedCoins > 0 && (
                                            <div className="mt-2 ml-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm font-semibold border border-amber-200">
                                                <span className="text-base leading-none">🪙</span>
                                                Ganhe {estimatedCoins} Moedas do Vale
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Seletor de Kits (Descontos por Volume) */}
                                {product.kits && product.kits.length > 0 && (
                                    <div className="mt-6 pt-4 border-t border-slate-100">
                                        <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
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
                                                    <div className="font-semibold text-slate-900">R$ {baseDiscountedPrice.toFixed(2).replace('.', ',')}</div>
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
                                                            <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-bl-lg">
                                                                Economia de R$ {savings.toFixed(2).replace('.', ',')}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between w-full mt-1">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${selectedKitQuantity === kit.quantity ? 'border-blue-600' : 'border-slate-300'}`}>
                                                                    {selectedKitQuantity === kit.quantity && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                                                </div>
                                                                <div className="text-left">
                                                                    <span className="font-semibold text-blue-900">{kit.name || `Kit com ${kit.quantity} Unidades`}</span>
                                                                    <div className="text-xs text-blue-600 font-medium">R$ {unitPriceDisplay} cada</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right pl-2">
                                                                <div className="font-semibold text-slate-900 text-lg">R$ {kitPriceDisplay}</div>
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
                                    <div className="mt-8 pt-6 border-t border-slate-100">
                                        <h4 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                            <Package size={20} className="text-blue-600" />
                                            O que vem neste Combo:
                                        </h4>
                                        <div className="space-y-3">
                                            {fixedComboChildren.map((item, idx) => {
                                                const itemPrice = typeof item.promotional_price === 'number' && item.promotional_price > 0 
                                                    ? item.promotional_price 
                                                    : (item.price || item.price_retail || 0);
                                                const priceReais = (itemPrice / 100).toFixed(2).replace('.', ',');
                                                
                                                // Extract brand dynamically if string exists
                                                const brandName = typeof item.brand === 'string' ? item.brand : item.brand?.name;
                                                const displayName = brandName ? `${item.name} - ${brandName}` : item.name;

                                                return (
                                                    <div key={idx} className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="flex items-start gap-3 sm:gap-4">
                                                            <div className="bg-slate-100 text-slate-700 font-semibold text-sm px-3 py-1.5 rounded-lg border border-slate-200 mt-0.5">
                                                            {item.quantity}x
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-slate-800 font-medium leading-snug">{displayName}</span>
                                                                {item.sku && (
                                                                    <span className="text-slate-400 text-xs mt-1">
                                                                        SKU: <span className="font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500">{item.sku}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {itemPrice > 0 && (
                                                            <div className="text-right pl-4 flex-shrink-0">
                                                                <span className="text-slate-400 text-[11px] uppercase font-medium tracking-wider block mb-0.5">Separado</span>
                                                                <span className="text-slate-700 font-semibold text-sm">R$ {priceReais}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {autoSelectedComboGroups.map(group => {
                                                const option = group.options[0];
                                                return (
                                                    <div key={group.group_key} className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100 shadow-sm">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-start gap-3">
                                                                <ShieldCheck size={20} className="mt-0.5 text-emerald-600 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-slate-900 font-semibold leading-snug">{group.label}</p>
                                                                    <p className="text-sm text-emerald-700 font-semibold mt-1">Selecionado</p>
                                                                    <p className="text-xs text-slate-500 mt-0.5">{getComboOptionDisplayName(option, group.label)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="bg-white text-emerald-700 font-semibold text-sm px-3 py-1.5 rounded-lg border border-emerald-100">
                                                                Incluso no combo
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {visibleComboChoiceGroups.map(group => (
                                                <div key={group.group_key} className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
                                                    <div className="mb-3 flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-slate-900 font-semibold leading-snug">{group.label}</p>
                                                            <p className="text-xs text-slate-500">Escolha {group.quantity} opcao para este combo</p>
                                                        </div>
                                                        <div className="bg-orange-50 text-orange-700 font-semibold text-sm px-3 py-1.5 rounded-lg border border-orange-100">
                                                            {group.quantity}x
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {group.options.map(option => {
                                                            const selected = selectedComboOptions[group.group_key]?.id === option.id;
                                                            return (
                                                                <button
                                                                    key={option.id}
                                                                    type="button"
                                                                    onClick={() => handleComboOptionSelect(group.group_key, option)}
                                                                    className={`min-h-[40px] rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                                                                        selected
                                                                            ? 'border-orange-500 bg-orange-50 text-orange-800 ring-1 ring-orange-500'
                                                                            : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/60'
                                                                    }`}
                                                                >
                                                                    {getComboOptionDisplayName(option, group.label)}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Total e Desconto do Combo */}
                                        {(() => {
                                            const selectedChoiceItems = comboChoiceGroups
                                                .map(group => selectedComboOptions[group.group_key] || group.options[0])
                                                .filter(Boolean)
                                                .map((option, index) => ({
                                                    ...option,
                                                    quantity: comboChoiceGroups[index]?.quantity || option.quantity || 1,
                                                }));
                                            const indivTotalCents = [...fixedComboChildren, ...selectedChoiceItems].reduce((acc, item) => {
                                                const p = typeof item.promotional_price === 'number' && item.promotional_price > 0 
                                                    ? item.promotional_price 
                                                    : (item.price || item.price_retail || 0);
                                                return acc + (p * (item.quantity || 1));
                                            }, 0);
                                            const indivTotalReais = indivTotalCents / 100;
                                            const comboPriceReais = baseDiscountedPrice;
                                            const discountReais = indivTotalReais - comboPriceReais;

                                            if (discountReais > 0 && indivTotalReais > 0) {
                                                return (
                                                    <div className="mt-5 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100/50 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                                                        <div>
                                                            <p className="text-sm text-emerald-800/80 font-medium flex items-center gap-2">
                                                                Comprando separados: 
                                                                <span className="line-through decoration-emerald-800/30">R$ {indivTotalReais.toFixed(2).replace('.', ',')}</span>
                                                            </p>
                                                            <p className="text-base font-semibold text-emerald-950 mt-1">
                                                                Saindo por: R$ {comboPriceReais.toFixed(2).replace('.', ',')}
                                                            </p>
                                                        </div>
                                                        <div className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-emerald-600/20 flex flex-col items-center leading-tight min-w-[140px]">
                                                            <span className="text-emerald-100 text-[10px] uppercase tracking-wider">Você Economiza</span>
                                                            <span className="text-lg">R$ {discountReais.toFixed(2).replace('.', ',')}</span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                )}

                                <div className="mt-6">
                                    {/* Aviso de prazo de produção (Sob Encomenda) */}
                                    {((product as any).effective_production_days ?? (product as any).production_days ?? 0) > 0 && (
                                        <div className="mb-3 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                                            <span className="text-xl mt-0.5">⚙️</span>
                                            <div>
                                                <p className="font-semibold text-amber-800 text-sm">
                                                    Produzido sob encomenda
                                                </p>
                                                <p className="text-xs text-amber-700 mt-0.5">
                                                    Este produto é fabricado após o pedido. Prazo de produção:{' '}
                                                    <span className="font-bold">
                                                        {(product as any).effective_production_days ?? (product as any).production_days} dias úteis
                                                    </span>
                                                    {' '}+ prazo de entrega.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleAddToCart}
                                        disabled={hasMissingComboChoice || (!product.track_inventory ? false : (product.stock_quantity || 0) <= 0)}
                                        style={(hasMissingComboChoice || (!product.track_inventory ? false : (product.stock_quantity || 0) <= 0)) ? undefined : { backgroundColor: primaryColor, boxShadow: `0 10px 24px -10px ${primaryColor}66` }}
                                        className="w-full flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-xl transition-opacity hover:opacity-90 shadow-lg text-lg"
                                    >
                                        <ShoppingCart size={24} />
                                        {hasMissingComboChoice
                                            ? 'Escolha as opcoes do combo'
                                            : (!product.track_inventory || (product.stock_quantity || 0) > 0) ? 'Adicionar ao Carrinho' : 'Fora de Estoque'}
                                    </button>
                                </div>
                            </div>

                            {/* Calculadora de Frete */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
                                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Truck size={16} style={{ color: primaryColor }} /> Consultar Frete e Prazo
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
                                        className="px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors min-w-[110px] flex justify-center items-center"
                                    >
                                        {isCalculatingShipping ? <Loader2 size={18} className="animate-spin" /> : 'Calcular'}
                                    </button>
                                </div>

                                {shippingResult && (
                                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                                        {shippingResult.map((res, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm p-3 rounded-lg bg-slate-50 border border-slate-100">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{res.name}</p>
                                                    <p className="text-xs text-slate-500">{res.days}</p>
                                                </div>
                                                <div className="font-semibold" style={{ color: primaryColor }}>
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
                                {((product as any).effective_production_days ?? (product as any).production_days ?? 0) > 0 && (
                                    <div className="flex items-center gap-3 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200">
                                        <Settings className="w-5 h-5 text-amber-600 shrink-0" />
                                        <div className="min-w-0">
                                            <span className="font-semibold text-amber-800 text-sm">Fabricação: {(product as any).effective_production_days ?? (product as any).production_days} dias úteis</span>
                                            <span className="text-amber-600 text-xs ml-1.5">· Sob encomenda</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>

                {/* ── Seção full-width: Descrição + Especificações ── */}
                {(resolvedDescription || resolvedTechnicalSpecifications || (product.specs && Object.keys(product.specs).length > 0)) && (
                    <div className="mt-10 space-y-8">

                        {/* Descrição Longa */}
                        {resolvedDescription && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                                <h3 className="text-lg font-semibold text-slate-900 mb-5 pb-3 border-b border-slate-100">
                                    Descrição do Produto
                                </h3>
                                <div
                                    className="pdp-rich-description max-w-none text-slate-700 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: resolvedDescription }}
                                />
                            </div>
                        )}

                        {/* Especificações Técnicas Longas */}
                        {resolvedTechnicalSpecifications && resolvedTechnicalSpecifications !== resolvedDescription && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                                <h3 className="text-lg font-semibold text-slate-900 mb-5 pb-3 border-b border-slate-100">
                                    Ficha Técnica
                                </h3>
                                <div
                                    className="pdp-rich-description max-w-none text-slate-700 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: resolvedTechnicalSpecifications }}
                                />
                            </div>
                        )}

                        {/* Especificações Técnicas */}
                        {product.specs && Object.keys(product.specs).length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                                <h3 className="text-lg font-semibold text-slate-900 mb-5 pb-3 border-b border-slate-100">
                                    Especificações
                                </h3>
                                <div className="mt-4">
                                    {(() => {
                                        // Campos nunca exibidos publicamente (identificadores únicos de unidade e dados logísticos de cálculo)
                                        const HIDDEN_KEYS = new Set([
                                            'imei1', 'imei2', 'imei', 'serial', 'serial_number',
                                            'weight_kg', 'width_cm', 'height_cm', 'depth_cm', 'peso_kg', 'largura_cm', 'altura_cm', 'profundidade_cm',
                                            'tags_venda', 'cross_sell_tags', 'tags',
                                            'bling_name_sync',
                                            'slug', 'meta_title', 'meta_description', 'keywords', 'exclude_from_seo',
                                            'shopee_attribute_defaults', 'shopee_attribute_labels', 'shopee_attribute_required'
                                        ]);

                                        // UUID regex — oculta valores que são IDs internos
                                        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

                                        // Labels de fallback para campos nativos (não custom)
                                        const NATIVE_LABELS: Record<string, string> = {
                                            color: 'Cor', storage: 'Armazenamento', ram: 'Memória RAM',
                                            memoria_ram_virtual: 'Memória RAM Virtual',
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
                                            resolucao_tela: 'Resolução da tela',
                                            taxa_atualizacao_hz: 'Taxa de atualização',
                                            brilho_nits: 'Brilho',
                                            pontuacao_dxomak: 'Pontuação Dxomak',
                                            cam_principal_mpx: 'Câm. Principal (Mpx)',
                                            cam_selfie_mpx: 'Câm. Selfie (Mpx)',
                                            camera_principal_mpx: 'Câm. Principal (Mpx)',
                                            camera_selfie_mpx: 'Câm. Selfie (Mpx)',
                                            camera_ultrawide_mpx: 'Câm. Ultrawide (Mpx)',
                                            camera_macro_mpx: 'Câm. Macro (Mpx)',
                                            camera_depth_mpx: 'Câm. Profundidade (Mpx)',
                                            camera_teleobjetiva_mpx: 'Câm. Teleobjetiva (Mpx)',
                                            camera_periscopio_mpx: 'Câm. Periscópio (Mpx)',
                                            camera_traseira_mpx: 'Câm. Traseira (Mpx)',
                                            camera_frontal_mpx: 'Câm. Frontal (Mpx)',
                                            rede_operadora: 'Rede Operadora',
                                            tipo_de_tela: 'Formato de tela',
                                            tipo_de_display: 'Display de',
                                            entrada_fone_de_ouvido: 'Entrada de fone',
                                            antutu: 'Antutu',
                                            chipset: 'Chipset',
                                            processador: 'Processador',
                                            carregamento: 'Carregamento',
                                            carregamento_w: 'Carregamento (W)',
                                            gpu: 'GPU',
                                            cpu: 'CPU',
                                            litografia_nm: 'Litografia',
                                            nucleos_cpu: 'Núcleos da CPU',
                                            nfc: 'NFC',
                                            irda: 'IrDA',
                                            gps: 'GPS',
                                            bluetooth: 'Bluetooth',
                                            wifi: 'Wi-Fi',
                                            usb: 'USB',
                                            sim: 'SIM',
                                            rede: 'Rede',
                                            camera: 'Câmera',
                                            camera_traseira_video: 'Câmera traseira vídeo',
                                            camera_frontal_video: 'Câmera frontal vídeo',
                                        };

                                        // Configuração de Grupo de Especificações e Ícones
                                        const SPEC_GROUPS = [
                                            {
                                                id: 'identificacao',
                                                label: 'Principal',
                                                icon: Smartphone,
                                                keys: ['version', 'versao', 'color', 'storage', 'ram', 'memoria_ram_virtual']
                                            },
                                            {
                                                id: 'tela',
                                                label: 'Tela',
                                                icon: Monitor,
                                                keys: ['display', 'tipo_de_display', 'tipo_de_tela', 'celular_fps_display', 'taxa_atualizacao_hz', 'brilho_nits', 'resolucao_tela', 'celular_tipo_de_protecao_de_tela']
                                            },
                                            {
                                                id: 'camera',
                                                label: 'Câmeras',
                                                icon: Camera,
                                                keys: ['cam_principal_mpx', 'cam_selfie_mpx', 'camera_principal_mpx', 'camera_selfie_mpx', 'camera_ultrawide_mpx', 'camera_macro_mpx', 'camera_depth_mpx', 'camera_teleobjetiva_mpx', 'camera_periscopio_mpx', 'camera_traseira_mpx', 'camera_frontal_mpx', 'camera', 'camera_traseira_video', 'camera_frontal_video', 'pontuacao_dxomak']
                                            },
                                            {
                                                id: 'desempenho',
                                                label: 'Processamento',
                                                icon: Cpu,
                                                keys: ['processador', 'cpu', 'gpu', 'chipset', 'antutu', 'litografia_nm', 'nucleos_cpu']
                                            },
                                            {
                                                id: 'bateria',
                                                label: 'Bateria',
                                                icon: Battery,
                                                keys: ['battery_mah', 'battery_health', 'carregamento', 'carregamento_w']
                                            },
                                            {
                                                id: 'conexoes',
                                                label: 'Conectividade',
                                                icon: Wifi,
                                                keys: ['rede_operadora', 'rede', 'network', 'network_type', 'nfc', 'irda', 'gps', 'bluetooth', 'wifi', 'usb', 'sim', 'celular_slot_para_cartao', 'entrada_fone_de_ouvido']
                                            },
                                            {
                                                id: 'fisico',
                                                label: 'Físico e Segurança',
                                                icon: ShieldCheck,
                                                keys: ['celular_biometria', 'resistencia']
                                            },
                                            {
                                                id: 'logistica',
                                                label: 'Logística',
                                                icon: Truck,
                                                keys: ['dimensions.width_cm', 'dimensions.height_cm', 'dimensions.depth_cm', 'dimensions.weight_kg', 'largura_cm', 'altura_cm', 'profundidade_cm', 'peso_g', 'peso_kg', 'weight_kg']
                                            }
                                        ];

                                        const specs = product.specs as Record<string, unknown>;
                                        const publicSpecs: Record<string, unknown> = { ...specs };
                                        const publicSpecLabels: Record<string, string> = { ...customFieldNames };
                                        HIDDEN_KEYS.add('battery_health');
                                        const shopeeAttributeDefaults = specs.shopee_attribute_defaults && typeof specs.shopee_attribute_defaults === 'object' && !Array.isArray(specs.shopee_attribute_defaults)
                                            ? specs.shopee_attribute_defaults as Record<string, unknown>
                                            : {};
                                        const shopeeAttributeLabels = specs.shopee_attribute_labels && typeof specs.shopee_attribute_labels === 'object' && !Array.isArray(specs.shopee_attribute_labels)
                                            ? specs.shopee_attribute_labels as Record<string, unknown>
                                            : {};
                                        Object.entries(shopeeAttributeDefaults).forEach(([attributeId, value]) => {
                                            const label = String(shopeeAttributeLabels[attributeId] || '').trim();
                                            publicSpecs[`shopee_attribute_${attributeId}`] = value;
                                            if (label) publicSpecLabels[`shopee_attribute_${attributeId}`] = label;
                                        });
                                        const renderedKeys = new Set<string>();
                                        const allItems: { key: string, label: string, strVal: string }[] = [];

                                        // Auxiliar: processa o valor e adiciona na lista se for válido
                                        const tryAddItem = (key: string, label: string, value: unknown) => {
                                            if (HIDDEN_KEYS.has(normalizePdpSpecText(key)) || HIDDEN_KEYS.has(normalizePdpSpecText(label))) return;
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
                                                const label: string = publicSpecLabels[key] || field.label || field.name || key.replace(/_/g, ' ');
                                                tryAddItem(key, label, publicSpecs[key]);
                                            }
                                        }

                                        // ── 2. CAMPOS NATIVOS DA CATEGORIA ──
                                        for (const [nk, nl] of Object.entries(NATIVE_LABELS)) {
                                            tryAddItem(nk, nl, publicSpecs[nk]);
                                        }

                                        // ── 3. CAMPOS EXTRAS ──
                                        for (const [key, value] of Object.entries(publicSpecs)) {
                                            const label = publicSpecLabels[key] || key.replace(/_/g, ' ');
                                            tryAddItem(key, label, value);
                                        }

                                        function resolveSpecGroupId(item: { key: string, label: string }): string | null {
                                            const normalized = normalizePdpSpecText(`${item.key} ${item.label}`);

                                            if (normalized.includes('camera') || normalized.includes('cam_') || normalized.includes('megapixel') || normalized.includes('mpx') || normalized.includes('selfie') || normalized.includes('ultrawide') || normalized.includes('macro') || normalized.includes('teleobjetiva') || normalized.includes('periscopio') || normalized.includes('video')) return 'camera';
                                            if (normalized.includes('largura') || normalized.includes('altura') || normalized.includes('profundidade') || normalized.includes('dimensions') || normalized.includes('peso')) return 'logistica';
                                            if (normalized.includes('tela') || normalized.includes('display') || normalized.includes('resolucao') || normalized.includes('pixels') || normalized.includes('brilho') || normalized.includes('nits') || normalized.includes('hz') || normalized.includes('fps') || normalized.includes('refresh')) return 'tela';
                                            if (normalized.includes('bateria') || normalized.includes('mah') || normalized.includes('carregamento') || normalized.includes('carga') || normalized.includes('watt')) return 'bateria';
                                            if (normalized.includes('processador') || normalized.includes('chipset') || normalized.includes('cpu') || normalized.includes('gpu') || normalized.includes('antutu') || normalized.includes('snapdragon') || normalized.includes('mediatek') || normalized.includes('exynos') || normalized.includes('helio') || normalized.includes('dimensity') || normalized.includes('litografia')) return 'desempenho';
                                            if (normalized.includes('wifi') || normalized.includes('wi_fi') || normalized.includes('bluetooth') || normalized.includes('nfc') || normalized.includes('irda') || normalized.includes('infravermelho') || normalized.includes('gps') || normalized.includes('rede') || normalized.includes('sim') || normalized.includes('usb') || normalized.includes('fone')) return 'conexoes';
                                            if (normalized.includes('biometria') || normalized.includes('resistencia') || normalized.includes('ip64') || normalized.includes('seguranca')) return 'fisico';

                                            return null;
                                        }

                                        // Agrupar itens mapeados
                                        const groupedItems: { group: typeof SPEC_GROUPS[0] | { id: string, label: string, icon: any, keys: string[] }, items: typeof allItems }[] = [];

                                        SPEC_GROUPS.forEach(group => {
                                            const groupItems = allItems.filter(item => group.keys.includes(item.key) || resolveSpecGroupId(item) === group.id);
                                            if (groupItems.length > 0) {
                                                // Ordenar os itens dentro do grupo para seguir a ordem de chaves configurada no array `keys`
                                                groupItems.sort((a, b) => {
                                                    const indexA = group.keys.includes(a.key) ? group.keys.indexOf(a.key) : 999;
                                                    const indexB = group.keys.includes(b.key) ? group.keys.indexOf(b.key) : 999;
                                                    return indexA - indexB;
                                                });
                                                groupedItems.push({ group, items: groupItems });
                                            }
                                        });

                                        // Coletar itens restantes que não caíram em nenhum grupo (Outros)
                                        const mappedKeys = new Set(SPEC_GROUPS.flatMap(g => g.keys));
                                        const othersItems = allItems.filter(item => !mappedKeys.has(item.key) && !resolveSpecGroupId(item));
                                        
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
                                                            <h4 className="font-semibold text-sm">{g.group.label}</h4>
                                                        </div>
                                                        <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-6 gap-x-4 text-sm pl-7">
                                                            {g.items.map(item => (
                                                                <div key={item.key} className={`flex flex-col max-w-full ${isListStyleSpecItem(item) ? 'col-span-2 md:col-span-3 lg:col-span-2' : ''}`}>
                                                                    <dt className="text-slate-500 text-xs font-semibold uppercase tracking-wide truncate pr-2" title={item.label}>{item.label}</dt>
                                                                    <dd className="font-medium text-slate-900 mt-0.5 break-words pr-2">
                                                                        {isListStyleSpecItem(item) ? (
                                                                            <ul className="space-y-1.5 overflow-x-auto">
                                                                                {normalizePdpListItems(item.strVal).map((line) => (
                                                                                    <li key={line} className="whitespace-nowrap text-sm leading-relaxed">1 {line}</li>
                                                                                ))}
                                                                            </ul>
                                                                        ) : item.key === 'memoria_ram_virtual' ? `+ ${item.strVal}` : item.strVal}
                                                                    </dd>
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
                    <p className="text-xs text-slate-500 uppercase font-semibold">À vista no PIX</p>
                    <p className="text-xl font-bold" style={{ color: primaryColor }}>R$ {(customerType !== 'wholesale' ? pixPrice : displayPrice).toFixed(2).replace('.', ',')}</p>
                </div>
                <button
                    onClick={handleAddToCart}
                    disabled={!product.track_inventory ? false : (product.stock_quantity || 0) <= 0}
                    style={(!product.track_inventory ? false : (product.stock_quantity || 0) <= 0) ? undefined : { backgroundColor: primaryColor, boxShadow: `0 10px 24px -10px ${primaryColor}66` }}
                    className="flex-shrink-0 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-opacity hover:opacity-90 shadow-lg"
                >
                    <ShoppingCart size={20} />
                    {(!product.track_inventory || (product.stock_quantity || 0) > 0) ? 'Comprar' : 'Esgotado'}
                </button>
            </div>
        </div>
    );
};
