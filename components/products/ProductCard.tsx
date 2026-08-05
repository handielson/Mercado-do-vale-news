
import React, { useState, useEffect, useRef } from 'react';
import { Barcode, ChevronDown, ChevronUp, Copy, Edit, Eye, EyeOff, ImagePlus, MapPin, Package, Trash2, Printer, Power, PowerOff, RefreshCw, Type, Video, VideoOff, Loader2, Tags, X } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '../../types/product';
import { Company } from '../../types/company';
import { ProductStatus } from '../../utils/field-standards';
import { cn } from '../../utils/cn';
import { getModelImageWithCache } from '../../services/modelImageCache';
import { getCacheBustedUrl } from '../../utils/cache-buster';
import { LabelPrintModal } from './LabelPrintModal';
import { ProductQuickTagsModal } from './ProductQuickTagsModal';
import { getAuthSessionToken } from '../../services/authSession';
import { VPS_DIRECT_BASE_URL, buildVpsUrl, getVpsSyncHeaders } from '../../services/vpsProxyBase';
import { vpsApiService } from '../../services/vpsApiService';
import { shopeeProductService } from '../../services/shopeeProducts';
import { stockLocationService } from '../../services/stockLocationService';
import { unitService } from '../../services/units';
import { deleteImageFromBank, uploadImagesToBank } from '../../services/productImageBank';
import { buildShopeeProductUrl, getShopeeButtonVisualState, mapProductToShopeeLocalProduct, validateShopeeItemForProduct } from './productCardShopee.js';
import { getAdminProductCardStatus } from './productCardStatus.js';
import { ShopeeSyncModal, type LocalProduct, type ShopeeProduct } from '../../pages/admin/settings/ShopeePage';
import TikTokShopSyncModal from '../../pages/admin/settings/components/TikTokShopSyncModal';
import type { TikTokShopProductLink } from '../../services/tiktokShopService';
import type { ProductStockLocation } from '../../types/stock-location';

interface ProductCardProps {
    product: Product;
    onEdit?: (product: Product) => void;
    onDelete?: (product: Product) => void;
    selectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: (product: Product) => void;
    tiktokProductLink?: TikTokShopProductLink | null;
}

type VideoUploadPhase = 'idle' | 'uploading' | 'processing' | 'verifying' | 'success' | 'error';

type VideoUploadState = {
    phase: VideoUploadPhase;
    progress: number;
    message: string;
    detail?: string;
    debug?: unknown;
};

type SynologyUploadResponse = {
    ok?: boolean;
    uploadId?: string;
    name?: string;
    url?: string;
    error?: string;
    detail?: string;
    debug?: unknown;
};

type SynologyUploadStatus = {
    status?: 'queued' | 'uploading' | 'success' | 'error';
    progress?: number;
    message?: string;
    error?: string | null;
    detail?: string | null;
    debug?: unknown;
    name?: string;
    url?: string;
};

type IdentifierChip = {
    key: string;
    label: string;
    value: string;
};

const idleVideoUploadState: VideoUploadState = {
    phase: 'idle',
    progress: 0,
    message: '',
};

const IMAGE_THUMBNAIL_VISIBLE_LIMIT = 4;
const VIDEO_CONFIRMATION_RETRY_DELAYS_MS = [0, 2000, 3000, 5000, 8000, 12000, 15000, 20000];

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

const waitForSynologyVideoConfirmation = async (
    sku: string,
    onAttempt?: (attempt: number, total: number) => void,
) => {
    for (let index = 0; index < VIDEO_CONFIRMATION_RETRY_DELAYS_MS.length; index += 1) {
        const delayMs = VIDEO_CONFIRMATION_RETRY_DELAYS_MS[index];
        if (delayMs > 0) await wait(delayMs);
        onAttempt?.(index + 1, VIDEO_CONFIRMATION_RETRY_DELAYS_MS.length);

        const confirmed = await vpsApiService.checkVideoBySku(sku, { noCache: true });
        if (confirmed?.exists) return confirmed;
    }

    return null;
};

class SynologyUploadError extends Error {
    debug?: unknown;

    constructor(message: string, debug?: unknown) {
        super(message);
        this.name = 'SynologyUploadError';
        this.debug = debug;
    }
}

const buildVideoUploadDebugText = (debug: unknown) => {
    if (!debug) return '';
    if (typeof debug === 'string') return debug;
    try {
        return JSON.stringify(debug, null, 2);
    } catch {
        return String(debug);
    }
};

const isSynologyVideoUrl = (url: string) => {
    try {
        return new URL(url).hostname === 'videos.mercadodovale.com.br';
    } catch {
        return false;
    }
};

const getSkuFromSynologyVideoUrl = (url: string) => {
    try {
        const parsed = new URL(url);
        const fileName = decodeURIComponent(parsed.pathname.split('/').pop() || '');
        return fileName.replace(/\.[^.]+$/, '').trim();
    } catch {
        return '';
    }
};

const buildStockLocationsHref = (product: Product) => {
    const term = product.sku || product.name || product.id;
    return `/admin/inventory/locations?search=${encodeURIComponent(term)}`;
};

const normalizeImageList = (images: unknown): string[] => {
    if (!Array.isArray(images)) return [];
    const seen = new Set<string>();
    return images
        .map((image) => typeof image === 'string' ? image.trim() : '')
        .filter((image) => {
            if (!image || seen.has(image)) return false;
            seen.add(image);
            return true;
        });
};

const normalizeComparableText = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
};

