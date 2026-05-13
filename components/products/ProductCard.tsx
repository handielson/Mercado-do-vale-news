
import React, { useState, useEffect, useRef } from 'react';
import { Barcode, Edit, MapPin, Package, Trash2, Printer, Power, PowerOff, RefreshCw, Type, Video, VideoOff, Loader2, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '../../types/product';
import { Company } from '../../types/company';
import { ProductStatus } from '../../utils/field-standards';
import { cn } from '../../utils/cn';
import { getModelImageWithCache } from '../../services/modelImageCache';
import { getCacheBustedUrl } from '../../utils/cache-buster';
import { LabelPrintModal } from './LabelPrintModal';
import { ProductQuickTagsModal } from './ProductQuickTagsModal';
import { supabase } from '../../services/supabase';
import { VPS_DIRECT_BASE_URL, buildVpsUrl, getVpsSyncHeaders } from '../../services/vpsProxyBase';
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

type VideoUploadPhase = 'idle' | 'uploading' | 'processing' | 'verifying' | 'success' | 'error';

type VideoUploadState = {
    phase: VideoUploadPhase;
    progress: number;
    message: string;
    detail?: string;
};

type SynologyUploadResponse = {
    ok?: boolean;
    uploadId?: string;
    name?: string;
    url?: string;
    error?: string;
    detail?: string;
};

type SynologyUploadStatus = {
    status?: 'queued' | 'uploading' | 'success' | 'error';
    progress?: number;
    message?: string;
    error?: string | null;
    detail?: string | null;
    name?: string;
    url?: string;
};

const idleVideoUploadState: VideoUploadState = {
    phase: 'idle',
    progress: 0,
    message: '',
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const readJsonSafe = <T,>(text: string): T | null => {
    if (!text) return null;
    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
};

const getUploadErrorMessage = (payload: SynologyUploadResponse | SynologyUploadStatus | null, fallback: string) => {
    const detail = payload?.detail ? ` (${payload.detail})` : '';
    return `${payload?.error || fallback}${detail}`;
};

const buildStockLocationsHref = (product: Product) => {
    const term = product.sku || product.name || product.id;
    return `/admin/inventory/locations?search=${encodeURIComponent(term)}`;
};

const uploadVideoWithProgress = (
    formData: FormData,
    token: string | undefined,
    onProgress: (progress: number) => void,
) => new Promise<SynologyUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Video files are too large for the Vercel proxy body limit, so upload directly to the VPS.
    xhr.open('POST', `${VPS_DIRECT_BASE_URL}/synology/upload?folder=videos`);

    const headers = getVpsSyncHeaders();
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.max(1, Math.min(90, Math.round((event.loaded / event.total) * 90)));
        onProgress(progress);
    };

    xhr.onerror = () => reject(new Error('Falha de rede ao enviar o video para a VPS'));
    xhr.ontimeout = () => reject(new Error('Tempo esgotado ao enviar o video para a VPS'));
    xhr.onload = () => {
        const payload = readJsonSafe<SynologyUploadResponse>(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(getUploadErrorMessage(payload, `Erro HTTP ${xhr.status} no upload para a VPS`)));
            return;
        }
        resolve(payload || { ok: true });
    };

    xhr.send(formData);
});

