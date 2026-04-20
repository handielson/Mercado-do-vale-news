
import React, { useState, useEffect, useRef } from 'react';
import { Edit, Package, Trash2, Printer, Power, PowerOff, RefreshCw, Video, VideoOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '../../types/product';
import { Company } from '../../types/company';
import { ProductStatus } from '../../utils/field-standards';
import { cn } from '../../utils/cn';
import { getModelImageWithCache } from '../../services/modelImageCache';
import { getCacheBustedUrl } from '../../utils/cache-buster';
import { LabelPrintModal } from './LabelPrintModal';
import { supabase } from '../../services/supabase';
import { VPS_PROXY_BASE } from '../../services/vpsProxyBase';
import { vpsApiService } from '../../services/vpsApiService';
import { getShopeeButtonVisualState, mapProductToShopeeLocalProduct } from './productCardShopee.js';
import { ShopeeSyncModal, type LocalProduct, type ShopeeProduct } from '../../pages/admin/settings/ShopeePage';

interface ProductCardProps {
    product: Product;
    onEdit?: (product: Product) => void;
    onDelete?: (product: Product) => void;
    selectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: (product: Product) => void;
}


/**
 * ProductCard Component
 * Displays product information in a card format with image, prices, and status
 */
export const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onDelete, selectionMode = false, isSelected = false, onToggleSelect }) => {
    const [fetchedImages, setFetchedImages] = useState<string[]>([]);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [currentStatus, setCurrentStatus] = useState<ProductStatus>(product.status);
    const [currentStock, setCurrentStock] = useState<number | undefined>(product.stock_quantity);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Video checking and uploading state
    const [videoInfo, setVideoInfo] = useState<{ exists: boolean; url: string | null; checking: boolean }>({ exists: false, url: null, checking: true });
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const [shopeeItemId, setShopeeItemId] = useState<number | null>(() => {
        const parsed = Number(product.shopee_item_id);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    });
    const [isShopeeModalOpen, setIsShopeeModalOpen] = useState(false);
    const [isPreparingShopeeModal, setIsPreparingShopeeModal] = useState(false);
    const [shopeeCompany, setShopeeCompany] = useState<Company | null>(null);

    const shopeeVisualState = getShopeeButtonVisualState({ shopee_item_id: shopeeItemId });
    const shopeeModalProduct = mapProductToShopeeLocalProduct(product as Product & Record<string, any>) as LocalProduct;
    const emptyShopeeHistory: ShopeeProduct[] = [];

    // Check video: prioridade para video_url salvo no banco; fallback resiliente por SKU
    useEffect(() => {
        const dbVideoUrl = (product.video_url || '').trim();
        if (dbVideoUrl) {
            setVideoInfo({ exists: true, url: dbVideoUrl, checking: false });
            return;
        }

        if (!product.sku) {
            setVideoInfo({ exists: false, url: null, checking: false });
            return;
        }

        setVideoInfo((prev) => ({ ...prev, checking: true }));
        let isMounted = true;

        const normalizedSku = product.sku.trim().replace(/\s+/g, '').toUpperCase();
        const canonicalUrl = `https://videos.mercadodovale.com.br/${encodeURIComponent(normalizedSku)}.mp4`;

        const resolveVideoInfo = async () => {
            // Caminho principal
            const primary = await vpsApiService.checkVideoBySku(normalizedSku);
            if (primary?.exists) {
                return { exists: true, url: primary.url || canonicalUrl };
            }

            // Fallback para endpoint público legado
            try {
                const path = `/public/check-video?sku=${encodeURIComponent(normalizedSku)}`;
                const res = await fetch(`${VPS_PROXY_BASE}?path=${encodeURIComponent(path)}`, {
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                });
                if (res.ok) {
                    const fallback = await res.json().catch(() => null) as { exists?: boolean; url?: string } | null;
                    if (fallback?.exists) {
                        return { exists: true, url: fallback.url || canonicalUrl };
                    }
                }
            } catch {
                // Sem fallback adicional
            }

            return { exists: false, url: null };
        };

        resolveVideoInfo()
            .then((info) => {
                if (isMounted) {
                    setVideoInfo({ exists: info.exists, url: info.url, checking: false });
                }
            })
            .catch(() => {
                if (isMounted) setVideoInfo({ exists: false, url: null, checking: false });
            });
            
        return () => { isMounted = false; };
    }, [product.sku, product.video_url]);

    // Handle Upload video
    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !product.sku) return;

        // Reset input value to allow uploading the same file again if it fails
        e.target.value = '';

        const path = '/synology/upload?folder=videos';
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        
        setIsUploadingVideo(true);
        try {
            const formData = new FormData();
            const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
            const fileName = `${product.sku.toUpperCase()}.${ext}`;
            const renamedFile = new File([file], fileName, { type: file.type });
            formData.append('file', renamedFile);

            const res = await fetch(`${VPS_PROXY_BASE}?path=${encodeURIComponent(path)}`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                body: formData,
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || 'Erro no upload para a VPS');
            }

            const data = await res.json();
            toast.success(`Upload iniciado: ${data.name}`);
            setVideoInfo({ exists: true, url: data.url, checking: false });
        } catch (error: any) {
            toast.error(`Falha ao iniciar upload: ${error.message}`);
        } finally {
            setIsUploadingVideo(false);
        }
    };

    // Update internal state if props change
    useEffect(() => {
        setCurrentStatus(product.status);
        setCurrentStock(product.stock_quantity);
    }, [product.status, product.stock_quantity]);

    useEffect(() => {
        const parsed = Number(product.shopee_item_id);
        setShopeeItemId(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
    }, [product.shopee_item_id]);

    const handleToggleStatus = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const newStatus = currentStatus === ProductStatus.ACTIVE ? ProductStatus.INACTIVE : ProductStatus.ACTIVE;
        setIsTogglingStatus(true);
        try {
            const { error } = await supabase
                .from('products')
                .update({ status: newStatus })
                .eq('id', product.id);
            if (error) throw error;
            setCurrentStatus(newStatus);
        } catch (err) {
            console.error('[ProductCard] Erro ao alterar status:', err);
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const handleSyncStock = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!product.bling_id) return;

        setIsSyncing(true);
        try {
            // Chama a rota de proxy do Bling para não expor tokens no client-side
            const res = await fetch(`/api/bling?resource=product-detail&id=${product.bling_id}`);
            if (!res.ok) throw new Error('Falha ao consultar Bling');
            const data = await res.json();
            
            // stock_quantity vem do /estoques/saldos. Se 0, fallback p/ data.estoque
            let parsedStock = Number(data.stock_quantity);
            if ((!parsedStock || parsedStock === 0) && data.estoque) {
                const est = data.estoque;
                parsedStock = est.saldoFisicoTotal ?? est.saldoFisico ?? est.saldoVirtualTotal ?? est.saldoVirtual ?? 0;
                parsedStock = parseFloat(String(parsedStock)) || 0;
                console.log('[ProductCard] Usando fallback estoque:', parsedStock, data.estoque);
            }
            const realStock = !isNaN(parsedStock) ? parsedStock : 0;
            
            if (realStock !== currentStock) {
                const { error } = await supabase
                    .from('products')
                    .update({ stock_quantity: realStock })
                    .eq('id', product.id);
                if (error) throw error;
                
                // Sincroniza stock na VPS: busca o produto completo e faz PUT com merge
                // (PUT na VPS é replace completo — enviar só stock_quantity zerava os outros campos)
                try {
                    const { vpsApiService } = await import('../../services/vpsApiService');
                    const currentVpsProduct = await vpsApiService.getProductById(product.id, true);
                    if (currentVpsProduct) {
                        await vpsApiService.updateProduct(product.id, {
                            ...currentVpsProduct,
                            stock_quantity: realStock,
                        });
                    }
                } catch(e) { console.warn('[ProductCard] VPS stock update failed:', e); }

                setCurrentStock(realStock);
                toast.success(`Estoque sincronizado: ${realStock} un.`);
            } else {
                toast.info(`Estoque já estava atualizado: ${realStock} un.`);
            }
        } catch (err) {
            console.error('[ProductCard] Erro ao sincronizar estoque:', err);
            toast.error('Erro ao sincronizar estoque do Bling');
        } finally {
            setIsSyncing(false);
        }
    };

    const ensureShopeeCompany = async () => {
        if (shopeeCompany) return shopeeCompany;
        const { getCompanyData } = await import('../../services/companyService');
        const company = await getCompanyData();
        setShopeeCompany(company);
        return company;
    };

    const refreshShopeeLinkState = async (): Promise<number | null> => {
        try {
            const { data, error } = await supabase
                .from('shopee_products')
                .select('shopee_item_id')
                .eq('product_id', product.id)
                .not('shopee_item_id', 'is', null)
                .order('last_synced_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            const parsed = Number(data?.shopee_item_id);
            if (Number.isFinite(parsed) && parsed > 0) {
                setShopeeItemId(parsed);
                return parsed;
            }
        } catch (error) {
            console.error('[ProductCard] Erro ao atualizar estado Shopee:', error);
        }

        return null;
    };

    const handleOpenShopeeModal = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPreparingShopeeModal) return;

        setIsPreparingShopeeModal(true);
        try {
            const existingItemId = shopeeVisualState.isSynced
                ? shopeeVisualState.itemId
                : await refreshShopeeLinkState();

            if (existingItemId) {
                toast.info(`Este produto ja esta sincronizado na Shopee (#${existingItemId}).`);
                return;
            }

            await ensureShopeeCompany();
            setIsShopeeModalOpen(true);
        } catch (error) {
            console.error('[ProductCard] Erro ao preparar modal Shopee:', error);
            toast.error('Nao foi possivel abrir a sincronizacao da Shopee.');
        } finally {
            setIsPreparingShopeeModal(false);
        }
    };

    // Resolve cover image: VPS now returns images directly (no compact mode).
    // Only lazy-load model image as fallback when product has no custom images.
    useEffect(() => {
        if (Array.isArray(product.images) && product.images.length > 0) {
            setFetchedImages(product.images);
            return;
        }
        // Fallback: model image for products without custom images
        if (!product.model_id) return;
        let isMounted = true;
        getModelImageWithCache(product.model_id, product.specs?.color)
            .then(imageUrl => { if (isMounted && imageUrl) setFetchedImages([imageUrl]); });
        return () => { isMounted = false; };
    }, [product.id, product.images, product.model_id, product.specs?.color]);

    const rawCoverImage = fetchedImages.length > 0 ? fetchedImages[0] : null;
    const coverImage = getCacheBustedUrl(rawCoverImage, product.updated || product.created);

    // Format price from centavos to BRL
    const formatPrice = (centavos: number): string => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(centavos / 100);
    };

    // Status badge colors
    const getStatusColor = (status: ProductStatus): string => {
        switch (status) {
            case ProductStatus.ACTIVE:
                return 'bg-green-100 text-green-800 border-green-200';
            case ProductStatus.INACTIVE:
                return 'bg-red-100 text-red-800 border-red-200';
            case ProductStatus.OUT_OF_STOCK:
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case ProductStatus.DISCONTINUED:
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusLabel = (status: ProductStatus): string => {
        switch (status) {
            case ProductStatus.ACTIVE:
                return 'Ativo';
            case ProductStatus.INACTIVE:
                return 'Inativo';
            case ProductStatus.OUT_OF_STOCK:
                return 'Sem Estoque';
            case ProductStatus.DISCONTINUED:
                return 'Descontinuado';
            default:
                return status;
        }
    };

    return (
        <div
            className={cn(
                "bg-white rounded-xl border overflow-hidden transition-all duration-200",
                selectionMode
                    ? isSelected
                        ? "border-blue-400 ring-2 ring-blue-300 shadow-md cursor-pointer"
                        : "border-slate-200 hover:border-blue-300 cursor-pointer"
                    : "border-slate-200 hover:shadow-lg"
            )}
            onClick={selectionMode ? () => onToggleSelect?.(product) : undefined}
        >
            {/* Image */}
            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
                {/* Selection Checkbox */}
                {selectionMode && (
                    <div className="absolute top-2 left-2 z-10">
                        <div className={cn(
                            'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                            isSelected
                                ? 'bg-blue-600 border-blue-600'
                                : 'bg-white/90 border-slate-300'
                        )}>
                            {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                    </div>
                )}

                {coverImage ? (
                    <img
                        src={coverImage}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Package className="w-16 h-16 text-slate-300" />
                )}

                {/* Stock Badge */}
                {product.track_inventory && (
                    <div className={cn(
                        'absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold shadow-md',
                        currentStock === 0
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : (currentStock ?? 0) < 5
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                : 'bg-green-100 text-green-700 border border-green-300'
                    )}>
                        {currentStock === 0
                            ? 'Sem Estoque'
                            : `${currentStock} un.`}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm leading-tight break-words">
                            <a
                                href={`/produto/${product.slug || product.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline hover:text-blue-600 transition-colors"
                                title="Ver página do produto na loja"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {product.name}
                            </a>
                        </h3>
                        {/* Specs: cor + memória/RAM */}
                        <p className="font-mono text-xs text-slate-500 mt-0.5">
                            {[
                                product.specs?.color,
                                product.specs?.storage,
                                product.specs?.ram ? `${product.specs.ram} RAM` : undefined,
                            ].filter(Boolean).join(' · ')}
                        </p>
                        {/* SKU sempre visível */}
                        {product.sku && (
                            <p className="font-mono text-[10px] text-slate-400 mt-0.5">SKU: {product.sku}</p>
                        )}
                        {/* Badge Pai / Variação */}
                        {product.parent_id ? (
                            <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                ↳ Variação
                            </span>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Hidden Input for Video Upload */}
                        <input 
                            type="file" 
                            accept="video/mp4,video/quicktime,video/*"
                            ref={videoInputRef}
                            className="hidden"
                            onChange={handleVideoUpload}
                        />

                        {/* Video Status Action */}
                        {product.sku && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (videoInfo.checking) return;
                                    if (videoInfo.exists && videoInfo.url) {
                                        window.open(videoInfo.url, '_blank');
                                    } else {
                                        videoInputRef.current?.click();
                                    }
                                }}
                                disabled={videoInfo.checking || isUploadingVideo}
                                className={cn(
                                    "p-1.5 rounded-lg transition-colors group",
                                    (videoInfo.checking || isUploadingVideo) ? "opacity-50 cursor-wait" :
                                    videoInfo.exists ? "bg-blue-100 hover:bg-blue-200" : "hover:bg-amber-50"
                                )}
                                title={
                                    videoInfo.checking ? "Verificando status de vídeo..." :
                                    isUploadingVideo ? "Sincronizando envio de vídeo..." :
                                    videoInfo.exists ? "Produto possui vídeo. Ver clipe." :
                                    "Produto sem vídeo. Clique para anexar."
                                }
                            >
                                {isUploadingVideo || videoInfo.checking ? (
                                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                                ) : videoInfo.exists ? (
                                    <Video className="w-4 h-4 text-blue-600 group-hover:text-blue-800" />
                                ) : (
                                    <VideoOff className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                                )}
                            </button>
                        )}

                        <button
                            onClick={handleOpenShopeeModal}
                            disabled={isPreparingShopeeModal}
                            className={cn(
                                "relative p-1.5 rounded-lg transition-all duration-200 group border",
                                isPreparingShopeeModal
                                    ? "opacity-50 cursor-wait border-slate-200 bg-slate-50"
                                    : shopeeVisualState.isSynced
                                        ? "border-[#ffd3c7] bg-[#fff3ef] shadow-[0_0_0_3px_rgba(238,77,45,0.12),0_0_18px_rgba(238,77,45,0.18)] animate-pulse"
                                        : "border-transparent hover:bg-orange-50 hover:border-orange-100"
                            )}
                            title={isPreparingShopeeModal ? 'Preparando sincronizacao da Shopee...' : shopeeVisualState.title}
                        >
                            {shopeeVisualState.isSynced && (
                                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                            )}
                            {isPreparingShopeeModal ? (
                                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                            ) : (
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    className={cn(
                                        "w-4 h-4",
                                        shopeeVisualState.isSynced
                                            ? "text-[#ee4d2d]"
                                            : "text-slate-400 group-hover:text-[#ee4d2d]"
                                    )}
                                    aria-hidden="true"
                                >
                                    <path d="M8 8.2V7a4 4 0 1 1 8 0v1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                    <path d="M6.6 8.2h10.8c.8 0 1.5.56 1.67 1.35l1.07 4.92A4.8 4.8 0 0 1 15.51 20H8.49a4.8 4.8 0 0 1-4.69-5.51l1.07-4.92c.17-.79.86-1.35 1.73-1.35Z" fill="currentColor" />
                                    {shopeeVisualState.isSynced ? (
                                        <path d="m9.2 12.3 2.1 2.1 3.6-3.8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    ) : (
                                        <path d="M9.1 12.2h5.8M12 9.9v4.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                                    )}
                                </svg>
                            )}
                        </button>

                        {product.bling_id && (
                            <button
                                onClick={handleSyncStock}
                                disabled={isSyncing}
                                className={cn(
                                    "p-1.5 rounded-lg transition-colors group",
                                    isSyncing ? "opacity-50 cursor-not-allowed" : "hover:bg-green-50"
                                )}
                                title="Sincronizar Estoque (Bling)"
                            >
                                <RefreshCw className={cn("w-4 h-4 text-slate-400 group-hover:text-green-600", isSyncing && "animate-spin text-green-600")} />
                            </button>
                        )}
                        <button
                            onClick={() => onEdit?.(product)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar produto"
                        >
                            <Edit className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                            onClick={() => setIsPrintModalOpen(true)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors group"
                            title="Imprimir Etiqueta"
                        >
                            <Printer className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                        </button>
                        <button
                            onClick={handleToggleStatus}
                            disabled={isTogglingStatus}
                            className={cn(
                                'p-1.5 rounded-lg transition-colors group',
                                currentStatus === ProductStatus.ACTIVE
                                    ? 'hover:bg-red-50'
                                    : 'hover:bg-green-50'
                            )}
                            title={currentStatus === ProductStatus.ACTIVE ? 'Inativar produto' : 'Ativar produto'}
                        >
                            {currentStatus === ProductStatus.ACTIVE
                                ? <PowerOff className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                                : <Power className="w-4 h-4 text-slate-400 group-hover:text-green-600" />
                            }
                        </button>
                        <button
                            onClick={() => onDelete?.(product)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors group"
                            title="Excluir produto"
                        >
                            <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                        </button>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn(
                        'inline-block px-2 py-1 text-xs font-medium rounded-md border',
                        getStatusColor(currentStatus)
                    )}>
                        {getStatusLabel(currentStatus)}
                    </span>
                    {(product.production_days != null && product.production_days > 0) && (
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded-md border bg-amber-50 text-amber-700 border-amber-200">
                            ⚙️ {product.production_days}d fab.
                        </span>
                    )}
                </div>

                {/* Unique Identifiers (IMEI / Serial) */}
                {(product.specs?.imei1 || product.specs?.serial || product.specs?.serial_number) && (
                    <div className="border-t border-slate-100 pt-2 space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Identificadores</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {product.specs?.imei1 && (
                                <span className="font-mono text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                    IMEI1 {product.specs.imei1}
                                </span>
                            )}
                            {product.specs?.imei2 && (
                                <span className="font-mono text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                    IMEI2 {product.specs.imei2}
                                </span>
                            )}
                            {!product.specs?.imei1 && (product.specs?.serial || product.specs?.serial_number) && (
                                <span className="font-mono text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                    Serial {product.specs?.serial || product.specs?.serial_number}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Prices */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Varejo</p>
                        <p className="text-sm font-bold text-blue-600">{formatPrice(product.price_retail)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Revenda</p>
                        <p className="text-sm font-semibold text-slate-700">{formatPrice(product.price_reseller)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Atacado</p>
                        <p className="text-sm font-semibold text-slate-700">{formatPrice(product.price_wholesale)}</p>
                    </div>
                </div>
            </div>

            {/* Print Modal */}
            <LabelPrintModal
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                product={product}
            />

            {isShopeeModalOpen && (
                <ShopeeSyncModal
                    product={shopeeModalProduct}
                    company={shopeeCompany}
                    historicalProducts={emptyShopeeHistory}
                    onClose={() => setIsShopeeModalOpen(false)}
                    onSuccess={() => {
                        setIsShopeeModalOpen(false);
                        refreshShopeeLinkState();
                    }}
                />
            )}
        </div>
    );
};