const findSiblingImagesForProduct = (siblings: unknown, product: Product): string[] => {
    if (!Array.isArray(siblings)) return [];

    const productColor = normalizeComparableText(product.specs?.color);
    const productSlug = normalizeComparableText(product.slug || product.specs?.slug);
    const productName = normalizeComparableText(product.name);

    return siblings
        .filter((sibling: any) => String(sibling?.id || '') !== String(product.id))
        .map((sibling: any) => {
            const images = normalizeImageList(sibling?.images);
            if (images.length === 0) return null;

            const siblingColor = normalizeComparableText(sibling?.specs?.color);
            const siblingSlug = normalizeComparableText(sibling?.slug || sibling?.specs?.slug);
            const siblingName = normalizeComparableText(sibling?.name);
            let score = 0;

            if (productColor && siblingColor === productColor) score += 4;
            if (productSlug && siblingSlug === productSlug) score += 2;
            if (productName && siblingName === productName) score += 1;

            return { images, score };
        })
        .filter((entry): entry is { images: string[]; score: number } => Boolean(entry))
        .sort((left, right) => right.score - left.score)[0]?.images || [];
};

const getProductImageBankPath = (imageUrl: string): string | null => {
    try {
        const parsed = new URL(imageUrl);
        const marker = '/images/';
        const markerIndex = parsed.pathname.indexOf(marker);
        if (markerIndex < 0) return null;
        const relativePath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
        return relativePath.startsWith('products/') ? relativePath : null;
    } catch {
        return null;
    }
};

const cleanIdentifierValue = (value: unknown): string => String(value || '').trim();

const getSpecIdentifierChips = (product: Product): IdentifierChip[] => {
    const imei1 = cleanIdentifierValue(product.specs?.imei1 || (product.specs as any)?.imei_1);
    const imei2 = cleanIdentifierValue(product.specs?.imei2 || (product.specs as any)?.imei_2);
    const serial = cleanIdentifierValue(product.specs?.serial || product.specs?.serial_number);

    return [
        imei1 ? { key: 'spec-imei1', label: 'IMEI1', value: imei1 } : null,
        imei2 ? { key: 'spec-imei2', label: 'IMEI2', value: imei2 } : null,
        !imei1 && serial ? { key: 'spec-serial', label: 'Serial', value: serial } : null,
    ].filter(Boolean) as IdentifierChip[];
};

const getUnitIdentifierChips = (units: Awaited<ReturnType<typeof unitService.listByProduct>>): IdentifierChip[] => {
    return units
        .filter((unit) => String(unit.status) === 'available')
        .flatMap((unit) => {
            const imei1 = cleanIdentifierValue(unit.imei_1);
            const imei2 = cleanIdentifierValue(unit.imei_2);
            const serial = cleanIdentifierValue(unit.serial_number);
            return [
                imei1 ? { key: `${unit.id}-imei1`, label: 'IMEI1', value: imei1 } : null,
                imei2 ? { key: `${unit.id}-imei2`, label: 'IMEI2', value: imei2 } : null,
                !imei1 && serial ? { key: `${unit.id}-serial`, label: 'Serial', value: serial } : null,
            ].filter(Boolean) as IdentifierChip[];
        })
        .slice(0, 6);
};

const uploadVideoWithProgress = (
    formData: FormData,
    token: string | undefined,
    onProgress: (progress: number) => void,
) => new Promise<SynologyUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Video files go directly to the VPS upload endpoint to avoid proxy limits.
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
            reject(new SynologyUploadError(getUploadErrorMessage(payload, `Erro HTTP ${xhr.status} no upload para a VPS`), payload?.debug));
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
            throw new SynologyUploadError(getUploadErrorMessage(status, 'Nao foi possivel consultar o status do upload'), status?.debug);
        }
        if (status?.status === 'success') return status;
        if (status?.status === 'error') {
            throw new SynologyUploadError(getUploadErrorMessage(status, 'Falha ao gravar video no Synology'), status.debug);
        }

        await wait(1500);
    }

    throw new Error('O Synology ainda nao confirmou o upload depois de 135 segundos');
};


/**
 * ProductCard Component
 * Displays product information in a card format with image, prices, and status
 */