const pollSynologyUploadStatus = async (uploadId: string, token: string | undefined) => {
    const headers = {
        ...getVpsSyncHeaders(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/json',
    };

    for (let attempt = 0; attempt < 90; attempt += 1) {
        const res = await fetch(buildVpsUrl(`/synology/upload-status?id=${encodeURIComponent(uploadId)}`, { method: 'GET' }), {
            method: 'GET',
            headers,
            cache: 'no-store',
        });
        const status = await res.json().catch(() => null) as SynologyUploadStatus | null;

        if (!res.ok) {
            throw new Error(getUploadErrorMessage(status, 'Nao foi possivel consultar o status do upload'));
        }
        if (status?.status === 'success') return status;
        if (status?.status === 'error') {
            throw new Error(getUploadErrorMessage(status, 'Falha ao gravar video no Synology'));
        }

        await wait(1500);
    }

    throw new Error('O Synology ainda nao confirmou o upload depois de 135 segundos');
};


/**
 * ProductCard Component
 * Displays product information in a card format with image, prices, and status
 */
export const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onDelete, selectionMode = false, isSelected = false, onToggleSelect }) => {
    const [fetchedImages, setFetchedImages] = useState<string[]>([]);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
    // Tags de cross-sell vivem no modelo. Lemos do produto (que herda via specs)
    // pra exibir contagem sem carregar o modelo. O modal carrega o modelo só ao abrir.
    const [currentTags, setCurrentTags] = useState<string[]>(() => {
        const raw = product.specs?.tags_venda;
        if (Array.isArray(raw)) return raw.filter((t: any) => typeof t === 'string' && t.trim());
        return [];
    });
    const [currentStatus, setCurrentStatus] = useState<ProductStatus>(product.status);
    const [currentStock, setCurrentStock] = useState<number | undefined>(product.stock_quantity);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Video checking and uploading state
    const [videoInfo, setVideoInfo] = useState<{ exists: boolean; url: string | null; checking: boolean }>({ exists: false, url: null, checking: true });
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [videoUpload, setVideoUpload] = useState<VideoUploadState>(idleVideoUploadState);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const [shopeeItemId, setShopeeItemId] = useState<number | null>(() => {
        const parsed = Number(product.shopee_item_id);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    });
    const [isShopeeModalOpen, setIsShopeeModalOpen] = useState(false);
    const [isPreparingShopeeModal, setIsPreparingShopeeModal] = useState(false);
    const [shopeeCompany, setShopeeCompany] = useState<Company | null>(null);
    const [shopeeModalProductSource, setShopeeModalProductSource] = useState<Product & Record<string, any>>(product as Product & Record<string, any>);

    const shopeeVisualState = getShopeeButtonVisualState({ shopee_item_id: shopeeItemId });
    const shopeeModalProduct = mapProductToShopeeLocalProduct(shopeeModalProductSource as Product & Record<string, any>) as LocalProduct;
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

        const normalizedSku = product.sku.trim().replace(/\s+/g, '');
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
                const res = await fetch(buildVpsUrl(path, { method: 'GET' }), {
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

        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const normalizedSku = product.sku.trim().replace(/\s+/g, '');

        setIsUploadingVideo(true);
        setVideoUpload({
            phase: 'uploading',
            progress: 0,
            message: 'Enviando video para a VPS...',
        });
        try {
            const formData = new FormData();
            const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
            const fileName = `${normalizedSku}.${ext}`;
            const renamedFile = new File([file], fileName, { type: file.type });
            formData.append('file', renamedFile);

            const upload = await uploadVideoWithProgress(formData, token, (progress) => {
                setVideoUpload({
                    phase: 'uploading',
                    progress,
                    message: 'Enviando video para a VPS...',
                });
            });

            if (!upload.ok && !upload.uploadId) {
                throw new Error(getUploadErrorMessage(upload, 'A VPS nao iniciou o upload'));
            }

            setVideoUpload({
                phase: 'processing',
                progress: 92,
                message: 'Gravando video no Synology...',
            });

            const finalStatus = upload.uploadId
                ? await pollSynologyUploadStatus(upload.uploadId, token)
                : { status: 'success', progress: 100, name: upload.name, url: upload.url } as SynologyUploadStatus;

            setVideoUpload({
                phase: 'verifying',
                progress: 98,
                message: 'Confirmando arquivo no Synology...',
            });

            const confirmed = await vpsApiService.checkVideoBySku(normalizedSku);
            if (!confirmed?.exists) {
                throw new Error('A VPS informou sucesso, mas o video ainda nao apareceu no Synology para este SKU');
            }

            const videoUrl = confirmed.url || finalStatus.url || upload.url || null;
            toast.success(`Video enviado com sucesso: ${finalStatus.name || upload.name || fileName}`);
            setVideoInfo({ exists: true, url: videoUrl, checking: false });
            setVideoUpload({
                phase: 'success',
                progress: 100,
                message: 'Video enviado com sucesso',
            });
            window.setTimeout(() => {
                setVideoUpload((current) => current.phase === 'success' ? idleVideoUploadState : current);
            }, 5000);
        } catch (error: any) {
            const message = error?.message || 'Erro desconhecido no upload';
            toast.error('Falha no envio do video', { description: message });
            setVideoUpload({
                phase: 'error',
                progress: 100,
                message: 'Falha no envio do video',
                detail: message,
            });
        } finally {
            setIsUploadingVideo(false);
        }
    };

    // Update internal state if props change
    useEffect(() => {
        setCurrentStatus(product.status);
        setCurrentStock(product.stock_quantity);
        setShopeeModalProductSource(product as Product & Record<string, any>);
    }, [product]);

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
            const hydratedProduct = await vpsApiService.getProductById(product.id, true);
            setShopeeModalProductSource({
                ...(product as Product & Record<string, any>),
                ...(hydratedProduct || {}),
            });
            setIsShopeeModalOpen(true);
        } catch (error) {
            console.error('[ProductCard] Erro ao preparar modal Shopee:', error);
            toast.error('Nao foi possivel abrir a sincronizacao da Shopee.');
        } finally {
            setIsPreparingShopeeModal(false);
        }
    };

    const handleCopyProductField = async (e: React.MouseEvent, value: string | undefined | null, label: string) => {
        e.stopPropagation();
        if (!value) {
            toast.warning(`${label} indisponivel para copiar`);
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} copiado`);
        } catch {
            toast.error(`Nao foi possivel copiar ${label}`);
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

    const isParentProduct = Number(product.is_parent) === 1;

    return (
        <div
            className={cn(
                "rounded-xl border overflow-hidden transition-all duration-200",
                isParentProduct ? "bg-blue-50/60" : "bg-white",
                selectionMode
                    ? isSelected
                        ? "border-blue-400 ring-2 ring-blue-300 shadow-md cursor-pointer"
                        : "border-slate-200 hover:border-blue-300 cursor-pointer"
                    : isParentProduct
                        ? "border-blue-300 border-2 shadow-sm hover:shadow-md hover:border-blue-400"
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

                {/* Stock Badge - Esconde quando eh produto pai (pais nao vendem, nao tem estoque proprio) */}
                {product.track_inventory && !isParentProduct && (
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

                {/* Badge "Produto Pai" - substitui o badge de estoque pra agregadores */}
                {isParentProduct && (
                    <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-bold shadow-md bg-blue-600 text-white border border-blue-700 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        Produto Pai
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center justify-end gap-1 overflow-x-auto pb-0.5">
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
                                    "shrink-0 p-1.5 rounded-lg transition-colors group",
                                    (videoInfo.checking || isUploadingVideo) ? "opacity-50 cursor-wait" :
                                    videoInfo.exists ? "bg-blue-100 hover:bg-blue-200" : "hover:bg-amber-50"
                                )}
                                title={
                                    videoInfo.checking ? "Verificando status de video..." :
                                    isUploadingVideo ? "Sincronizando envio de video..." :
                                    videoInfo.exists ? "Produto possui video. Ver clipe." :
                                    "Produto sem video. Clique para anexar."
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
                            onClick={(e) => handleCopyProductField(e, product.name, 'nome')}
                            className="shrink-0 p-1.5 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors group"
                            title="Copiar nome"
                        >
                            <Type className="w-4 h-4 text-sky-600 group-hover:text-sky-700" />
                        </button>
                        <button
                            onClick={(e) => handleCopyProductField(e, product.sku, 'SKU')}
                            className="shrink-0 p-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors group"
                            title="Copiar SKU"
                        >
                            <Barcode className="w-4 h-4 text-indigo-600 group-hover:text-indigo-700" />
                        </button>
                        <a
                            href={buildStockLocationsHref(product)}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors group"
                            title="Ver locais de estoque"
                            aria-label="Ver locais de estoque"
                        >
                            <MapPin className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
                        </a>

                        <button
                            onClick={handleOpenShopeeModal}
                            disabled={isPreparingShopeeModal}
                            className={cn(
                                "relative shrink-0 p-1.5 rounded-lg transition-all duration-200 group border",
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
                                    "shrink-0 p-1.5 rounded-lg transition-colors group",
                                    isSyncing ? "opacity-50 cursor-not-allowed" : "hover:bg-green-50"
                                )}
                                title="Sincronizar Estoque (Bling)"
                            >
                                <RefreshCw className={cn("w-4 h-4 text-slate-400 group-hover:text-green-600", isSyncing && "animate-spin text-green-600")} />
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsTagsModalOpen(true); }}
                            className="relative shrink-0 p-1.5 hover:bg-purple-50 rounded-lg transition-colors group"
                            title={currentTags.length > 0 ? `${currentTags.length} tag(s) aplicada(s)` : 'Gerenciar tags'}
                        >
                            <Tags className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
                            {currentTags.length > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                                    {currentTags.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => onEdit?.(product)}
                            className="shrink-0 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar produto"
                        >
                            <Edit className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                            onClick={() => setIsPrintModalOpen(true)}
                            className="shrink-0 p-1.5 hover:bg-slate-100 rounded-lg transition-colors group"
                            title="Imprimir Etiqueta"
                        >
                            <Printer className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                        </button>
                        <button
                            onClick={handleToggleStatus}
                            disabled={isTogglingStatus}
                            className={cn(
                                'shrink-0 p-1.5 rounded-lg transition-colors group',
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
                            className="shrink-0 p-1.5 hover:bg-red-50 rounded-lg transition-colors group"
                            title="Excluir produto"
                        >
                            <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                        </button>
                    </div>

                    <div className="min-w-0">
                        <h3
                            className="min-h-[3.75rem] font-semibold text-slate-900 text-sm leading-tight break-words overflow-hidden"
                            style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3 }}
                        >
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
                    <div className="hidden">
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
                            onClick={(e) => { e.stopPropagation(); setIsTagsModalOpen(true); }}
                            className="relative p-1.5 hover:bg-purple-50 rounded-lg transition-colors group"
                            title={currentTags.length > 0 ? `${currentTags.length} tag(s) aplicada(s)` : 'Gerenciar tags'}
                        >
                            <Tags className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
                            {currentTags.length > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                                    {currentTags.length}
                                </span>
                            )}
                        </button>
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

                {videoUpload.phase !== 'idle' && (
                    <div
                        className={cn(
                            'rounded-md border px-2.5 py-2 text-[11px]',
                            videoUpload.phase === 'error'
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : videoUpload.phase === 'success'
                                    ? 'border-green-200 bg-green-50 text-green-700'
                                    : 'border-blue-200 bg-blue-50 text-blue-700'
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate font-medium">{videoUpload.message}</span>
                            <span className="shrink-0 font-mono">{videoUpload.progress}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/80">
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all duration-300',
                                    videoUpload.phase === 'error'
                                        ? 'bg-red-500'
                                        : videoUpload.phase === 'success'
                                            ? 'bg-green-500'
                                            : 'bg-blue-500'
                                )}
                                style={{ width: `${Math.max(4, Math.min(100, videoUpload.progress))}%` }}
                            />
                        </div>
                        {videoUpload.detail && (
                            <p className="mt-1.5 break-words text-[10px] leading-snug">{videoUpload.detail}</p>
                        )}
                    </div>
                )}

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

            {/* Quick Tags Modal */}
            <ProductQuickTagsModal
                product={product}
                isOpen={isTagsModalOpen}
                onClose={() => setIsTagsModalOpen(false)}
                onSaved={(tagIds) => setCurrentTags(tagIds)}
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