export const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onDelete, selectionMode = false, isSelected = false, onToggleSelect, tiktokProductLink = null }) => {
    const [fetchedImages, setFetchedImages] = useState<string[]>([]);
    const [productImages, setProductImages] = useState<string[]>(() => normalizeImageList(product.images));
    const [isImageGalleryExpanded, setIsImageGalleryExpanded] = useState(false);
    const [isUpdatingImages, setIsUpdatingImages] = useState(false);
    const [replaceImageIndex, setReplaceImageIndex] = useState<number | null>(null);
    const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
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
    const [isHiddenFromCatalog, setIsHiddenFromCatalog] = useState(Boolean(product.hide_from_catalog));
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [isTogglingCatalogVisibility, setIsTogglingCatalogVisibility] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isStockLocationModalOpen, setIsStockLocationModalOpen] = useState(false);
    const [stockLocationRows, setStockLocationRows] = useState<ProductStockLocation[]>([]);
    const [stockLocationLoading, setStockLocationLoading] = useState(false);
    const [stockLocationError, setStockLocationError] = useState<string | null>(null);
    const [unitIdentifierChips, setUnitIdentifierChips] = useState<IdentifierChip[]>([]);

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
    const [isTikTokModalOpen, setIsTikTokModalOpen] = useState(false);
    const [currentTikTokProductLink, setCurrentTikTokProductLink] = useState<TikTokShopProductLink | null>(
        () => tiktokProductLink,
    );
    const [isPreparingShopeeModal, setIsPreparingShopeeModal] = useState(false);
    const [shopeeCompany, setShopeeCompany] = useState<Company | null>(null);
    const [shopeeModalProductSource, setShopeeModalProductSource] = useState<Product & Record<string, any>>(product as Product & Record<string, any>);

    const shopeeVisualState = getShopeeButtonVisualState({ shopee_item_id: shopeeItemId });
    const currentTikTokStatus = String(currentTikTokProductLink?.status || '').toUpperCase();
    const hasTikTokLink = Boolean(currentTikTokProductLink?.tiktok_product_id);
    const isTikTokInheritedLink = Boolean(
        currentTikTokProductLink?.product_id
        && String(currentTikTokProductLink.product_id) !== String(product.id),
    );
    const isTikTokSynced = ['ACTIVATE', 'ACTIVE'].includes(currentTikTokStatus);
    const isTikTokPending = currentTikTokStatus === 'PENDING';

    useEffect(() => {
        setCurrentTikTokProductLink(tiktokProductLink);
    }, [tiktokProductLink]);
    const shopeeModalProduct = mapProductToShopeeLocalProduct(shopeeModalProductSource as Product & Record<string, any>) as LocalProduct;
    const emptyShopeeHistory: ShopeeProduct[] = [];
    const currentStockQuantity = Math.max(0, Number(currentStock || 0));
    const displayStockLocationRows = stockLocationRows.length > 0
        ? stockLocationRows.map((item) => ({
            id: item.id,
            depositName: item.deposit?.name || 'Deposito sem nome',
            locationName: item.location?.name || '-',
            locationCode: item.location?.code || null,
            quantity: Number(item.quantity || 0),
            reserved: Number(item.reserved_quantity || 0),
            fallbackStoreStockLocation: false,
        }))
        : currentStockQuantity > 0
            ? [{
                id: 'fallback-store-stock',
                depositName: 'Loja Principal',
                locationName: 'Estoque Geral',
                locationCode: 'LOJA',
                quantity: currentStockQuantity,
                reserved: 0,
                fallbackStoreStockLocation: true,
            }]
            : [];
    const stockLocationTotal = displayStockLocationRows.reduce((sum, item) => sum + item.quantity, 0);
    const stockLocationReserved = displayStockLocationRows.reduce((sum, item) => sum + item.reserved, 0);
    const stockLocationAvailable = Math.max(0, stockLocationTotal - stockLocationReserved);
    const specIdentifierChips = getSpecIdentifierChips(product);
    const hasSpecIdentifiers = specIdentifierChips.length > 0;
    const identifierChips = hasSpecIdentifiers ? specIdentifierChips : unitIdentifierChips;

    // Check video: URLs do Synology precisam existir de verdade; URLs externas salvas continuam confiaveis.
    useEffect(() => {
        const dbVideoUrl = (product.video_url || '').trim();
        if (dbVideoUrl && !isSynologyVideoUrl(dbVideoUrl)) {
            setVideoInfo({ exists: true, url: dbVideoUrl, checking: false });
            return;
        }

        const videoSku = dbVideoUrl
            ? getSkuFromSynologyVideoUrl(dbVideoUrl)
            : (product.sku || '').trim().replace(/\s+/g, '');

        if (!videoSku) {
            setVideoInfo({ exists: false, url: null, checking: false });
            return;
        }

        setVideoInfo((prev) => ({ ...prev, checking: true }));
        let isMounted = true;

        const canonicalUrl = dbVideoUrl || `https://videos.mercadodovale.com.br/${encodeURIComponent(videoSku)}.mp4`;

        const resolveVideoInfo = async () => {
            // Caminho principal
            const primary = await vpsApiService.checkVideoBySku(videoSku);
            if (primary?.exists) {
                return { exists: true, url: primary.url || canonicalUrl };
            }

            // Fallback para endpoint público legado
            try {
                const path = `/public/check-video?sku=${encodeURIComponent(videoSku)}`;
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

    useEffect(() => {
        let cancelled = false;

        if (!product.track_inventory || hasSpecIdentifiers || !product.id || Number(product.stock_quantity || 0) <= 0) {
            setUnitIdentifierChips([]);
            return;
        }

        unitService.listByProduct(product.id)
            .then((units) => {
                if (cancelled) return;
                setUnitIdentifierChips(getUnitIdentifierChips(units));
            })
            .catch(() => {
                if (!cancelled) setUnitIdentifierChips([]);
            });

        return () => {
            cancelled = true;
        };
    }, [hasSpecIdentifiers, product.id, product.stock_quantity, product.track_inventory]);

    // Handle Upload video
    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !product.sku) return;

        // Reset input value to allow uploading the same file again if it fails
        e.target.value = '';

        const token = await getAuthSessionToken();
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

            const confirmed = await waitForSynologyVideoConfirmation(normalizedSku, (attempt, total) => {
                setVideoUpload({
                    phase: 'verifying',
                    progress: Math.min(99, 94 + Math.round((attempt / total) * 5)),
                    message: attempt === 1
                        ? 'Confirmando arquivo no Synology...'
                        : `Aguardando o Synology listar o video (${attempt}/${total})...`,
                });
            });

            const videoUrl = confirmed?.url || finalStatus.url || upload.url || `https://videos.mercadodovale.com.br/${encodeURIComponent(fileName)}`;
            if (confirmed?.exists) {
                toast.success(`Video enviado com sucesso: ${finalStatus.name || upload.name || fileName}`);
            } else {
                toast.info('Video enviado. O Synology pode levar alguns instantes para listar o arquivo.', {
                    description: finalStatus.name || upload.name || fileName,
                });
            }
            setVideoInfo({ exists: true, url: videoUrl, checking: false });
            setVideoUpload({
                phase: 'success',
                progress: 100,
                message: confirmed?.exists ? 'Video enviado com sucesso' : 'Video enviado; aguardando indexacao',
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
                debug: error?.debug,
            });
        } finally {
            setIsUploadingVideo(false);
        }
    };

    const handleCopyVideoUploadDebug = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const debugText = buildVideoUploadDebugText(videoUpload.debug);
        if (!debugText) return;
        try {
            await navigator.clipboard.writeText(debugText);
            toast.success('Debug do upload copiado');
        } catch {
            toast.error('Nao foi possivel copiar o debug');
        }
    };

    const handleVideoTileAction = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (!product.sku || videoInfo.checking || isUploadingVideo) return;
        if (videoInfo.exists && videoInfo.url) {
            window.open(videoInfo.url, '_blank');
            return;
        }
        videoInputRef.current?.click();
    };

    const getVideoTileLabel = () => {
        if (!product.sku) return 'Produto sem SKU para enviar video';
        if (videoInfo.checking) return 'Verificando video no Synology';
        if (isUploadingVideo) return 'Enviando video para o Synology';
        return videoInfo.exists ? 'Ver video do produto' : 'Enviar video do produto';
    };

    // Update internal state if props change
    useEffect(() => {
        setCurrentStatus(product.status);
        setCurrentStock(product.stock_quantity);
        setIsHiddenFromCatalog(Boolean(product.hide_from_catalog));
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
            const currentVpsProduct = await vpsApiService.getProductById(product.id, true);
            if (!currentVpsProduct) throw new Error('Produto nao encontrado na VPS');
            const updated = await vpsApiService.updateProduct(product.id, {
                ...currentVpsProduct,
                status: newStatus,
            });
            if (!updated) throw new Error('Falha ao alterar status na VPS');
            setCurrentStatus(newStatus);
        } catch (err) {
            console.error('[ProductCard] Erro ao alterar status:', err);
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const handleToggleCatalogVisibility = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextHidden = !isHiddenFromCatalog;
        setIsTogglingCatalogVisibility(true);
        try {
            const updated = await vpsApiService.updateProductCatalogVisibility(product.id, nextHidden);
            if (!updated) throw new Error('Falha ao alterar visibilidade do produto no site');
            setIsHiddenFromCatalog(nextHidden);
            toast.success(nextHidden ? 'Produto oculto do site' : 'Produto visivel no site');
        } catch (err) {
            console.error('[ProductCard] Erro ao alterar visibilidade no catalogo:', err);
            toast.error('Nao foi possivel alterar a visibilidade no site');
        } finally {
            setIsTogglingCatalogVisibility(false);
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
                
                // Sincroniza stock na VPS: busca o produto completo e faz PUT com merge
                // (PUT na VPS é replace completo — enviar só stock_quantity zerava os outros campos)
                const currentVpsProduct = await vpsApiService.getProductById(product.id, true);
                if (!currentVpsProduct) throw new Error('Produto nao encontrado na VPS');
                const updated = await vpsApiService.updateProduct(product.id, {
                    ...currentVpsProduct,
                    stock_quantity: realStock,
                });
                if (!updated) throw new Error('Falha ao atualizar estoque na VPS');

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

    const handleOpenStockLocationModal = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsStockLocationModalOpen(true);
        setStockLocationLoading(true);
        setStockLocationError(null);

        try {
            const rows = await stockLocationService.getProductStockDistribution(product.id);
            setStockLocationRows(rows);
        } catch (error) {
            console.error('[ProductCard] Erro ao carregar locais de estoque:', error);
            setStockLocationRows([]);
            setStockLocationError('Nao foi possivel carregar os locais deste produto.');
        } finally {
            setStockLocationLoading(false);
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
            const itemId = await shopeeProductService.getItemIdByProductId(product.id);
            if (itemId) {
                setShopeeItemId(itemId);
                return itemId;
            }
        } catch (error) {
            console.error('[ProductCard] Erro ao atualizar estado Shopee:', error);
        }

        return null;
    };

    const fetchShopeeItemBaseInfo = async (itemId: number) => {
        const response = await fetch(`/api/shopee-catalog?action=get_item_base_info&item_id_list=${encodeURIComponent(String(itemId))}`);
        if (!response.ok) throw new Error('Falha ao validar anuncio na Shopee');
        const payload = await response.json().catch(() => null);
        return payload?.response?.item_list?.[0] || null;
    };

    const clearStaleShopeeLink = async (itemId: number) => {
        await shopeeProductService.deleteByProductId(product.id);

        const latestProduct = await vpsApiService.getProductById(product.id, true);
        await vpsApiService.updateProduct(product.id, {
            ...(latestProduct || product),
            shopee_item_id: null,
        });

        setShopeeItemId(null);
    };

    const openShopeeSyncModal = async () => {
        await ensureShopeeCompany();
        const hydratedProduct = await vpsApiService.getProductById(product.id, true);
        setShopeeModalProductSource({
            ...(product as Product & Record<string, any>),
            ...(hydratedProduct || {}),
            shopee_item_id: null,
        });
        setIsShopeeModalOpen(true);
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
                const shopeeItem = await fetchShopeeItemBaseInfo(existingItemId);
                const validation = validateShopeeItemForProduct(product, shopeeItem);
                if (!validation.isMatch) {
                    await clearStaleShopeeLink(existingItemId);
                    toast.warning('Vinculo antigo da Shopee removido', {
                        description: validation.reason || 'O anuncio salvo nao corresponde a este produto.',
                    });
                    await openShopeeSyncModal();
                    return;
                }

                const company = await ensureShopeeCompany();
                const shopeeUrl = buildShopeeProductUrl(company?.shopee_shop_id, existingItemId);
                if (!shopeeUrl) {
                    toast.warning('Shop ID da Shopee nao configurado. Nao foi possivel abrir o anuncio.');
                    return;
                }

                window.open(shopeeUrl, '_blank', 'noopener,noreferrer');
                return;
            }

            await openShopeeSyncModal();
        } catch (error) {
            console.error('[ProductCard] Erro ao preparar modal Shopee:', error);
            toast.error('Nao foi possivel abrir a sincronizacao da Shopee.');
        } finally {
            setIsPreparingShopeeModal(false);
        }
    };

    const handleOpenTikTokPreparation = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsTikTokModalOpen(true);
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

    const persistProductImages = async (nextImages: string[]) => {
        if (!product.sku) {
            toast.error('Este produto precisa de SKU para atualizar fotos pela VPS.');
            return false;
        }

        setIsUpdatingImages(true);
        try {
            const cleanImages = normalizeImageList(nextImages);
            const affectedRows = await vpsApiService.updateProductImagesBySku(product.sku, cleanImages);
            if (affectedRows < 1) {
                toast.error('A VPS nao encontrou este SKU para atualizar as fotos.');
                return false;
            }
            setProductImages(cleanImages);
            setFetchedImages(cleanImages);
            toast.success('Fotos do produto atualizadas.');
            return true;
        } catch (error: any) {
            toast.error(error?.message || 'Nao foi possivel atualizar as fotos.');
            return false;
        } finally {
            setIsUpdatingImages(false);
        }
    };

    const handleSetPrimaryImage = async (e: React.MouseEvent, imageIndex: number) => {
        e.stopPropagation();
        if (imageIndex === 0 || isUpdatingImages) return;
        const nextImages = [...productImages];
        const [selectedImage] = nextImages.splice(imageIndex, 1);
        if (!selectedImage) return;
        await persistProductImages([selectedImage, ...nextImages]);
    };

    const handleOpenImagePicker = (e: React.MouseEvent, imageIndex: number | null = null) => {
        e.stopPropagation();
        if (isUpdatingImages) return;
        setReplaceImageIndex(imageIndex);
        imageInputRef.current?.click();
    };

    const handleProductImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
        event.target.value = '';
        if (files.length === 0) return;
        if (!product.sku) {
            toast.error('Este produto precisa de SKU para enviar fotos.');
            return;
        }

        setIsUpdatingImages(true);
        try {
            const upload = await uploadImagesToBank(files, undefined, {
                sku: product.sku,
                productName: product.name,
                color: product.specs?.color || 'PADRAO',
                startOrder: productImages.length + 1,
            });

            if (upload.errors.length > 0) {
                toast.error(`Falha ao enviar ${upload.errors.length} foto(s).`);
            }

            const uploadedUrls = upload.success.map((image) => image.url).filter(Boolean);
            if (uploadedUrls.length === 0) return;

            const nextImages = replaceImageIndex == null
                ? [...productImages, ...uploadedUrls]
                : productImages.map((image, index) => index === replaceImageIndex ? uploadedUrls[0] : image);

            const replacedPath = replaceImageIndex == null ? null : getProductImageBankPath(productImages[replaceImageIndex] || '');
            const saved = await persistProductImages(nextImages);
            if (saved && replacedPath) {
                deleteImageFromBank(replacedPath).catch(() => undefined);
            }
        } catch (error: any) {
            toast.error(error?.message || 'Nao foi possivel enviar a foto.');
        } finally {
            setReplaceImageIndex(null);
            setIsUpdatingImages(false);
        }
    };

    const handleReplaceProductImage = (e: React.MouseEvent, imageIndex: number) => {
        handleOpenImagePicker(e, imageIndex);
    };

    const handleDeleteProductImage = async (e: React.MouseEvent, imageIndex: number) => {
        e.stopPropagation();
        if (isUpdatingImages) return;
        const imageUrl = productImages[imageIndex];
        if (!imageUrl) return;
        const nextImages = productImages.filter((_, index) => index !== imageIndex);
        const saved = await persistProductImages(nextImages);
        const bankPath = getProductImageBankPath(imageUrl);
        if (saved && bankPath) {
            try {
                await deleteImageFromBank(bankPath);
            } catch {
                toast.warning('A foto saiu do produto, mas o arquivo nao foi removido da VPS.');
            }
        }
    };

    const handleImageDragStart = (e: React.DragEvent, imageIndex: number) => {
        e.stopPropagation();
        if (isUpdatingImages) return;
        setDraggedImageIndex(imageIndex);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(imageIndex));
    };

    const handleImageDrop = async (e: React.DragEvent, imageIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        const fromIndex = draggedImageIndex ?? Number(e.dataTransfer.getData('text/plain'));
        setDraggedImageIndex(null);
        if (isUpdatingImages || !Number.isInteger(fromIndex) || fromIndex === imageIndex) return;
        const nextImages = [...productImages];
        const [movedImage] = nextImages.splice(fromIndex, 1);
        if (!movedImage) return;
        nextImages.splice(imageIndex, 0, movedImage);
        await persistProductImages(nextImages);
    };

    // Resolve a capa pela imagem real do produto antes de usar modelo/cor como fallback.
    useEffect(() => {
        let isMounted = true;
        const cleanImages = normalizeImageList(product.images);

        if (cleanImages.length > 0) {
            setProductImages(cleanImages);
            setFetchedImages(cleanImages);
            return () => { isMounted = false; };
        }

        setProductImages([]);
        setFetchedImages([]);

        const resolveFallbackImages = async () => {
            try {
                const fullProduct = await vpsApiService.getProductById(product.id, true);
                if (!isMounted) return;
                const fullProductImages = normalizeImageList(fullProduct?.images);
                if (fullProductImages.length > 0) {
                    setProductImages(fullProductImages);
                    setFetchedImages(fullProductImages);
                    return;
                }

                if (product.model_id) {
                    const fetchedImageUrl = await getModelImageWithCache(product.model_id, product.specs?.color);
                    if (!isMounted) return;
                    if (fetchedImageUrl) {
                        setFetchedImages([fetchedImageUrl]);
                        return;
                    }
                }

                if (product.model_id) {
                    const siblingProducts = await vpsApiService.getProducts({
                        model_id: product.model_id,
                        status: 'all',
                        limit: 200,
                        noCache: true
                    });
                    if (!isMounted) return;
                    const siblingImages = findSiblingImagesForProduct(
                        siblingProducts,
                        product
                    );
                    if (siblingImages.length > 0) {
                        setProductImages(siblingImages);
                        setFetchedImages(siblingImages);
                    }
                }
            } catch (error) {
                console.warn('[ProductCard] Falha ao carregar imagens completas do produto:', error);
            }
        };

        resolveFallbackImages();

        return () => { isMounted = false; };
    }, [product.id, product.images, product.model_id, product.specs?.color]);

    const rawCoverImage = fetchedImages.length > 0 ? fetchedImages[0] : null;
    const coverImage = getCacheBustedUrl(rawCoverImage, product.updated || product.created);
    const visibleProductImages = isImageGalleryExpanded
        ? productImages
        : productImages.slice(0, IMAGE_THUMBNAIL_VISIBLE_LIMIT);
    const hiddenImageCount = Math.max(0, productImages.length - visibleProductImages.length);

    // Format price from centavos to BRL
    const formatPrice = (centavos: number): string => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(centavos / 100);
    };

    const isParentProduct = Number(product.is_parent) === 1;
    const adminCardStatus = getAdminProductCardStatus({
        ...product,
        status: currentStatus,
        stock_quantity: currentStock,
    });

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

                {/* Badge "Produto Pai" - substitui o badge de estoque pra agregadores */}
                {isParentProduct && (
                    <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-bold shadow-md bg-blue-600 text-white border border-blue-700 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        Produto Pai
                    </div>
                )}
            </div>

            <div className="border-t border-slate-100 bg-white px-3 py-3">
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple={replaceImageIndex == null}
                    className="hidden"
                    onChange={handleProductImageUpload}
                />
                <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/*"
                    ref={videoInputRef}
                    className="hidden"
                    onChange={handleVideoUpload}
                />

                <div className="flex flex-wrap gap-2">
                    {visibleProductImages.map((imageUrl, imageIndex) => {
                        const thumbUrl = getCacheBustedUrl(imageUrl, product.updated || product.created);
                        const isPrimaryImage = imageIndex === 0;

                        return (
                            <div
                                key={`${imageUrl}-${imageIndex}`}
                                draggable={!isUpdatingImages}
                                onDragStart={(e) => handleImageDragStart(e, imageIndex)}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(e) => handleImageDrop(e, imageIndex)}
                                onDragEnd={() => setDraggedImageIndex(null)}
                                className={cn(
                                    'group relative h-[72px] w-[72px] overflow-hidden rounded-lg border bg-slate-100',
                                    isPrimaryImage ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={(e) => handleSetPrimaryImage(e, imageIndex)}
                                    disabled={isPrimaryImage || isUpdatingImages}
                                    className="block h-full w-full"
                                    title={isPrimaryImage ? 'Foto principal' : 'Definir como principal'}
                                    aria-label={isPrimaryImage ? `Foto principal ${imageIndex + 1}` : `Definir foto ${imageIndex + 1} como principal`}
                                >
                                    <img
                                        src={thumbUrl}
                                        alt={`${product.name} foto ${imageIndex + 1}`}
                                        className="h-full w-full object-cover"
                                    />
                                </button>

                                {isPrimaryImage && (
                                    <span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white shadow">
                                        1
                                    </span>
                                )}

                                <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1">
                                    <button
                                        type="button"
                                        onClick={(e) => handleReplaceProductImage(e, imageIndex)}
                                        disabled={isUpdatingImages}
                                        className="rounded-md bg-white/95 p-1 shadow-sm transition-colors hover:bg-blue-50"
                                        title="Substituir foto"
                                        aria-label={`Substituir foto ${imageIndex + 1}`}
                                    >
                                        <Edit className="h-3.5 w-3.5 text-blue-600" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteProductImage(e, imageIndex)}
                                        disabled={isUpdatingImages}
                                        className="rounded-md bg-white/95 p-1 shadow-sm transition-colors hover:bg-red-50"
                                        title="Excluir foto"
                                        aria-label={`Excluir foto ${imageIndex + 1}`}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={handleVideoTileAction}
                        disabled={!product.sku || videoInfo.checking || isUploadingVideo}
                        className={cn(
                            'flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-lg border transition-colors',
                            !product.sku
                                ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                                : videoInfo.checking || isUploadingVideo
                                    ? 'cursor-wait border-blue-100 bg-blue-50 text-blue-500'
                                    : videoInfo.exists
                                        ? 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100'
                                        : 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100'
                        )}
                        title={getVideoTileLabel()}
                        aria-label={getVideoTileLabel()}
                    >
                        {videoInfo.checking || isUploadingVideo ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : videoInfo.exists ? (
                            <Video className="h-5 w-5" />
                        ) : (
                            <VideoOff className="h-5 w-5" />
                        )}
                        <span className="px-1 text-center text-[10px] font-semibold leading-tight">
                            {videoInfo.checking
                                ? 'Checando'
                                : isUploadingVideo
                                    ? 'Enviando'
                                    : videoInfo.exists
                                        ? 'Ver video'
                                        : 'Enviar video'}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={(e) => handleOpenImagePicker(e)}
                        disabled={isUpdatingImages || !product.sku}
                        className={cn(
                            'flex h-[72px] w-[72px] items-center justify-center rounded-lg border border-dashed transition-colors',
                            product.sku
                                ? 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100'
                                : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                        )}
                        title={product.sku ? 'Adicionar foto' : 'Produto sem SKU para upload'}
                        aria-label="Adicionar foto"
                    >
                        {isUpdatingImages ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <ImagePlus className="h-5 w-5" />
                        )}
                    </button>

                    {productImages.length > IMAGE_THUMBNAIL_VISIBLE_LIMIT && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsImageGalleryExpanded((current) => !current);
                            }}
                            className="flex h-[72px] w-[72px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100"
                            title={isImageGalleryExpanded ? 'Mostrar menos fotos' : 'Mostrar todas as fotos'}
                            aria-label={isImageGalleryExpanded ? 'Mostrar menos fotos' : 'Mostrar todas as fotos'}
                        >
                            <span className="flex flex-col items-center gap-1 text-[11px] font-semibold">
                                {isImageGalleryExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <>
                                        <ChevronDown className="h-4 w-4" />
                                        +{hiddenImageCount}
                                    </>
                                )}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-end gap-1 pb-0.5">
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
                        <button
                            type="button"
                            onClick={handleOpenStockLocationModal}
                            className="shrink-0 p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors group"
                            title="Ver locais de estoque"
                            aria-label="Ver locais de estoque"
                        >
                            <MapPin className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
                        </button>

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

                        <button
                            type="button"
                            onClick={handleOpenTikTokPreparation}
                            className={cn(
                                "relative shrink-0 p-1.5 rounded-lg transition-all duration-200 group border",
                                isTikTokSynced
                                    ? "border-cyan-200 bg-slate-950 shadow-[0_0_0_3px_rgba(37,244,238,0.12),0_0_18px_rgba(254,44,85,0.22)]"
                                    : hasTikTokLink
                                        ? "border-cyan-200 bg-cyan-50"
                                    : "border-transparent hover:border-cyan-100 hover:bg-slate-100"
                            )}
                            title={
                                isTikTokSynced
                                    ? 'Anuncio ativo no TikTok Shop. Abrir produto.'
                                    : isTikTokPending
                                        ? isTikTokInheritedLink
                                            ? 'Variacao incluida no anuncio do produto pai, em analise no TikTok Shop.'
                                            : 'Anuncio em analise no TikTok Shop.'
                                        : hasTikTokLink
                                            ? isTikTokInheritedLink
                                                ? 'Variacao incluida no rascunho do produto pai no TikTok Shop.'
                                                : 'Rascunho vinculado ao TikTok Shop.'
                                            : 'Enviar para o TikTok Shop'
                            }
                            aria-label={isTikTokSynced ? 'Produto sincronizado com TikTok Shop' : 'Enviar produto para TikTok Shop'}
                        >
                            {hasTikTokLink && (
                                <span className={cn(
                                    "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                                    isTikTokSynced
                                        ? "bg-emerald-400"
                                        : isTikTokPending
                                            ? "bg-amber-400"
                                            : "bg-cyan-400",
                                )} />
                            )}
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                className={cn(
                                    "h-4 w-4",
                                    isTikTokSynced ? "text-white" : "text-slate-400 group-hover:text-slate-950"
                                )}
                                aria-hidden="true"
                            >
                                <path
                                    d="M14.1 4.2v10.35a4.05 4.05 0 1 1-3.15-3.94"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M14.1 4.2c.62 2.55 2.25 4.02 4.65 4.35"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M13.15 4.65v9.6a3.2 3.2 0 1 1-2.45-3.12"
                                    stroke="#25f4ee"
                                    strokeWidth="1.15"
                                    strokeLinecap="round"
                                    opacity={isTikTokSynced ? 1 : 0}
                                />
                                <path
                                    d="M15.05 3.75c.6 2.18 1.92 3.42 4.05 3.8"
                                    stroke="#fe2c55"
                                    strokeWidth="1.15"
                                    strokeLinecap="round"
                                    opacity={isTikTokSynced ? 1 : 0}
                                />
                            </svg>
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
                        {product.model_id && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = `/admin/products/models/${encodeURIComponent(product.model_id)}`;
                                }}
                                className="shrink-0 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Ver painel do modelo"
                            >
                                <Package className="w-4 h-4 text-slate-600" />
                            </button>
                        )}
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
                            onClick={handleToggleCatalogVisibility}
                            disabled={isTogglingCatalogVisibility}
                            className={cn(
                                'shrink-0 p-1.5 rounded-lg transition-colors group',
                                isHiddenFromCatalog ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-sky-50'
                            )}
                            title={isHiddenFromCatalog ? 'Mostrar no site' : 'Ocultar do site'}
                            aria-label={isHiddenFromCatalog ? 'Mostrar produto no site' : 'Ocultar produto do site'}
                        >
                            {isTogglingCatalogVisibility ? (
                                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                            ) : isHiddenFromCatalog ? (
                                <EyeOff className="w-4 h-4 text-amber-600 group-hover:text-amber-700" />
                            ) : (
                                <Eye className="w-4 h-4 text-slate-400 group-hover:text-sky-600" />
                            )}
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
                                href={`/produto/${product.id}`}
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
                        {product.model_id && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = `/admin/products/models/${encodeURIComponent(product.model_id)}`;
                                }}
                                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Ver painel do modelo"
                            >
                                <Package className="w-4 h-4 text-slate-600" />
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
                            onClick={handleToggleCatalogVisibility}
                            disabled={isTogglingCatalogVisibility}
                            className={cn(
                                'p-1.5 rounded-lg transition-colors group',
                                isHiddenFromCatalog ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-sky-50'
                            )}
                            title={isHiddenFromCatalog ? 'Mostrar no site' : 'Ocultar do site'}
                            aria-label={isHiddenFromCatalog ? 'Mostrar produto no site' : 'Ocultar produto do site'}
                        >
                            {isTogglingCatalogVisibility ? (
                                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                            ) : isHiddenFromCatalog ? (
                                <EyeOff className="w-4 h-4 text-amber-600 group-hover:text-amber-700" />
                            ) : (
                                <Eye className="w-4 h-4 text-slate-400 group-hover:text-sky-600" />
                            )}
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
                        {videoUpload.phase === 'error' && videoUpload.debug && (
                            <button
                                type="button"
                                onClick={handleCopyVideoUploadDebug}
                                className="mt-2 inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100"
                                title="Copiar diagnostico tecnico do envio"
                            >
                                <Copy className="h-3 w-3" />
                                Copiar debug
                            </button>
                        )}
                    </div>
                )}

                {/* Status Badge */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn(
                        'inline-block px-2 py-1 text-xs font-medium rounded-md border',
                        adminCardStatus.color
                    )}>
                        {adminCardStatus.label}
                    </span>
                    {isHiddenFromCatalog && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            <EyeOff className="h-3 w-3" />
                            Oculto no site
                        </span>
                    )}
                    {(product.production_days != null && product.production_days > 0) && (
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded-md border bg-amber-50 text-amber-700 border-amber-200">
                            ⚙️ {product.production_days}d fab.
                        </span>
                    )}
                </div>

                {product.track_inventory && !isParentProduct && (
                    <button
                        type="button"
                        onClick={handleOpenStockLocationModal}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-2.5 py-2 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-100/70"
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="min-w-0">
                                <span className="block text-[10px] font-semibold uppercase text-emerald-700">Onde esta no estoque</span>
                                <span className="block truncate text-xs text-slate-600">Ver deposito e local</span>
                            </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-emerald-700 shadow-sm">
                            {currentStock ?? 0} un.
                        </span>
                    </button>
                )}

                {/* Unique Identifiers (IMEI / Serial) */}
                {identifierChips.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Identificadores</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {identifierChips.map((chip) => (
                                <span key={chip.key} className="font-mono text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                    {chip.label} {chip.value}
                                </span>
                            ))}
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

            {isStockLocationModalOpen && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsStockLocationModalOpen(false);
                    }}
                >
                    <div
                        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase text-emerald-700">Onde esta no estoque</p>
                                <h3 className="mt-1 truncate text-base font-bold text-slate-900">{product.name}</h3>
                                {product.sku && <p className="mt-0.5 font-mono text-xs text-slate-500">SKU: {product.sku}</p>}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsStockLocationModalOpen(false)}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Fechar locais de estoque"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4 px-5 py-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                    <p className="text-[10px] font-semibold uppercase text-slate-500">Total</p>
                                    <p className="mt-1 text-lg font-black text-slate-900">{stockLocationTotal}</p>
                                </div>
                                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                                    <p className="text-[10px] font-semibold uppercase text-amber-700">Reservado</p>
                                    <p className="mt-1 text-lg font-black text-amber-700">{stockLocationReserved}</p>
                                </div>
                                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                                    <p className="text-[10px] font-semibold uppercase text-emerald-700">Disponivel</p>
                                    <p className="mt-1 text-lg font-black text-emerald-700">{stockLocationAvailable}</p>
                                </div>
                            </div>

                            {stockLocationLoading ? (
                                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 py-8 text-sm text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Carregando locais de estoque...
                                </div>
                            ) : stockLocationError ? (
                                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {stockLocationError}
                                </div>
                            ) : displayStockLocationRows.length === 0 ? (
                                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                                    Nenhum deposito/local cadastrado para este produto.
                                </div>
                            ) : (
                                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-100">
                                    {displayStockLocationRows.map((item) => {
                                        const available = Math.max(0, item.quantity - item.reserved);

                                        return (
                                            <div key={item.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-slate-900">
                                                            {item.depositName}
                                                        </p>
                                                        <p className="mt-0.5 truncate text-xs text-slate-500">
                                                            Local: {item.locationName}
                                                            {item.locationCode ? ` (${item.locationCode})` : ''}
                                                        </p>
                                                        {item.fallbackStoreStockLocation && (
                                                            <p className="mt-1 text-[10px] font-semibold uppercase text-emerald-600">
                                                                Saldo atual considerado na loja ate redistribuir
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-sm font-black text-emerald-700">{available} disp.</p>
                                                        <p className="text-[11px] text-slate-500">{item.quantity} total</p>
                                                        {item.reserved > 0 && <p className="text-[11px] text-amber-600">{item.reserved} reservado</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <a
                                href={buildStockLocationsHref(product)}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                            >
                                <MapPin className="h-4 w-4" />
                                Abrir Locais de Estoque
                            </a>
                        </div>
                    </div>
                </div>
            )}

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

            {isTikTokModalOpen && (
                <TikTokShopSyncModal
                    productId={currentTikTokProductLink?.product_id || product.id}
                    onClose={() => setIsTikTokModalOpen(false)}
                    onSuccess={(link) => {
                        setCurrentTikTokProductLink(link);
                    }}
                />
            )}
        </div>
    );
};
