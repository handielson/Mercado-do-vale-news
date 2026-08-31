import React, { useState, useRef, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Camera, Download, Upload, Image as ImageIcon, Sparkles, Smartphone, Layers, Plus, Search, X, Copy, PenTool, CheckCircle2, Calendar, CalendarClock, Trash2, Clock, ToggleLeft, ToggleRight, Facebook, Instagram, MessageCircle, ShieldCheck, BrainCircuit, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { toBlob, toPng } from 'html-to-image';
import { catalogService } from '../../../services/catalogService';
import type { CatalogProduct, ProductGroup, ProductVariant } from '../../../types/catalog';
import { groupProductsByVariants } from '../../../services/productGrouping';
import { colorService } from '../../../services/colors';
import { modelColorImagesService } from '../../../services/model-color-images';
import { getMarketingBulkExportSlides, getMarketingExportSlides } from '../../../utils/marketing-carousel';
import {
    DEFAULT_MARKETING_STICKER_SETTINGS,
    getMarketingCanvasSize,
    getMarketingStickerExportTargets,
    resolveMarketingStickerText,
    sanitizeMarketingStickerSettings,
    type MarketingAssetFormat,
    type MarketingStickerExportMode,
    type MarketingStickerSettings,
} from '../../../utils/marketing-sticker';
import { findMarketingTypographyFontOption } from '../../../utils/marketing-typography';
import { formatCurrency } from '../../../utils/saleCalculations';
import { hasRenderableMediaUrl, toBrowserSafeMediaUrl } from '../../../utils/media-url';
import { useTheme } from '../../../contexts/ThemeContext';
import { getCompanyData } from '../../../services/companyService';
import { Company } from '../../../types/company';
import { instagramScheduleService, InstagramSlot, CONTENT_TYPE_LABELS, ContentType } from '../../../services/instagramScheduleService';
import MarketingKitPanel from './marketing/MarketingKitPanel';
import MarketingStickerTypographyEditor from './marketing/MarketingStickerTypographyEditor';
import MarketingTypographyText from './marketing/MarketingTypographyText';
import WhatsAppStatusCampaignPanel from './marketing/WhatsAppStatusCampaignPanel';
import FacebookMarketplaceSchedulerPanel from './marketing/FacebookMarketplaceSchedulerPanel';
import MarketingApprovalCenterPanel from './marketing/MarketingApprovalCenterPanel';
import MarketingCampaignAgentPanel from './marketing/MarketingCampaignAgentPanel';
import SocialStorySchedulerPanel from './marketing/SocialStorySchedulerPanel';
import MarketingCalendarPanel from './marketing/MarketingCalendarPanel';
import ProductMarketingCard from './marketing/ProductMarketingCard';
import { buildProductMarketingArtworkData, normalizeBrazilianWhatsapp } from './marketing/productMarketingArtwork';
import ProductBlueprintCard from './marketing/ProductBlueprintCard';
import { buildProductBlueprintArtworkData, buildProductBlueprintSourcePayload } from './marketing/productBlueprintArtwork';
import { paymentFeesService } from '../../../services/payment-fees';
import type { PaymentFee } from '../../../types/payment-fees';
import { vpsClient } from '../../../services/vpsClient';
import { ensureMarketingTypographyFontLoaded } from './marketing/marketingTypographyFonts';
import {
    DAY_LABELS_FULL,
    DEFAULT_CATEGORY_PROFILE,
    DEFAULT_DAY_RULES,
    type MarketingCategoryProfile,
    type MarketingCategoryProfileMap,
    type MarketingCooldownCache,
    type MarketingDayRule,
    type MarketingManualPickMap,
} from './marketing/marketingDefaults';
import { buildTelegramDraft, pickEditorialCandidates } from './marketing/marketingEditorialEngine.js';
import { pruneMarketingCooldownCache, readMarketingState, writeMarketingState } from './marketing/marketingStorage';

const BACKGROUND_OPTIONS = [
    { id: 'dark', label: 'Dark Premium', class: 'bg-gradient-to-br from-slate-900 to-black' },
    { id: 'blue', label: 'Azul Profundo', class: 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900' },
    { id: 'purple', label: 'Roxo Neon', class: 'bg-gradient-to-br from-indigo-900 via-purple-900 to-black' },
    { id: 'orange', label: 'Laranja Oferta', class: 'bg-gradient-to-br from-orange-600 to-red-600' },
    { id: 'gold', label: 'Amarelo Ouro', class: 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500' },
    { id: 'gray', label: 'Cinza Metálico', class: 'bg-gradient-to-br from-slate-400 to-slate-600' },
    { id: 'emerald', label: 'Esmeralda Tech', class: 'bg-gradient-to-br from-teal-900 via-emerald-800 to-slate-900' },
    { id: 'pink', label: 'Rosa Pink', class: 'bg-gradient-to-br from-fuchsia-900 via-pink-600 to-rose-900' },
    { id: 'midnight', label: 'Meia Noite', class: 'bg-gradient-to-t from-slate-900 via-indigo-950 to-slate-900' },
    { id: 'white', label: 'Branco Clean', class: 'bg-white' },
];

const TagBadge = ({ tag, colorClass }: { tag: string, colorClass: string }) => (
    <code
        onClick={() => {
            navigator.clipboard.writeText(tag);
            toast.success(`${tag} copiada!`);
        }}
        className={`bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer transition-transform hover:scale-105 active:scale-95 inline-block ${colorClass}`}
        title="Copiar tag para usar na legenda"
    >
        {tag}
    </code>
);

const waitForNextFrame = () =>
    new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

const waitForMarketingProductImage = async (
    node: HTMLElement,
    expectedImageUrl?: string | null,
): Promise<void> => {
    if (expectedImageUrl === undefined) return;

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        const productImage = node.querySelector<HTMLImageElement>('img[data-marketing-product-image="true"]');
        const currentImageUrl = productImage?.dataset.marketingSourceUrl ?? productImage?.getAttribute('src') ?? null;
        const imageReady = productImage?.dataset.marketingImageReady !== 'false';

        if (currentImageUrl === expectedImageUrl && imageReady) return;
        await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    }

    throw new Error('A imagem do produto nao foi atualizada a tempo para exportacao');
};

const getRenderableProductImages = (product?: CatalogProduct | null): string[] => {
    if (!product) return [];

    const usableImages = (Array.isArray(product.images) ? product.images : [])
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => toBrowserSafeMediaUrl(value))
        .filter((value) => hasRenderableMediaUrl(value));

    if (usableImages.length > 0) return usableImages;

    const fallbackImageUrl = typeof product.image_url === 'string'
        ? toBrowserSafeMediaUrl(product.image_url)
        : '';

    return hasRenderableMediaUrl(fallbackImageUrl) ? [fallbackImageUrl] : [];
};

const prepareMarketingProducts = async (products: CatalogProduct[]): Promise<CatalogProduct[]> => {
    const modelIds = [...new Set(products.map((product) => product.model_id).filter(Boolean))];
    if (modelIds.length === 0) return products.map((product) => ({ ...product, images: [], image_url: null }));

    try {
        const [galleryRows, colors] = await Promise.all([
            modelColorImagesService.getByModelIds(modelIds),
            colorService.list(),
        ]);
        const colorIdByName = new Map(colors.map((color) => [color.name.trim().toLowerCase(), color.id]));

        return products.map((product) => {
            const colorName = String(product.specs?.color || product.specs?.cor || '').trim().toLowerCase();
            const colorId = colorIdByName.get(colorName);
            const galleryEntry = colorId
                ? galleryRows.find((row) => row.model_id === product.model_id && row.color_id === colorId)
                : undefined;
            const galleryImages = (galleryEntry?.images || [])
                .map((value) => toBrowserSafeMediaUrl(value))
                .filter((value) => hasRenderableMediaUrl(value));

            return {
                ...product,
                images: galleryImages,
                image_url: galleryImages[0] || null,
            };
        });
    } catch (error) {
        console.warn('[Marketing] Não foi possível carregar a galeria oficial de modelo/cor.', error);
        return products.map((product) => ({ ...product, images: [], image_url: null }));
    }
};

const MARKETING_PRIMARY_VARIANTS_KEY = 'marketing_primary_variants';

const readMarketingPrimaryVariants = (): Record<string, string> => {
    try {
        return JSON.parse(localStorage.getItem(MARKETING_PRIMARY_VARIANTS_KEY) || '{}');
    } catch {
        return {};
    }
};

const getGroupProducts = (group: ProductGroup): CatalogProduct[] =>
    group.variants.flatMap((variant) => variant.products);

type MarketingVariantOption = {
    key: string;
    group: ProductGroup;
    variant: ProductVariant;
    representativeProduct: CatalogProduct;
};

const chooseMarketingPrimaryProduct = (group: ProductGroup): CatalogProduct => {
    const products = getGroupProducts(group);
    const savedId = readMarketingPrimaryVariants()[group.groupKey];
    const saved = products.find((product) => product.id === savedId);
    if (saved) return saved;

    return [...products].sort((a, b) => {
        const mediaScore = (product: CatalogProduct) => getRenderableProductImages(product).length > 0 ? 10000 : 0;
        const stockScore = (product: CatalogProduct) => product.track_inventory ? Number(product.stock_quantity || 0) : 1;
        return (mediaScore(b) + stockScore(b)) - (mediaScore(a) + stockScore(a));
    })[0] || group.representativeProduct;
};

const chooseMarketingVariantProduct = (group: ProductGroup, variant: ProductVariant): CatalogProduct => {
    const savedId = readMarketingPrimaryVariants()[group.groupKey];
    const saved = variant.products.find((product) => product.id === savedId);
    if (saved) return saved;

    return [...variant.products].sort((a, b) => {
        const artworkScore = (product: CatalogProduct) => product.marketing_background_url ? 20000 : 0;
        const mediaScore = (product: CatalogProduct) => getRenderableProductImages(product).length > 0 ? 10000 : 0;
        const stockScore = (product: CatalogProduct) => product.track_inventory ? Number(product.stock_quantity || 0) : 1;
        return (artworkScore(b) + mediaScore(b) + stockScore(b)) - (artworkScore(a) + mediaScore(a) + stockScore(a));
    })[0] || group.representativeProduct;
};

const buildMarketingVariantOptions = (groups: ProductGroup[]): MarketingVariantOption[] =>
    groups.flatMap((group) => group.variants.map((variant) => ({
        key: `${group.groupKey}:${variant.ram}:${variant.storage}`,
        group,
        variant,
        representativeProduct: chooseMarketingVariantProduct(group, variant),
    })));

const loadAllMarketingProducts = async ({
    search,
    categoryId,
    includeOutOfStock = false,
}: {
    search?: string;
    categoryId?: string;
    includeOutOfStock?: boolean;
}) => {
    const pageSize = 200;
    const productsById = new Map<string, CatalogProduct>();

    for (let page = 1; page <= 20; page += 1) {
        const result = await catalogService.getProducts({
            search: search || undefined,
            categories: categoryId ? [categoryId] : undefined,
            inStockOnly: !includeOutOfStock,
        }, page, pageSize);
        result.products.forEach((product) => {
            if (product.id) productsById.set(product.id, product);
        });
        if (!result.hasMore || productsById.size >= result.total) break;
    }

    return Array.from(productsById.values());
};

const saveMarketingPrimaryProduct = (groupKey: string, productId: string) => {
    const saved = readMarketingPrimaryVariants();
    localStorage.setItem(MARKETING_PRIMARY_VARIANTS_KEY, JSON.stringify({ ...saved, [groupKey]: productId }));
};

const waitForPreviewAssets = async (
    node: HTMLElement,
    expectedProductImageUrl?: string | null,
): Promise<void> => {
    if ('fonts' in document) {
        try {
            await document.fonts.ready;
        } catch {
            // Ignora falhas de fonte e segue para as imagens.
        }
    }

    await waitForNextFrame();
    await waitForNextFrame();
    await waitForMarketingProductImage(node, expectedProductImageUrl);

    const images = Array.from(node.querySelectorAll('img'));
    await Promise.all(images.map((img) => new Promise<void>((resolve) => {
        if (img.complete) {
            resolve();
            return;
        }

        let timeoutId: number | undefined;
        const finish = () => {
            img.removeEventListener('load', finish);
            img.removeEventListener('error', finish);
            if (timeoutId !== undefined) window.clearTimeout(timeoutId);
            resolve();
        };

        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', finish, { once: true });
        timeoutId = window.setTimeout(finish, 5000);
    })));

    await waitForNextFrame();
};

const buildMarketingDownloadName = (
    productName?: string | null,
    slideNumber: number = 1,
    totalSlides: number = 1,
): string => {
    const baseName = productName
        ? productName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase()
        : 'marketing';

    const slideSuffix = totalSlides > 1 ? `-slide-${slideNumber}` : '';
    return `oferta-${baseName || 'marketing'}${slideSuffix}.png`;
};

const triggerImageDownload = (href: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = href;
    link.click();
};

type MarketingArtworkUploadResponse = {
    uploadId?: string;
    status?: string;
    url?: string;
    error?: string | null;
    message?: string | null;
};

const waitForMarketingArtworkUpload = async (uploadId: string): Promise<MarketingArtworkUploadResponse> => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        const status = await vpsClient.get<MarketingArtworkUploadResponse>(
            `/synology/upload-status?id=${encodeURIComponent(uploadId)}`,
        );
        if (status.status === 'success') return status;
        if (status.status === 'error') {
            throw new Error(status.error || status.message || 'Falha ao salvar a arte no armazenamento');
        }
        await new Promise((resolve) => window.setTimeout(resolve, 750));
    }
    throw new Error('O armazenamento não confirmou a arte do Status dentro do prazo');
};

const saveMarketingArtworkForWhatsappStatus = async (
    product: CatalogProduct,
    pngDataUrl: string,
    showPrice: boolean = true,
): Promise<string> => {
    if (!product.id) throw new Error('Produto sem identificador para vincular a arte');

    const imageResponse = await fetch(pngDataUrl);
    const imageBlob = await imageResponse.blob();
    const fileKey = String(product.sku || product.id)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || product.id;
    const filePrefix = showPrice ? 'status' : 'status-sem-preco';
    const targetField = showPrice ? 'marketing_background_url' : 'marketing_background_no_price_url';
    const file = new File([imageBlob], `${filePrefix}-${fileKey}.png`, { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', file);

    const queued = await vpsClient.upload<MarketingArtworkUploadResponse>(
        '/synology/upload?folder=imagens',
        formData,
    );
    const completed = queued.uploadId
        ? await waitForMarketingArtworkUpload(queued.uploadId)
        : queued;
    const publicUrl = String(completed.url || queued.url || '').trim();
    if (!publicUrl) throw new Error('O armazenamento não retornou a URL pública da arte');

    const versionedUrl = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
    await vpsClient.patch(
        `/table-data/products/${encodeURIComponent(product.id)}?pk=id`,
        { [targetField]: versionedUrl },
    );
    return versionedUrl;
};

const buildSha256 = async (value: unknown): Promise<string | undefined> => {
    if (!globalThis.crypto?.subtle) return undefined;
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const saveProductBlueprintForModel = async (
    group: ProductGroup,
    pngDataUrl: string,
    imageUrls: string[],
): Promise<string> => {
    const blueprint = buildProductBlueprintArtworkData(group);
    if (!blueprint.modelId) throw new Error('Modelo sem identificador para vincular o blueprint');
    const sourceHash = await buildSha256(buildProductBlueprintSourcePayload(blueprint, imageUrls));

    const imageResponse = await fetch(pngDataUrl);
    const imageBlob = await imageResponse.blob();
    const fileKey = blueprint.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || blueprint.modelId;
    const hashSuffix = sourceHash ? `-${sourceHash.slice(0, 12)}` : '';
    const file = new File([imageBlob], `blueprint-${fileKey}${hashSuffix}.png`, { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', file);

    const queued = await vpsClient.upload<MarketingArtworkUploadResponse>(
        '/synology/upload?folder=imagens',
        formData,
    );
    const completed = queued.uploadId ? await waitForMarketingArtworkUpload(queued.uploadId) : queued;
    const publicUrl = String(completed.url || queued.url || '').trim();
    if (!publicUrl) throw new Error('O armazenamento não retornou a URL pública do blueprint');

    const versionedUrl = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${sourceHash?.slice(0, 12) || Date.now()}`;
    await vpsClient.patch(`/models/${encodeURIComponent(blueprint.modelId)}/blueprint`, {
        blueprint_image_url: versionedUrl,
        ...(sourceHash ? { blueprint_source_hash: sourceHash } : {}),
        blueprint_generated_at: new Date().toISOString(),
    });
    return versionedUrl;
};

export default function MarketingPage() {
    const { settings } = useTheme();
    const [selectedBg, setSelectedBg] = useState(BACKGROUND_OPTIONS[0]);
    const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const searchRequestRef = useRef(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const [companyInfo, setCompanyInfo] = useState<Company | null>(null);
    const [format, setFormat] = useState<MarketingAssetFormat>('status');
    const [showArtworkPrice, setShowArtworkPrice] = useState(true);
    const [marketingPaymentFees, setMarketingPaymentFees] = useState<PaymentFee[]>([]);
    const [stickerSettings, setStickerSettings] = useState<MarketingStickerSettings>(DEFAULT_MARKETING_STICKER_SETTINGS);
    const [activeTab, setActiveTab] = useState<'studio' | 'calendar' | 'instagram' | 'facebook' | 'whatsapp' | 'campaigns' | 'approvals'>(() => {
        if (typeof window === 'undefined') return 'studio';
        const tab = new URLSearchParams(window.location.search).get('tab');
        return ['studio', 'calendar', 'instagram', 'facebook', 'whatsapp', 'campaigns', 'approvals'].includes(tab || '')
            ? tab as 'studio' | 'calendar' | 'instagram' | 'facebook' | 'whatsapp' | 'campaigns' | 'approvals'
            : 'studio';
    });
    const [whatsappSchedulerView, setWhatsappSchedulerView] = useState<'status' | 'stories'>('status');
    const safeStickerSettings = sanitizeMarketingStickerSettings(stickerSettings);
    const isStickerFormat = format === 'sticker';
    const isBlueprintFormat = format === 'blueprint';
    const updateStickerSetting = <K extends keyof MarketingStickerSettings>(
        key: K,
        value: MarketingStickerSettings[K],
    ) => {
        setStickerSettings(prev => ({ ...prev, [key]: value }));
    };

    // Agenda Instagram
    const [scheduleSlots, setScheduleSlots] = useState<InstagramSlot[]>([]);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
    const [editingSlot, setEditingSlot] = useState<InstagramSlot | null>(null);
    const [showSlotForm, setShowSlotForm] = useState(false);
    const [slotForm, setSlotForm] = useState<Partial<InstagramSlot & { id?: string }>>({
        day_of_week: new Date().getDay(),
        scheduled_time: '09:00',
        content_type: 'story' as ContentType,
        hook: '',
        caption: '',
        cta: '',
        hashtags: '',
        visual_notes: '',
        send_telegram_reminder: true,
        active: true,
        sort_order: 0
    });
    const [dayRules, setDayRules] = useState<Record<number, MarketingDayRule>>(() =>
        readMarketingState('dayRules', DEFAULT_DAY_RULES)
    );
    const [categoryProfiles, setCategoryProfiles] = useState<MarketingCategoryProfileMap>(() =>
        readMarketingState('categoryProfiles', {})
    );
    const [manualPicksMap, setManualPicksMap] = useState<MarketingManualPickMap>(() =>
        readMarketingState('manualPicks', {})
    );
    const [cooldownCache, setCooldownCache] = useState<MarketingCooldownCache>(() =>
        readMarketingState('cooldown', {})
    );

    // Carregar dados reais da empresa (Telefone, Instagram, Watermark)
    const loadCompanyData = async () => {
        try {
            const data = await getCompanyData();
            setCompanyInfo(data);
        } catch (e) {
            console.error(e)
        }
    };

    useEffect(() => {
        loadCompanyData();
        paymentFeesService.list().then(setMarketingPaymentFees).catch(() => setMarketingPaymentFees([]));

        // Sempre que o usuário voltar pra aba ou janela, atualiza os dados
        const handleFocus = () => loadCompanyData();
        window.addEventListener('focus', handleFocus);

        // Também tenta escutar um custom event, caso disparemos do Settings salvar
        const handleSettingsUpdate = () => loadCompanyData();
        window.addEventListener('company_settings_updated', handleSettingsUpdate);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('company_settings_updated', handleSettingsUpdate);
        };
    }, []);

    // Carregar agenda
    const loadSchedule = async () => {
        setScheduleLoading(true);
        try {
            const data = await instagramScheduleService.list();
            setScheduleSlots(data);
        } catch {
            toast.error('Erro ao carregar agenda');
        } finally {
            setScheduleLoading(false);
        }
    };

    useEffect(() => { loadSchedule(); }, []);

    const handleToggleSlotActive = async (slot: InstagramSlot) => {
        try {
            await instagramScheduleService.toggleActive(slot.id, !slot.active);
            setScheduleSlots(prev => prev.map(s => s.id === slot.id ? { ...s, active: !s.active } : s));
        } catch { toast.error('Erro ao atualizar slot'); }
    };

    const handleDeleteSlot = async (id: string) => {
        if (!window.confirm('Excluir este slot?')) return;
        try {
            await instagramScheduleService.delete(id);
            setScheduleSlots(prev => prev.filter(s => s.id !== id));
            toast.success('Slot excluído!');
        } catch { toast.error('Erro ao excluir slot'); }
    };

    const handleOpenNewSlot = () => {
        setEditingSlot(null);
        setSlotForm({
            day_of_week: selectedDay,
            scheduled_time: '09:00',
            content_type: 'story' as ContentType,
            hook: '', caption: '', cta: '', hashtags: '', visual_notes: '',
            send_telegram_reminder: true, active: true, sort_order: scheduleSlots.filter(s => s.day_of_week === selectedDay).length
        });
        setShowSlotForm(true);
    };

    const handleOpenEditSlot = (slot: InstagramSlot) => {
        setEditingSlot(slot);
        const nl = (s: string | null | undefined) => (s || '').replace(/\\n/g, '\n');
        setSlotForm({ ...slot, scheduled_time: slot.scheduled_time?.slice(0, 5), hook: nl(slot.hook), caption: nl(slot.caption), cta: nl(slot.cta), visual_notes: nl(slot.visual_notes) });

        setShowSlotForm(true);
    };

    const handleSaveSlot = async () => {
        try {
            const payload: any = { ...slotForm };
            if (editingSlot) {
                const updated = await instagramScheduleService.update(editingSlot.id, payload);
                setScheduleSlots(prev => prev.map(s => s.id === editingSlot.id ? updated : s));
                toast.success('Slot atualizado!');
            } else {
                const created = await instagramScheduleService.create(payload);
                setScheduleSlots(prev => [...prev, created]);
                toast.success('Slot criado!');
            }
            setShowSlotForm(false);
            setEditingSlot(null);
        } catch { toast.error('Erro ao salvar slot'); }
    };

    // Produto Logic
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
    const [generatedCopy, setGeneratedCopy] = useState('');
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
    const [carouselSlideIndex, setCarouselSlideIndex] = useState(0);
    const [exportImageOverride, setExportImageOverride] = useState<string | null | undefined>(undefined);
    const selectedProductImages = getRenderableProductImages(selectedProduct);
    const carouselSlides = getMarketingExportSlides(selectedProductImages, format);
    const activeCarouselSlide = carouselSlides[Math.min(carouselSlideIndex, Math.max(carouselSlides.length - 1, 0))] ?? carouselSlides[0];
    const selectedProductImage = exportImageOverride !== undefined
        ? exportImageOverride
        : activeCarouselSlide?.imageUrl ?? null;
    const showCarouselPreview = carouselSlides.length > 1;
    const productArtworkData = useMemo(
        () => selectedProduct ? buildProductMarketingArtworkData(selectedProduct, marketingPaymentFees, companyInfo?.pixDiscountPercentage || 0) : null,
        [selectedProduct, marketingPaymentFees, companyInfo?.pixDiscountPercentage],
    );
    const artworkWhatsapp = normalizeBrazilianWhatsapp(companyInfo?.phone) || '(87) 98803-2612';
    const artworkWebsite = (companyInfo?.socialMedia?.website || 'mercadodovale.com.br')
        .replace(/^https?:\/\//i, '')
        .replace(/\/$/, '');

    const stageMarketingCanvasForExport = async (
        product: CatalogProduct | null,
        slideIndex: number,
        imageUrl: string | null,
    ) => {
        flushSync(() => {
            setSelectedProduct(product);
            setCarouselSlideIndex(slideIndex);
            setExportImageOverride(imageUrl);
        });
        await waitForNextFrame();
        await waitForNextFrame();
    };
    // Copywrighting Template Logic
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [captionTemplate, setCaptionTemplate] = useState('');

    useEffect(() => {
        setCarouselSlideIndex(0);
    }, [selectedProduct?.id, format]);

    useEffect(() => {
        if (carouselSlideIndex < carouselSlides.length) return;
        setCarouselSlideIndex(0);
    }, [carouselSlideIndex, carouselSlides.length]);

    useEffect(() => {
        const savedTemplate = localStorage.getItem('marketing_caption_template');
        if (savedTemplate) {
            setCaptionTemplate(savedTemplate);
        } else {
            setCaptionTemplate(`🔥 OPORTUNIDADE! Máquina em mãos! \n\nO {produto} acabou de chegar e está disponível no nosso catálogo! \n\n✨ Tecnologia de ponta com um design premium que você merece.\n\n🏃‍♂️ Garanta já o seu antes que o estoque acabe!\n\n🔗 Compre Direto no Site:\n{link}\n\n#{marca} #{hashtag} #Tecnologia #Ofertas`);
        }
    }, []);

    const saveTemplate = () => {
        localStorage.setItem('marketing_caption_template', captionTemplate);
        setIsEditingTemplate(false);
        toast.success('Modelo de legenda salvo com sucesso!');
    };

    // Category & Grouping Logic
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [groupedResults, setGroupedResults] = useState<ProductGroup[]>([]);
    const marketingVariantOptions = useMemo(
        () => buildMarketingVariantOptions(groupedResults),
        [groupedResults],
    );
    const marketingSelectionOptions = useMemo<MarketingVariantOption[]>(() => {
        if (!isBlueprintFormat) return marketingVariantOptions;
        return groupedResults.map((group) => ({
            key: `blueprint:${group.groupKey}`,
            group,
            variant: {
                ram: group.variants.map((variant) => variant.ram).filter(Boolean).join(', '),
                storage: group.variants.map((variant) => variant.storage).filter(Boolean).join(', '),
                colors: group.allColors,
                products: getGroupProducts(group),
                priceRange: group.globalPriceRange,
            },
            representativeProduct: chooseMarketingPrimaryProduct(group),
        }));
    }, [groupedResults, isBlueprintFormat, marketingVariantOptions]);
    const readyMarketingVariantCount = useMemo(
        () => marketingVariantOptions.filter(({ variant }) => variant.products.some((product) => Boolean(product.marketing_background_url || product.marketing_background_no_price_url))).length,
        [marketingVariantOptions],
    );
    const videoMarketingVariantCount = useMemo(
        () => marketingVariantOptions.filter(({ variant }) => variant.products.some((product) => Boolean(product.marketing_video_url || product.video_url))).length,
        [marketingVariantOptions],
    );
    const selectedProductGroup = useMemo(() => groupedResults.find((group) =>
        getGroupProducts(group).some((product) => product.id === selectedProduct?.id)
    ) || null, [groupedResults, selectedProduct?.id]);
    const productBlueprintData = useMemo(
        () => selectedProductGroup ? buildProductBlueprintArtworkData(selectedProductGroup) : null,
        [selectedProductGroup],
    );
    const selectedBlueprintImages = useMemo(() => {
        if (!selectedProductGroup) return [];
        return Array.from(new Set([
            selectedProductImage,
            ...getGroupProducts(selectedProductGroup)
                .flatMap((product) => getRenderableProductImages(product).slice(0, 1)),
        ].filter((value): value is string => Boolean(value))))
            .slice(0, 4);
    }, [selectedProductGroup, selectedProductImage]);
    const selectedPriceAnomaly = useMemo(() => {
        if (!selectedProduct || !selectedProductGroup) return null;
        const comparablePrices = getGroupProducts(selectedProductGroup)
            .map((product) => Number(product.price_retail || 0))
            .filter((price) => price > 0)
            .sort((left, right) => left - right);
        if (comparablePrices.length < 2) return null;
        const middle = Math.floor(comparablePrices.length / 2);
        const median = comparablePrices.length % 2
            ? comparablePrices[middle]
            : Math.round((comparablePrices[middle - 1] + comparablePrices[middle]) / 2);
        const selectedPrice = Number(selectedProduct.price_retail || 0);
        if (!median || selectedPrice <= median * 1.35) return null;
        return { selectedPrice, median };
    }, [selectedProduct, selectedProductGroup]);
    const selectedCategoryName = selectedProduct?.category_id
        ? categories.find((category) => category.id === selectedProduct.category_id)?.name ?? ''
        : '';
    const stickerTokenValues = {
        name: selectedProduct?.name || safeStickerSettings.stickerName,
        brand: selectedProduct?.brand || settings.company_name || 'Mercado do Vale',
        priceLabel: selectedProduct ? formatCurrency(selectedProduct.price_retail || 0) : '',
        sku: selectedProduct?.sku || '',
        color: typeof selectedProduct?.specs?.color === 'string' ? selectedProduct.specs.color : '',
        category: selectedCategoryName,
    };
    const stickerKickerText = resolveMarketingStickerText(safeStickerSettings.kickerText, stickerTokenValues);
    const stickerMainText = resolveMarketingStickerText(safeStickerSettings.mainText, stickerTokenValues);
    const stickerFooterText = resolveMarketingStickerText(safeStickerSettings.footerText, stickerTokenValues);
    const stickerPriceText = resolveMarketingStickerText(safeStickerSettings.priceText, stickerTokenValues);
    const stickerTypographyFields = safeStickerSettings.typography.fields;

    useEffect(() => {
        const loadedIds = new Set<string>();
        const fontsToLoad: typeof safeStickerSettings.typography.fonts = [];

        safeStickerSettings.typography.fonts.forEach((font) => {
            if (loadedIds.has(font.id)) return;
            loadedIds.add(font.id);
            fontsToLoad.push(font);
        });

        const pushFont = (fontId: string) => {
            const font = findMarketingTypographyFontOption(fontId, safeStickerSettings.typography.fonts);
            if (!font || loadedIds.has(font.id)) return;

            loadedIds.add(font.id);
            fontsToLoad.push(font);
        };

        Object.values(stickerTypographyFields).forEach((field) => {
            pushFont(field.simpleStyle.fontId);
            field.segments.forEach((segment) => pushFont(segment.style.fontId));
        });

        fontsToLoad.forEach((font) => {
            ensureMarketingTypographyFontLoaded(font).catch(() => {
                // Segue com a fonte fallback se alguma fonte externa falhar.
            });
        });
    }, [safeStickerSettings.typography.fonts, stickerTypographyFields]);

    useEffect(() => {
        catalogService.getCategoriesWithNames().then(setCategories);
    }, []);


    // Gera a Copy Mágica sempre que o produto, template ou empresa mudar
    useEffect(() => {
        if (!selectedProduct || !captionTemplate) {
            setGeneratedCopy('');
            return;
        }

        const precoBaseCents = productArtworkData?.price || selectedProduct.price_retail || 0;
        const parcelas = formatCurrency(productArtworkData?.installmentValue || Math.floor(precoBaseCents / 12));
        const vista = formatCurrency(precoBaseCents);
        const nomeEmpresa = settings.company_name || 'Mercado do Vale';

        let whatsEmpresa = '(11) 99999-9999';
        if (companyInfo?.phone) {
            whatsEmpresa = companyInfo.phone;
        }

        let insta = nomeEmpresa.replace(/\s+/g, '');
        if (companyInfo?.socialMedia?.instagram) {
            const rawInsta = companyInfo.socialMedia.instagram;
            const match = rawInsta.match(/(?:instagram\.com\/|@)([a-zA-Z0-9_\.]+)/);
            if (match && match[1]) {
                insta = match[1];
            } else {
                insta = rawInsta.replace(/[^a-zA-Z0-9_\.]/g, '');
            }
        }

        const marcaTag = selectedProduct.brand ? selectedProduct.brand.replace(/\s+/g, '') : 'Smartphone';
        const hashtagTag = selectedProduct.name.split(' ').slice(0, 2).join('').replace(/[^a-zA-Z0-9]/g, '');
        const productLink = `${window.location.origin}/?search=${encodeURIComponent(selectedProduct.name)}`;

        const catName = categories.find(c => c.id === selectedProduct.category_id)?.name || 'Eletro';
        const specsRam = productArtworkData?.specs.find((spec) => spec.key === 'ram')?.value || '';
        const specsStorage = productArtworkData?.specs.find((spec) => spec.key === 'storage')?.value || '';
        const specsBattery = productArtworkData?.specs.find((spec) => spec.key === 'battery')?.value || '';
        const specsProcessor = productArtworkData?.specs.find((spec) => spec.key === 'processor')?.value || '';

        // Remove as tags HTML que vêm do rich-text da descrição original do aparelho
        const rawDesc = selectedProduct.description || 'Descrição completa no nosso site!';
        const descriptionTxt = rawDesc.replace(/<[^>]*>?/gm, '').trim();

        let finalCopy = captionTemplate
            .replace(/{produto}/g, selectedProduct.name)
            .replace(/{marca}/g, marcaTag)
            .replace(/{categoria}/g, catName)
            .replace(/{preco_vista}/g, vista)
            .replace(/{preco_parcelado}/g, parcelas)
            .replace(/{link}/g, productLink)
            .replace(/{whatsapp}/g, whatsEmpresa)
            .replace(/{instagram}/g, insta)
            .replace(/{hashtag}/g, hashtagTag)
            .replace(/{ram}/g, specsRam)
            .replace(/{armazenamento}/g, specsStorage)
            .replace(/{bateria}/g, specsBattery)
            .replace(/{processador}/g, specsProcessor)
            .replace(/{descricao}/g, descriptionTxt);

        setGeneratedCopy(finalCopy);
    }, [selectedProduct, productArtworkData, settings, companyInfo, captionTemplate, categories]);

    // Debounced Search & Category Fetch
    useEffect(() => {
        if ((!searchQuery || searchQuery.length < 2) && !selectedCategory) {
            searchRequestRef.current += 1;
            setIsSearching(false);
            setGroupedResults([]);
            return;
        }
        const requestId = ++searchRequestRef.current;
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const products = await loadAllMarketingProducts({
                    search: searchQuery || undefined,
                    categoryId: selectedCategory || undefined,
                    includeOutOfStock: isBlueprintFormat,
                });

                // Agrupa cores, mas preserva cada combinacao de RAM/armazenamento.
                const preparedProducts = await prepareMarketingProducts(products);
                if (requestId !== searchRequestRef.current) return;

                const grouped = groupProductsByVariants(preparedProducts).map((group) => ({
                    ...group,
                    representativeProduct: chooseMarketingPrimaryProduct(group),
                }));
                setGroupedResults(grouped);
                setSelectedProduct((current) => {
                    if (!current) return current;
                    return preparedProducts.find((product) => product.id === current.id) ?? current;
                });
                setBulkSelectedIds(new Set());
            } catch (err) {
                console.error(err);
            } finally {
                if (requestId === searchRequestRef.current) {
                    setIsSearching(false);
                }
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, selectedCategory, isBlueprintFormat]);

    useEffect(() => {
        writeMarketingState('dayRules', dayRules, {
            fallback: DEFAULT_DAY_RULES,
        });
    }, [dayRules]);

    useEffect(() => {
        writeMarketingState('categoryProfiles', categoryProfiles, {
            fallback: {},
        });
    }, [categoryProfiles]);

    useEffect(() => {
        writeMarketingState('manualPicks', manualPicksMap, {
            fallback: {},
        });
    }, [manualPicksMap]);

    const persistedCooldownCache = useMemo(
        () => pruneMarketingCooldownCache(cooldownCache, categoryProfiles),
        [categoryProfiles, cooldownCache],
    );

    useEffect(() => {
        writeMarketingState('cooldown', persistedCooldownCache, {
            fallback: {},
        });
    }, [persistedCooldownCache]);

    const todayDayIndex = new Date().getDay();
    const currentDayRule = dayRules[todayDayIndex] ?? DEFAULT_DAY_RULES[todayDayIndex];
    const activeEditorialCategoryId = selectedCategory || currentDayRule.categoryId || selectedProduct?.category_id || '';
    const activeCategoryProfile: MarketingCategoryProfile = useMemo(() => ({
        ...DEFAULT_CATEGORY_PROFILE,
        categoryId: activeEditorialCategoryId,
        ...(activeEditorialCategoryId ? categoryProfiles[activeEditorialCategoryId] ?? {} : {}),
    }), [activeEditorialCategoryId, categoryProfiles]);
    const activeManualPicks = activeEditorialCategoryId ? manualPicksMap[activeEditorialCategoryId] ?? [] : [];
    const candidatePool = useMemo(() => {
        const map = new Map<string, CatalogProduct>();
        marketingVariantOptions.forEach((option) => {
            const product = option.representativeProduct;
            if (product?.id) map.set(product.id, product);
        });

        if (selectedProduct?.id) {
            map.set(selectedProduct.id, selectedProduct);
        }

        return Array.from(map.values());
    }, [marketingVariantOptions, selectedProduct]);
    const cooldownProductIds = useMemo(() => {
        const now = Date.now();
        const limit = activeCategoryProfile.cooldownDays * 86_400_000;

        return Object.entries(persistedCooldownCache)
            .filter(([, iso]) => {
                const timestamp = new Date(iso).getTime();
                return Number.isFinite(timestamp) && now - timestamp < limit;
            })
            .map(([productId]) => productId);
    }, [activeCategoryProfile.cooldownDays, persistedCooldownCache]);
    const editorialSelection = useMemo(() => pickEditorialCandidates({
        products: candidatePool,
        dayRule: {
            mode: currentDayRule.mode,
            categoryId: activeEditorialCategoryId,
        },
        manualPicks: activeManualPicks,
        cooldownProductIds,
        nowIso: new Date().toISOString(),
    }), [activeEditorialCategoryId, activeManualPicks, candidatePool, cooldownProductIds, currentDayRule.mode]);
    const studioPrimaryProduct = selectedProduct ?? editorialSelection.primary;
    const studioReserveProducts = useMemo(() => {
        const currentPrimaryId = studioPrimaryProduct?.id;
        return editorialSelection.reserves.filter((product) => product.id !== currentPrimaryId).slice(0, 2);
    }, [editorialSelection.reserves, studioPrimaryProduct]);
    const editorialCategoryLabel = activeEditorialCategoryId
        ? categories.find((category) => category.id === activeEditorialCategoryId)?.name ?? 'Categoria em foco'
        : 'Categoria livre';
    const companyWhatsapp = (companyInfo as any)?.phone || (companyInfo as any)?.whatsapp || '';
    const companyInstagram = (companyInfo as any)?.socialMedia?.instagram || (companyInfo as any)?.instagram || settings.company_name || 'mercadodovale';
    const currentCreativeLabel = isStickerFormat ? 'Figurinha' : showCarouselPreview ? 'Carrossel' : format === 'status' ? 'Story' : 'Feed';
    const marketingKit = useMemo(() => buildTelegramDraft({
        categoryLabel: editorialCategoryLabel,
        dayTheme: currentDayRule.label,
        selection: {
            primary: studioPrimaryProduct,
            reserves: studioReserveProducts,
        },
        company: {
            whatsapp: companyWhatsapp,
            instagram: companyInstagram,
        },
        primaryFormat: format,
        cta: activeCategoryProfile.defaultCta,
        generatedCopy,
    }), [
        activeCategoryProfile.defaultCta,
        companyInstagram,
        companyWhatsapp,
        currentDayRule.label,
        editorialCategoryLabel,
        format,
        generatedCopy,
        studioPrimaryProduct,
        studioReserveProducts,
    ]);
    const kitStatusLabel = studioPrimaryProduct ? 'Pronto para postagem' : 'Aguardando curadoria';

    useEffect(() => {
        if (!studioPrimaryProduct) return;
        writeMarketingState('lastKit', {
            productId: studioPrimaryProduct.id,
            generatedAt: new Date().toISOString(),
            format,
            summary: marketingKit.summary,
            caption: marketingKit.caption,
            cta: marketingKit.cta,
            hashtags: marketingKit.hashtags,
        });
    }, [format, marketingKit.caption, marketingKit.cta, marketingKit.hashtags, marketingKit.summary, studioPrimaryProduct]);

    useEffect(() => {
        if (selectedProduct || !editorialSelection.primary) return;
        setSelectedProduct(editorialSelection.primary);
    }, [editorialSelection.primary, selectedProduct]);

    const handleCopyKitValue = (label: string, value: string) => {
        if (!value?.trim()) {
            toast.error(`Nada para copiar em ${label.toLowerCase()}.`);
            return;
        }

        navigator.clipboard.writeText(value);
        toast.success(`${label} copiado com sucesso!`);
    };

    const ensureEditorialCategory = (product?: CatalogProduct | null) => {
        const resolvedCategoryId = activeEditorialCategoryId || product?.category_id || '';
        if (!resolvedCategoryId) return '';

        if (!selectedCategory && product?.category_id) {
            setSelectedCategory(product.category_id);
        }

        setDayRules((prev) => ({
            ...prev,
            [todayDayIndex]: {
                ...(prev[todayDayIndex] ?? DEFAULT_DAY_RULES[todayDayIndex]),
                categoryId: resolvedCategoryId,
            },
        }));

        return resolvedCategoryId;
    };

    const updateCategoryProfile = (patch: Partial<MarketingCategoryProfile>) => {
        const categoryId = patch.categoryId || activeEditorialCategoryId;
        if (!categoryId) return;

        setCategoryProfiles((prev) => ({
            ...prev,
            [categoryId]: {
                ...DEFAULT_CATEGORY_PROFILE,
                categoryId,
                ...(prev[categoryId] ?? {}),
                ...patch,
            },
        }));
    };

    const handleSetManualPrimary = (product?: CatalogProduct | null) => {
        if (!product) {
            toast.error('Selecione um produto para definir como principal.');
            return;
        }

        const categoryId = ensureEditorialCategory(product);
        if (!categoryId) {
            toast.error('Defina uma categoria foco antes de marcar picks manuais.');
            return;
        }

        setManualPicksMap((prev) => {
            const existing = (prev[categoryId] ?? []).filter((pick) => pick.productId !== product.id);
            return {
                ...prev,
                [categoryId]: [
                    { productId: product.id, priority: 1 },
                    ...existing.map((pick, index) => ({ ...pick, priority: index + 2 })),
                ].slice(0, 3),
            };
        });
        toast.success('Produto marcado como principal do dia.');
    };

    const handleAddManualReserve = (product?: CatalogProduct | null) => {
        if (!product) {
            toast.error('Selecione um produto para adicionar como reserva.');
            return;
        }

        const categoryId = ensureEditorialCategory(product);
        if (!categoryId) {
            toast.error('Defina uma categoria foco antes de montar reservas.');
            return;
        }

        setManualPicksMap((prev) => {
            const existing = prev[categoryId] ?? [];
            if (existing.some((pick) => pick.productId === product.id)) {
                return prev;
            }

            return {
                ...prev,
                [categoryId]: [...existing, { productId: product.id, priority: existing.length + 1 }].slice(0, 3),
            };
        });
        toast.success('Produto adicionado como reserva.');
    };

    const handleClearManualPicks = () => {
        if (!activeEditorialCategoryId) {
            toast.error('Nao ha categoria foco para limpar.');
            return;
        }

        setManualPicksMap((prev) => {
            const next = { ...prev };
            delete next[activeEditorialCategoryId];
            return next;
        });
        toast.success('Picks manuais limpos para a categoria atual.');
    };

    const recordCooldownForProduct = (product?: CatalogProduct | null) => {
        if (!product?.id) return;
        setCooldownCache((prev) => ({
            ...prev,
            [product.id]: new Date().toISOString(),
        }));
    };

    const handleCreateSlotFromKit = () => {
        if (!studioPrimaryProduct) {
            toast.error('Selecione ou confirme um produto principal antes de criar o slot.');
            return;
        }

        const slotType: ContentType = showCarouselPreview
            ? 'carrossel'
            : format === 'status' || isStickerFormat
                ? 'story'
                : 'post';

        setSelectedDay(todayDayIndex);
        setEditingSlot(null);
        setSlotForm({
            day_of_week: todayDayIndex,
            scheduled_time: '09:00',
            content_type: slotType,
            hook: marketingKit.summary.split('\n')[1]?.replace('Principal: ', '') || studioPrimaryProduct.name,
            caption: marketingKit.caption,
            cta: marketingKit.cta,
            hashtags: marketingKit.hashtags,
            visual_notes: `${currentCreativeLabel} com fundo ${customBgUrl ? 'customizado' : selectedBg.label.toLowerCase()}.`,
            send_telegram_reminder: true,
            active: true,
            sort_order: scheduleSlots.filter((slot) => slot.day_of_week === todayDayIndex).length,
        });
        setShowSlotForm(true);
        setActiveTab('instagram');
        recordCooldownForProduct(studioPrimaryProduct);
    };

    const exportCurrentCanvasPng = async (expectedProductImageUrl?: string | null) => {
        if (!canvasRef.current) {
            throw new Error('Canvas indisponivel para exportacao');
        }

        const expectedImageForCanvas = isStickerFormat && !safeStickerSettings.showProduct
            ? null
            : expectedProductImageUrl;
        await waitForPreviewAssets(canvasRef.current, expectedImageForCanvas);
        const { width, height } = getMarketingCanvasSize(format);

        return toPng(canvasRef.current, {
            cacheBust: true,
            pixelRatio: 1,
            quality: 1.0,
            canvasWidth: width,
            canvasHeight: height,
            ...(isStickerFormat ? { backgroundColor: safeStickerSettings.backgroundColor } : {}),
            fetchRequestInit: {
                cache: 'no-cache',
            }
        });
    };

    const exportCurrentCanvasWebp = async (expectedProductImageUrl?: string | null) => {
        if (!canvasRef.current) {
            throw new Error('Canvas indisponivel para exportacao');
        }

        const expectedImageForCanvas = isStickerFormat && !safeStickerSettings.showProduct
            ? null
            : expectedProductImageUrl;
        await waitForPreviewAssets(canvasRef.current, expectedImageForCanvas);
        const { width, height } = getMarketingCanvasSize(format);

        const blob = await toBlob(canvasRef.current, {
            cacheBust: true,
            pixelRatio: 1,
            quality: 0.9,
            canvasWidth: width,
            canvasHeight: height,
            type: 'image/webp',
            ...(isStickerFormat ? { backgroundColor: safeStickerSettings.backgroundColor } : {}),
            fetchRequestInit: {
                cache: 'no-cache',
            }
        });

        if (!blob) {
            throw new Error('Nao foi possivel gerar WEBP');
        }

        return URL.createObjectURL(blob);
    };

    const downloadStickerFile = async (
        mode: MarketingStickerExportMode,
        expectedProductImageUrl: string | null,
        baseName: string,
        slideNumber: number = 1,
        totalSlides: number = 1,
    ) => {
        const stickerName = totalSlides > 1 ? `${baseName} slide ${slideNumber}` : baseName;
        const [target] = getMarketingStickerExportTargets(mode, stickerName);

        if (target.extension === 'png') {
            const pngDataUrl = await exportCurrentCanvasPng(expectedProductImageUrl);
            triggerImageDownload(pngDataUrl, target.filename);
            return;
        }

        const webpUrl = await exportCurrentCanvasWebp(expectedProductImageUrl);
        triggerImageDownload(webpUrl, target.filename);
        window.setTimeout(() => URL.revokeObjectURL(webpUrl), 1000);
    };

    // Export to Image Logic
    const handleDownload = async (stickerExportMode?: MarketingStickerExportMode) => {
        if (!canvasRef.current) return;
        if (!isBlueprintFormat && selectedProduct && selectedProductImages.length === 0) {
            toast.error('Cadastre uma foto para este modelo e esta cor na galeria antes de gerar a arte.');
            return;
        }
        if (!isStickerFormat && !isBlueprintFormat && showArtworkPrice && selectedPriceAnomaly) {
            toast.error('Confira e corrija o preço deste SKU antes de gerar a arte.');
            return;
        }

        const previousSlideIndex = carouselSlideIndex;
        const currentStickerExportMode = stickerExportMode ?? 'png';

        try {
            setIsGenerating(true);
            const slidesToExport = getMarketingExportSlides(selectedProductImages, format);

            for (const slide of slidesToExport) {
                await stageMarketingCanvasForExport(selectedProduct ?? null, slide.slideNumber - 1, slide.imageUrl);
                if (!canvasRef.current) break;

                if (isStickerFormat) {
                    await downloadStickerFile(
                        currentStickerExportMode,
                        slide.imageUrl,
                        safeStickerSettings.stickerName,
                        slide.slideNumber,
                        slide.totalSlides,
                    );
                } else {
                    const dataUrl = await exportCurrentCanvasPng(slide.imageUrl);
                    if (format === 'status' && selectedProduct && slide.slideNumber === 1) {
                        const savedUrl = await saveMarketingArtworkForWhatsappStatus(selectedProduct, dataUrl, showArtworkPrice);
                        setSelectedProduct((current) => current?.id === selectedProduct.id
                            ? {
                                ...current,
                                [showArtworkPrice ? 'marketing_background_url' : 'marketing_background_no_price_url']: savedUrl,
                            }
                            : current);
                    }
                    if (format === 'blueprint' && selectedProductGroup && slide.slideNumber === 1) {
                        await saveProductBlueprintForModel(selectedProductGroup, dataUrl, selectedBlueprintImages);
                    }
                    triggerImageDownload(
                        dataUrl,
                        buildMarketingDownloadName(selectedProduct?.name, slide.slideNumber, slide.totalSlides),
                    );
                }

                await new Promise(resolve => window.setTimeout(resolve, 180));
            }

            toast.success(
                isStickerFormat
                    ? `Figurinha ${currentStickerExportMode.toUpperCase()} gerada com sucesso! ${slidesToExport.length} arquivo(s) baixado(s).`
                    : format === 'blueprint' && selectedProductGroup
                    ? 'Blueprint baixado, salvo no modelo e disponibilizado para o site e o bot!'
                    : format === 'status' && selectedProduct
                    ? (showArtworkPrice
                        ? 'Arte baixada e salva automaticamente como foto de marketing do Status!'
                        : 'Arte sem preço baixada e salva automaticamente como foto de marketing do Status!')
                    : slidesToExport.length > 1
                    ? `Carrossel gerado com sucesso! ${slidesToExport.length} slides baixados.`
                    : 'Arte gerada e baixada com sucesso!'
            );
            recordCooldownForProduct(selectedProduct ?? studioPrimaryProduct);
        } catch (err) {
            console.error('Falha ao gerar imagem', err);
            toast.error(err instanceof Error ? err.message : 'Ocorreu um erro ao gerar a arte, tente novamente.');
        } finally {
            flushSync(() => {
                setCarouselSlideIndex(previousSlideIndex);
                setExportImageOverride(undefined);
            });
            setIsGenerating(false);
        }
    };
    const handleBulkDownload = async (stickerExportMode?: MarketingStickerExportMode) => {
        if (!canvasRef.current || bulkSelectedIds.size === 0) return;
        const currentStickerExportMode = stickerExportMode ?? 'png';

        const productsToGenerate = marketingSelectionOptions
            .map((option) => option.representativeProduct)
            .filter(p => bulkSelectedIds.has(p.id));

        if (productsToGenerate.length === 0) return;
        const productsWithoutGalleryImage = productsToGenerate.filter((product) => getRenderableProductImages(product).length === 0);
        if (!isBlueprintFormat && productsWithoutGalleryImage.length > 0) {
            toast.error(`${productsWithoutGalleryImage.length} produto(s) não têm foto na galeria para o modelo e a cor selecionados.`);
            return;
        }

        const slidesToGenerate = getMarketingBulkExportSlides(
            productsToGenerate,
            getRenderableProductImages,
            format,
        );
        const totalSlides = slidesToGenerate.length;

        setIsGeneratingBulk(true);
        setBulkProgress({ current: 0, total: totalSlides });

        // Salva o produto que estava no palco para não perder a referência do usuário
        const productOnStage = selectedProduct;
        const slideOnStage = carouselSlideIndex;
        try {
            let completedSlides = 0;

            for (const slide of slidesToGenerate) {
                await stageMarketingCanvasForExport(slide.product, slide.slideNumber - 1, slide.imageUrl);
                if (!canvasRef.current) break;

                if (isStickerFormat) {
                    await downloadStickerFile(
                        currentStickerExportMode,
                        slide.imageUrl,
                        `${safeStickerSettings.stickerName} ${slide.product.name}`,
                        slide.slideNumber,
                        slide.totalSlides,
                    );
                    completedSlides += 1;
                } else {
                    const dataUrl = await exportCurrentCanvasPng(slide.imageUrl);
                    if (format === 'status' && slide.slideNumber === 1) {
                        await saveMarketingArtworkForWhatsappStatus(slide.product, dataUrl, showArtworkPrice);
                    }
                    if (format === 'blueprint' && slide.slideNumber === 1) {
                        const blueprintGroup = groupedResults.find((group) => getGroupProducts(group)
                            .some((product) => product.id === slide.product.id));
                        if (!blueprintGroup) throw new Error(`Modelo não encontrado para ${slide.product.name}`);
                        const blueprintImages = Array.from(new Set(getGroupProducts(blueprintGroup)
                            .flatMap((product) => getRenderableProductImages(product).slice(0, 1))))
                            .slice(0, 4);
                        await saveProductBlueprintForModel(blueprintGroup, dataUrl, blueprintImages);
                    }
                    triggerImageDownload(
                        dataUrl,
                        buildMarketingDownloadName(slide.product.name, slide.slideNumber, slide.totalSlides),
                    );
                    completedSlides += 1;
                }

                setBulkProgress({ current: completedSlides, total: totalSlides });

                await new Promise(resolve => window.setTimeout(resolve, 180));
                if (!canvasRef.current) break;
            }

            toast.success(
                format === 'blueprint'
                    ? `Lote concluído: ${completedSlides} blueprint(s) salvos por modelo e disponibilizados no site.`
                    : format === 'status'
                    ? `Lote gerado: ${completedSlides} imagens baixadas e vinculadas automaticamente ao Status (${showArtworkPrice ? 'com preço' : 'sem preço'}).`
                    : `Lote gerado com sucesso! ${completedSlides} imagens baixadas.`,
            );
            setBulkSelectedIds(new Set());
            productsToGenerate.forEach((product) => recordCooldownForProduct(product));

        } catch (error) {
            console.error('Erro ao gerar lote:', error);
            toast.error(error instanceof Error ? error.message : 'Ocorreu um erro gerando o lote. Processo interrompido.');
        } finally {
            setIsGeneratingBulk(false);
            flushSync(() => {
                setSelectedProduct(productOnStage ?? null);
                setCarouselSlideIndex(slideOnStage);
                setExportImageOverride(undefined);
            });
        }
    };

    const handleCustomBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            toast.error('Por favor, envie apenas imagens (JPG, PNG).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
                setCustomBgUrl(event.target.result);
                toast.success('Fundo customizado aplicado!');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleClearCustomBg = () => {
        setCustomBgUrl(null);
    };

    const canvasSize = getMarketingCanvasSize(format);
    const previewFrameClass = isStickerFormat
        ? 'aspect-square w-[420px] rounded-[2rem] ring-4 ring-emerald-200 bg-slate-100'
        : isBlueprintFormat
            ? 'aspect-[3/2] w-[690px] rounded-xl ring-1 ring-slate-200'
        : format === 'feed'
            ? 'aspect-square w-[432px] rounded-xl ring-1 ring-slate-200'
            : 'aspect-[9/16] w-[324px] rounded-3xl ring-4 ring-slate-200';
    const previewScale = isStickerFormat ? 0.82 : isBlueprintFormat ? 0.449 : format === 'feed' ? 0.40 : 0.30;
    const canvasBackgroundStyle: React.CSSProperties = isStickerFormat
        ? customBgUrl
            ? {
                backgroundImage: `url(${customBgUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }
            : {
                background: safeStickerSettings.backgroundColor,
            }
        : customBgUrl
            ? {
                backgroundImage: `url(${customBgUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }
            : {};
    const stickerShapeRadius = {
        blob: '42% 58% 55% 45% / 50% 42% 58% 50%',
        circulo: '9999px',
        retangulo: '44px',
        'sem-forma': '0px',
    }[safeStickerSettings.shape];
    const stickerShapeStyle: React.CSSProperties = {
        background: safeStickerSettings.shape === 'sem-forma' ? 'transparent' : safeStickerSettings.accentColor,
        borderRadius: stickerShapeRadius,
        boxShadow: safeStickerSettings.shape === 'sem-forma' ? 'none' : '0 24px 48px rgba(15, 23, 42, 0.22)',
    };
    const stickerIsProductHeavy = safeStickerSettings.layout === 'produto' || safeStickerSettings.layout === 'produto-preco';
    const stickerMainFontSize = stickerMainText.length > 58
        ? '2.15rem'
        : stickerMainText.length > 38
            ? '2.65rem'
            : safeStickerSettings.layout === 'selo'
                ? '4.1rem'
                : '3.35rem';
    const checkerboardBackground: React.CSSProperties = {
        backgroundColor: '#f8fafc',
        backgroundImage: 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
        backgroundSize: '20px 20px',
    };
    const renderStickerArtwork = (markProductImage: boolean = true) => (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-7">
            <div
                className={`relative flex h-full w-full flex-col items-center justify-center text-center ${safeStickerSettings.layout === 'texto-livre' ? 'gap-4 p-8' : 'gap-3 p-7'}`}
                style={stickerShapeStyle}
            >
                {safeStickerSettings.showLogo && (
                    <div className="absolute left-7 top-7 z-20 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white/95 p-2 shadow-lg">
                        {(companyInfo?.watermarkLogoUrl || settings.logo_url) ? (
                            <img
                                src={companyInfo?.watermarkLogoUrl || settings.logo_url}
                                crossOrigin="anonymous"
                                alt="Logo"
                                className="h-full w-full object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                        ) : (
                            <span className="text-[10px] font-black uppercase leading-none text-slate-800">
                                {settings.company_name || 'MV'}
                            </span>
                        )}
                    </div>
                )}

                {safeStickerSettings.showKicker && stickerKickerText && (
                    <div
                        className="max-w-[78%] rounded-full bg-white/90 px-4 py-1.5 text-sm font-black text-slate-900 shadow-md"
                    >
                        <MarketingTypographyText
                            field={stickerTypographyFields.kicker}
                            tokens={stickerTokenValues}
                            fallbackText={stickerKickerText}
                        />
                    </div>
                )}

                {safeStickerSettings.showProduct && selectedProductImage && stickerIsProductHeavy && (
                    <div className={`${safeStickerSettings.layout === 'produto' ? 'h-[220px] w-[300px]' : 'h-[165px] w-[245px]'} flex items-center justify-center rounded-[2rem] bg-white/95 p-4 shadow-xl`}>
                        <img
                            key={`${selectedProduct?.id ?? 'figurinha'}-${selectedProductImage}`}
                            {...(markProductImage ? { 'data-marketing-product-image': 'true' } : {})}
                            src={selectedProductImage}
                            crossOrigin="anonymous"
                            alt={selectedProduct?.name || 'Produto'}
                            className="h-full w-full object-contain object-center"
                        />
                    </div>
                )}

                <h2
                    className="mx-auto max-w-[86%] break-words font-black leading-[0.98] tracking-[-0.02em]"
                    style={{ fontSize: stickerMainFontSize }}
                >
                    <MarketingTypographyText
                        field={stickerTypographyFields.main}
                        tokens={stickerTokenValues}
                        fallbackText={stickerMainText || safeStickerSettings.stickerName}
                    />
                </h2>

                {safeStickerSettings.showProduct && selectedProductImage && !stickerIsProductHeavy && (
                    <div className="flex h-[118px] w-[180px] items-center justify-center rounded-[1.5rem] bg-white/95 p-3 shadow-lg">
                        <img
                            key={`${selectedProduct?.id ?? 'figurinha'}-${selectedProductImage}`}
                            {...(markProductImage ? { 'data-marketing-product-image': 'true' } : {})}
                            src={selectedProductImage}
                            crossOrigin="anonymous"
                            alt={selectedProduct?.name || 'Produto'}
                            className="h-full w-full object-contain object-center"
                        />
                    </div>
                )}

                {safeStickerSettings.showPrice && stickerPriceText && (
                    <div
                        className="rounded-[1.25rem] px-6 py-2.5 text-[2.35rem] font-black leading-none shadow-lg"
                        style={{
                            background: 'rgba(255,255,255,0.95)',
                        }}
                    >
                        <MarketingTypographyText
                            field={stickerTypographyFields.price}
                            tokens={stickerTokenValues}
                            fallbackText={stickerPriceText}
                        />
                    </div>
                )}

                {safeStickerSettings.showFooter && stickerFooterText && (
                    <div
                        className="max-w-[86%] rounded-full bg-white/85 px-4 py-1.5 text-base font-black shadow-md"
                    >
                        <MarketingTypographyText
                            field={stickerTypographyFields.footer}
                            tokens={stickerTokenValues}
                            fallbackText={stickerFooterText}
                        />
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
            {/* Cabeçalho */}
            <div className="mb-6">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-pink-50 p-3">
                        <Sparkles className="w-6 h-6 text-pink-600" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-pink-500">Marketing e divulgação</p>
                        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Gerador de Artes</h1>
                        <p className="mt-2 text-sm text-slate-500">
                            Escolha um produto, confira a arte automática e baixe pronta para publicar.
                        </p>
                    </div>
                </div>

                <div className="mt-6 grid w-full grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm md:grid-cols-4 xl:grid-cols-7">
                    <button
                        onClick={() => setActiveTab('studio')}
                        className={`col-span-2 rounded-xl px-4 py-3 text-sm font-black transition-colors md:col-span-1 ${
                            activeTab === 'studio'
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" /> Gerador de Artes</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                            activeTab === 'calendar'
                                ? 'bg-pink-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-pink-50 hover:text-pink-700'
                        }`}
                    >
                        <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4" /> Calendário</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('instagram')}
                        className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                            activeTab === 'instagram'
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <span className="inline-flex items-center gap-2"><Instagram className="h-4 w-4" /> Agenda Instagram</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('facebook')}
                        className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                            activeTab === 'facebook'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                    >
                        <span className="inline-flex items-center gap-2"><Facebook className="h-4 w-4" /> Marketplace</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('whatsapp')}
                        className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                            activeTab === 'whatsapp'
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                    >
                        <span className="inline-flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Status WhatsApp</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('campaigns')}
                        className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                            activeTab === 'campaigns'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                        }`}
                    >
                        <span className="inline-flex items-center gap-2"><BrainCircuit className="h-4 w-4" /> Campanhas IA</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('approvals')}
                        className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                            activeTab === 'approvals'
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                    >
                        <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Aprovações</span>
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {activeTab === 'studio' && (
                    <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Crie sua arte em 3 passos</p>
                                <p className="mt-1 text-sm text-slate-600">Foto, especificações, recursos e valores vêm automaticamente do cadastro.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                {[
                                    ['1', 'Busque o aparelho'],
                                    ['2', 'Escolha Story ou Feed'],
                                    ['3', 'Confira e baixe'],
                                ].map(([step, label]) => (
                                    <div key={step} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{step}</span>
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'instagram' && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-pink-500">Agenda do Instagram</p>
                            <h2 className="mt-2 text-lg font-black text-slate-900">{DAY_LABELS_FULL[selectedDay] ?? 'Dia selecionado'}</h2>
                            <p className="mt-1 text-sm text-slate-500">{scheduleSlots.filter((slot) => slot.day_of_week === selectedDay).length} slot(s) no dia</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">Semana</p>
                            <h2 className="mt-2 text-lg font-black text-slate-900">{scheduleSlots.length} slot(s) cadastrados</h2>
                            <p className="mt-1 text-sm text-slate-500">{scheduleSlots.filter((slot) => slot.active).length} ativos no fluxo</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-500">Studio conectado</p>
                            <h2 className="mt-2 text-lg font-black text-slate-900">{studioPrimaryProduct ? 'Pronto para virar slot' : 'Aguardando kit'}</h2>
                            <p className="mt-1 text-sm text-slate-500">{studioPrimaryProduct?.name || 'Use o studio para empurrar um slot pronto.'}</p>
                        </div>
                    </div>
                )}

                    {activeTab === 'studio' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Toolbar */}
                            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg border border-slate-200">
                                    <button
                                        onClick={() => setFormat('feed')}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${format === 'feed' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Feed (1:1)
                                    </button>
                                    <button
                                        onClick={() => setFormat('status')}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${format === 'status' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Status (9:16)
                                    </button>
                                    <button
                                        onClick={() => setFormat('sticker')}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${format === 'sticker' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Figurinha
                                    </button>
                                    <button
                                        onClick={() => setFormat('blueprint')}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${format === 'blueprint' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Blueprint
                                    </button>
                                </div>

                                {isStickerFormat ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDownload('png')}
                                            disabled={isGenerating}
                                            className="bg-pink-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-700 transition-colors disabled:opacity-50"
                                        >
                                            <Download className="w-5 h-5" />
                                            {isGenerating ? 'Gerando...' : 'Baixar PNG'}
                                        </button>
                                        <button
                                            onClick={() => handleDownload('webp')}
                                            disabled={isGenerating}
                                            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                        >
                                            <Download className="w-5 h-5" />
                                            {isGenerating ? 'Gerando...' : 'Baixar WEBP'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        {format === 'status' && showArtworkPrice && (
                                            <span className="hidden max-w-[190px] text-right text-[11px] font-bold leading-4 text-emerald-700 xl:block">
                                                Ao baixar, a arte também será salva no produto para o Status.
                                            </span>
                                        )}
                                        {!isBlueprintFormat && <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1">
                                            <button type="button" onClick={() => setShowArtworkPrice(true)} className={`rounded-md px-3 py-1.5 text-xs font-black ${showArtworkPrice ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>COM PREÇO</button>
                                            <button type="button" onClick={() => setShowArtworkPrice(false)} className={`rounded-md px-3 py-1.5 text-xs font-black ${!showArtworkPrice ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>META SEM PREÇO</button>
                                        </div>}
                                        <button
                                            onClick={() => handleDownload()}
                                            disabled={isGenerating || (!selectedProduct && !customBgUrl) || Boolean(!isBlueprintFormat && selectedProduct && selectedProductImages.length === 0)}
                                            className="bg-pink-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-700 transition-colors disabled:opacity-50"
                                        >
                                            <Download className="w-5 h-5" />
                                            {isGenerating ? 'Gerando...' : showCarouselPreview ? 'Baixar Carrossel' : 'Baixar Arte'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                                {/* LADO ESQUERDO: Controles (4 Colunas) */}
                                <div className="lg:col-span-4 space-y-6">

                                    {/* Bloco 1: Seleção de Fundo */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                        <h2 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800">
                                            <Layers className="w-4 h-4 text-pink-500" />
                                            1. Fundo da Arte
                                        </h2>

                                        <div className="space-y-4">
                                            {/* Option A: Cores/Gradientes Padrão */}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Fundos Catálogo</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {BACKGROUND_OPTIONS.map(bg => (
                                                        <button
                                                            key={bg.id}
                                                            onClick={() => {
                                                                setSelectedBg(bg);
                                                                handleClearCustomBg(); // Se clicou numa cor limpa o bg customizado
                                                            }}
                                                            className={`h-12 rounded-lg border-2 transition-all ${bg.class} ${(!customBgUrl && selectedBg.id === bg.id)
                                                                ? 'border-pink-500 ring-2 ring-pink-500/20 scale-105 shadow-md'
                                                                : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100'
                                                                }`}
                                                            title={bg.label}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Option B: Fundo Customizado (Lifestyle) */}
                                            <div className="pt-2">
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Ou Fundo Personalizado (Lifestyle)</label>
                                                {customBgUrl ? (
                                                    <div className="relative h-24 rounded-lg overflow-hidden group border border-slate-200">
                                                        <img src={customBgUrl} alt="Background" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button
                                                                onClick={handleClearCustomBg}
                                                                className="text-white text-xs font-bold bg-red-500 px-3 py-1 rounded shadow"
                                                            >
                                                                Remover
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-pink-400 transition-colors">
                                                        <Upload className="w-6 h-6 text-slate-400 mb-2" />
                                                        <span className="text-xs font-semibold text-slate-600">Fazer Upload (Foto de Fundo)</span>
                                                        <span className="text-[10px] text-slate-400 text-center mt-1">Dica: Selecione uma foto real segurando o aparelho ou no cenário da loja.</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={handleCustomBgUpload}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bloco 2: Seleção de Produto */}
                                    {isStickerFormat && (
                                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                            <h2 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800">
                                                <Sparkles className="w-4 h-4 text-emerald-500" />
                                                Figurinha flexivel
                                            </h2>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Nome do arquivo</label>
                                                    <input
                                                        type="text"
                                                        value={stickerSettings.stickerName}
                                                        onChange={(e) => updateStickerSetting('stickerName', e.target.value)}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                        placeholder="Ex: Oferta caneta touch"
                                                    />
                                                </div>

                                                <MarketingStickerTypographyEditor
                                                    settings={stickerSettings}
                                                    onChange={setStickerSettings}
                                                />

                                                <p className="text-[11px] text-slate-500 leading-relaxed flex flex-wrap gap-1.5 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    <span className="font-bold mr-1 w-full text-slate-700">Tags para texto:</span>
                                                    <TagBadge tag="{produto}" colorClass="text-emerald-600" />
                                                    <TagBadge tag="{marca}" colorClass="text-emerald-600" />
                                                    <TagBadge tag="{preco}" colorClass="text-emerald-600" />
                                                    <TagBadge tag="{sku}" colorClass="text-emerald-600" />
                                                    <TagBadge tag="{cor}" colorClass="text-emerald-600" />
                                                    <TagBadge tag="{categoria}" colorClass="text-emerald-600" />
                                                </p>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Layout</label>
                                                        <select
                                                            value={stickerSettings.layout}
                                                            onChange={(e) => updateStickerSetting('layout', e.target.value as MarketingStickerSettings['layout'])}
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-emerald-500"
                                                        >
                                                            <option value="produto-preco">Produto + preco</option>
                                                            <option value="selo">Selo chamativo</option>
                                                            <option value="texto-livre">Texto livre</option>
                                                            <option value="produto">Produto destaque</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Forma</label>
                                                        <select
                                                            value={stickerSettings.shape}
                                                            onChange={(e) => updateStickerSetting('shape', e.target.value as MarketingStickerSettings['shape'])}
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-emerald-500"
                                                        >
                                                            <option value="blob">Adesivo organico</option>
                                                            <option value="circulo">Circulo</option>
                                                            <option value="retangulo">Retangulo</option>
                                                            <option value="sem-forma">Sem forma</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Cor da forma</span>
                                                    <input
                                                        type="color"
                                                        value={safeStickerSettings.accentColor}
                                                        onChange={(e) => updateStickerSetting('accentColor', e.target.value)}
                                                        className="h-8 w-10 rounded border border-slate-200 bg-white cursor-pointer"
                                                    />
                                                </label>

                                                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                                                    <label className="flex items-center justify-between gap-3">
                                                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Fundo transparente</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={safeStickerSettings.backgroundColor === 'transparent'}
                                                            onChange={(e) => updateStickerSetting('backgroundColor', e.target.checked ? 'transparent' : '#ffffff')}
                                                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                                        />
                                                    </label>
                                                    <label className="flex items-center justify-between gap-3">
                                                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Cor do fundo</span>
                                                        <input
                                                            type="color"
                                                            value={safeStickerSettings.backgroundColor === 'transparent' ? '#ffffff' : safeStickerSettings.backgroundColor}
                                                            onChange={(e) => updateStickerSetting('backgroundColor', e.target.value)}
                                                            className="h-8 w-10 rounded border border-slate-200 bg-white cursor-pointer"
                                                        />
                                                    </label>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                                                    {[
                                                        ['showKicker', 'Mostrar topo'],
                                                        ['showProduct', 'Mostrar produto'],
                                                        ['showPrice', 'Mostrar preco'],
                                                        ['showFooter', 'Mostrar rodape'],
                                                        ['showLogo', 'Mostrar logo'],
                                                        ['showOutline', 'Contorno texto'],
                                                    ].map(([key, label]) => (
                                                        <label key={key} className="flex items-center gap-2 text-xs font-semibold text-slate-600 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={Boolean(stickerSettings[key as keyof MarketingStickerSettings])}
                                                                onChange={(e) => updateStickerSetting(key as keyof MarketingStickerSettings, e.target.checked as never)}
                                                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                                            />
                                                            {label}
                                                        </label>
                                                    ))}
                                                </div>

                                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                                                    <div className="mb-3 flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Preview WEBP</p>
                                                            <p className="text-[11px] font-semibold text-slate-500">Atualiza em tempo real</p>
                                                        </div>
                                                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm">
                                                            512x512
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="relative mx-auto h-[220px] w-[220px] overflow-hidden rounded-2xl border border-slate-200 shadow-inner"
                                                        style={checkerboardBackground}
                                                    >
                                                        <div
                                                            className="absolute left-1/2 top-1/2 h-[512px] w-[512px] origin-center"
                                                            style={{
                                                                ...canvasBackgroundStyle,
                                                                transform: 'translate(-50%, -50%) scale(0.43)',
                                                            }}
                                                        >
                                                            {renderStickerArtwork(false)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                        <h2 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800">
                                            <Smartphone className="w-4 h-4 text-blue-500" />
                                            2. Aparelho e Seleção em Lote
                                        </h2>

                                        <div className="space-y-3">
                                            {/* Seleção do Produto Principal (Preview) */}
                                            {selectedProduct && (
                                                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 relative group mb-4">
                                                    <button
                                                        onClick={() => setSelectedProduct(null)}
                                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600 transition-colors z-10"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                    <div className="flex items-center gap-3">
                                                        {selectedProductImage ? (
                                                            <div className="w-12 h-12 bg-white rounded shadow-sm flex items-center justify-center p-1">
                                                                <img src={selectedProductImage} crossOrigin="anonymous" alt={selectedProduct.name} className="max-w-full max-h-full rounded-md object-contain object-center" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center"><Smartphone className="w-5 h-5 text-slate-400" /></div>
                                                        )}
                                                        <div>
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Produto no Palco (Preview)</p>
                                                            <p className="text-sm font-bold text-slate-800 line-clamp-1">{selectedProduct.name}</p>
                                                            <p className="text-[10px] font-semibold text-slate-500">SKU {selectedProduct.sku}</p>
                                                            <p className="text-xs font-bold text-green-600">
                                                                R$ {formatCurrency(selectedProduct.price_retail || 0)}
                                                            </p>
                                                            {showCarouselPreview && (
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600 mt-1">
                                                                    Slide {activeCarouselSlide?.slideNumber ?? 1} de {activeCarouselSlide?.totalSlides ?? 1}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {selectedPriceAnomaly && (
                                                        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                                                            <strong className="block font-black uppercase">Confira o preço antes de baixar</strong>
                                                            Este SKU está em {formatCurrency(selectedPriceAnomaly.selectedPrice)}, enquanto o valor mediano das demais variantes do modelo é {formatCurrency(selectedPriceAnomaly.median)}. A arte mostra exatamente o cadastro atual.
                                                        </div>
                                                    )}
                                                    {!selectedProductImage && (
                                                        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs leading-relaxed text-red-800">
                                                            <strong className="block font-black uppercase">Foto não cadastrada na galeria</strong>
                                                            Cadastre a imagem para este modelo e esta cor. O gerador não usará a foto de outro aparelho ou de outra cor.
                                                        </div>
                                                    )}
                                                    {selectedProductGroup && getGroupProducts(selectedProductGroup).length > 1 && (
                                                        <div className="mt-3 border-t border-slate-200 pt-3">
                                                            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Foto/variante principal da arte</label>
                                                            <select
                                                                value={selectedProduct.id}
                                                                onChange={(event) => {
                                                                    const product = getGroupProducts(selectedProductGroup).find((item) => item.id === event.target.value);
                                                                    if (!product) return;
                                                                    saveMarketingPrimaryProduct(selectedProductGroup.groupKey, product.id);
                                                                    setSelectedProduct(product);
                                                                    toast.success('Variante principal salva para este modelo');
                                                                }}
                                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                                                            >
                                                                {getGroupProducts(selectedProductGroup).map((product) => {
                                                                    const ram = product.specs?.ram || '';
                                                                    const storage = product.specs?.storage || '';
                                                                    const color = product.specs?.color || product.specs?.cor || 'Cor não informada';
                                                                    const stock = product.track_inventory ? `${product.stock_quantity || 0} em estoque` : 'estoque livre';
                                                                    const photo = getRenderableProductImages(product).length ? 'com foto' : 'sem foto';
                                                                    return <option key={product.id} value={product.id}>{[ram, storage, color, stock, photo].filter(Boolean).join(' · ')}</option>;
                                                                })}
                                                            </select>
                                                            <p className="mt-1 text-[10px] leading-snug text-slate-500">A escolha fica salva por modelo e tem prioridade sobre a seleção automática.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {isBlueprintFormat && productBlueprintData && (
                                                <div className={`rounded-lg border p-3 ${productBlueprintData.missingFields.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                                                    <div className="flex items-center gap-2 text-xs font-black uppercase">
                                                        {productBlueprintData.missingFields.length ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                                                        <span>{productBlueprintData.missingFields.length ? 'Checklist incompleto' : 'Blueprint pronto'}</span>
                                                    </div>
                                                    <p className="mt-1 text-[11px] leading-snug text-slate-600">
                                                        {productBlueprintData.missingFields.length
                                                            ? `Faltando no cadastro: ${productBlueprintData.missingFields.join(', ')}. Os blocos vazios serão omitidos; nenhum dado será inventado.`
                                                            : 'Foto, tela, processador, câmera, bateria, memória, cores e marca d’água estão prontos para exportação.'}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Busca e Lista */}
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar ou filtrar..."
                                                        value={searchQuery}
                                                        onChange={e => setSearchQuery(e.target.value)}
                                                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                                                    />
                                                    {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />}
                                                </div>
                                                <select
                                                    value={selectedCategory}
                                                    onChange={e => setSelectedCategory(e.target.value)}
                                                    className="py-2 px-3 border border-slate-200 rounded-lg text-sm outline-none bg-white text-slate-700 w-1/3 truncate"
                                                >
                                                    <option value="">Todas</option>
                                                    {categories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                    ))}
                                                </select>
                                                {isBlueprintFormat && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const phoneCategory = categories.find((category) => /celular|smartphone/i.test(category.name));
                                                            if (!phoneCategory) {
                                                                toast.error('Categoria de celulares não encontrada. Selecione-a manualmente.');
                                                                return;
                                                            }
                                                            setSearchQuery('');
                                                            setSelectedCategory(phoneCategory.id);
                                                        }}
                                                        className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-black text-white hover:bg-slate-800"
                                                        title="Carregar todos os celulares ativos cadastrados para gerar um blueprint por modelo"
                                                    >
                                                        Todos celulares
                                                    </button>
                                                )}
                                            </div>

                                            {/* Botao de Lote e Lista de Selecionaveis */}
                                            {marketingSelectionOptions.length > 0 && (
                                                <>
                                                    <div className="flex justify-between items-end px-1 mt-2">
                                                        <div className="text-xs font-semibold text-slate-500">
                                                            <span>{marketingSelectionOptions.length} {isBlueprintFormat ? 'modelos listados' : 'versões listadas'}</span>
                                                            {!isBlueprintFormat && <span className="ml-2 text-emerald-700">{readyMarketingVariantCount} com arte</span>}
                                                            {!isBlueprintFormat && <span className="ml-2 text-blue-700">{videoMarketingVariantCount} com vídeo</span>}
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                if (bulkSelectedIds.size === marketingSelectionOptions.length) {
                                                                    setBulkSelectedIds(new Set());
                                                                } else {
                                                                    setBulkSelectedIds(new Set(marketingSelectionOptions.map((option) => option.representativeProduct.id)));
                                                                }
                                                            }}
                                                            className="text-[11px] font-bold text-purple-600 hover:text-purple-700 hover:underline"
                                                        >
                                                            {bulkSelectedIds.size === marketingSelectionOptions.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                                        </button>
                                                    </div>

                                                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[220px] overflow-y-auto bg-white shadow-inner">
                                                        {marketingSelectionOptions.map(({ key, group, variant, representativeProduct: p }) => {
                                                            const groupPreviewImage = getRenderableProductImages(p)[0] ?? null;
                                                            const isSelectedPreview = selectedProduct?.id === p.id;
                                                            const isChecked = bulkSelectedIds.has(p.id);
                                                            const hasArtwork = variant.products.some((product) => Boolean(product.marketing_background_url || product.marketing_background_no_price_url));
                                                            const hasVideo = variant.products.some((product) => Boolean(product.marketing_video_url || product.video_url));
                                                            return (
                                                                <div
                                                                    key={key}
                                                                    className={`w-full flex items-center gap-3 p-2 transition-colors ${isSelectedPreview ? 'bg-purple-50' : 'hover:bg-slate-50'}`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={(e) => {
                                                                            const newSet = new Set(bulkSelectedIds);
                                                                            if (e.target.checked) newSet.add(p.id);
                                                                            else newSet.delete(p.id);
                                                                            setBulkSelectedIds(newSet);
                                                                        }}
                                                                        className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer ml-1"
                                                                    />
                                                                    <div
                                                                        onClick={() => setSelectedProduct(p)}
                                                                        className="flex-1 flex items-center gap-3 text-left cursor-pointer"
                                                                        title="Clique para enviar este modelo para o Palco de Preview"
                                                                    >
                                                                        {groupPreviewImage ? (
                                                                            <img src={groupPreviewImage} crossOrigin="anonymous" alt={group.model} className="h-8 w-8 rounded-md object-contain object-center" />
                                                                        ) : (
                                                                            <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center"><Smartphone className="w-4 h-4 text-slate-400" /></div>
                                                                        )}
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={`text-xs font-bold truncate flex items-center gap-2 ${isSelectedPreview ? 'text-purple-700' : 'text-slate-800'}`}>
                                                                                <span className="truncate">{group.model}</span>
                                                                                {!isBlueprintFormat && variant.ram && variant.storage && (
                                                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                                                        {variant.ram}/{variant.storage}
                                                                                    </span>
                                                                                )}
                                                                            </p>
                                                                            <p className="text-[10px] text-slate-500 flex flex-wrap gap-x-2">
                                                                                {isBlueprintFormat ? (
                                                                                    <span>{group.variants.length} configuração(ões) • {group.allColors.length} cor(es)</span>
                                                                                ) : (
                                                                                    <>
                                                                                        <span>{variant.priceRange.min !== variant.priceRange.max ? `A partir de R$ ${formatCurrency(variant.priceRange.min || 0)}` : `R$ ${formatCurrency(p.price_retail || 0)}`}</span>
                                                                                        <span className={hasArtwork ? 'text-emerald-700' : 'text-amber-700'}>{hasArtwork ? 'Arte pronta' : 'Sem arte'}</span>
                                                                                        <span className={hasVideo ? 'text-blue-700' : 'text-slate-400'}>{hasVideo ? 'Vídeo cadastrado' : 'Sem vídeo'}</span>
                                                                                    </>
                                                                                )}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </>
                                            )}

                                            {bulkSelectedIds.size > 0 && (
                                                isStickerFormat ? (
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        <button
                                                            onClick={() => handleBulkDownload('png')}
                                                            disabled={isGeneratingBulk}
                                                            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
                                                        >
                                                            <Layers className="w-4 h-4" />
                                                            {isGeneratingBulk ? `Lote... (${bulkProgress.current}/${bulkProgress.total})` : `Lote PNG`}
                                                        </button>
                                                        <button
                                                            onClick={() => handleBulkDownload('webp')}
                                                            disabled={isGeneratingBulk}
                                                            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
                                                        >
                                                            <Layers className="w-4 h-4" />
                                                            {isGeneratingBulk ? `Lote... (${bulkProgress.current}/${bulkProgress.total})` : `Lote WEBP`}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleBulkDownload()}
                                                        disabled={isGeneratingBulk}
                                                        className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-bold rounded-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
                                                    >
                                                        <Layers className="w-5 h-5" />
                                                        {isGeneratingBulk
                                                            ? `Gerando lote... (${bulkProgress.current}/${bulkProgress.total})`
                                                            : `Baixar os ${bulkSelectedIds.size} Selecionados`
                                                        }
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Bloco 3: Copywriting (Legenda) */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                                <PenTool className="w-4 h-4 text-purple-500" />
                                                3. Legenda Automática
                                            </h2>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (isEditingTemplate) saveTemplate();
                                                        else setIsEditingTemplate(true);
                                                    }}
                                                    className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${isEditingTemplate ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                >
                                                    {isEditingTemplate ? 'Salvar Modelo' : 'Editar Modelo'}
                                                </button>
                                                {generatedCopy && !isEditingTemplate && (
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(generatedCopy);
                                                            toast.success('Legenda copiada para a área de transferência!');
                                                        }}
                                                        className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors font-semibold"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" /> Copiar
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {isEditingTemplate ? (
                                            <div className="space-y-3">
                                                <p className="text-[11px] text-slate-500 leading-relaxed flex flex-wrap gap-1.5 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    <span className="font-bold mr-1 w-full text-slate-700">Tags Básicas:</span>
                                                    <TagBadge tag="{produto}" colorClass="text-pink-600" />
                                                    <TagBadge tag="{marca}" colorClass="text-pink-600" />
                                                    <TagBadge tag="{categoria}" colorClass="text-pink-600" />
                                                    <TagBadge tag="{preco_vista}" colorClass="text-pink-600" />
                                                    <TagBadge tag="{preco_parcelado}" colorClass="text-pink-600" />

                                                    <span className="font-bold mr-1 w-full mt-1 text-slate-700">Tags Técnicas:</span>
                                                    <TagBadge tag="{ram}" colorClass="text-indigo-600" />
                                                    <TagBadge tag="{armazenamento}" colorClass="text-indigo-600" />
                                                    <TagBadge tag="{bateria}" colorClass="text-indigo-600" />
                                                    <TagBadge tag="{processador}" colorClass="text-indigo-600" />
                                                    <TagBadge tag="{descricao}" colorClass="text-amber-600" />

                                                    <span className="font-bold mr-1 w-full mt-1 text-slate-700">Links:</span>
                                                    <TagBadge tag="{link}" colorClass="text-emerald-600" />
                                                </p>
                                                <textarea
                                                    value={captionTemplate}
                                                    onChange={(e) => setCaptionTemplate(e.target.value)}
                                                    className="w-full h-48 p-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none leading-relaxed"
                                                    placeholder="Escreva seu modelo com variáveis..."
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                {!selectedProduct ? (
                                                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                                                        <p className="text-xs text-slate-400">Selecione um produto para gerar uma legenda persuasiva e ver o resultado do seu modelo.</p>
                                                    </div>
                                                ) : (
                                                    <textarea
                                                        value={generatedCopy}
                                                        onChange={(e) => setGeneratedCopy(e.target.value)}
                                                        className="w-full h-48 p-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none resize-none leading-relaxed"
                                                    />
                                                )}
                                            </>
                                        )}
                                    </div>

                                </div>

                                {/* LADO DIREITO: O Palco (8 Colunas) */}
                                <div className="lg:col-span-8 lg:sticky lg:top-6 self-start">

                                    {/* O Palco Visível (A Janela Responsiva que esconde o que vaza do Zoom) */}
                                    <div className="flex max-h-[calc(100vh-2rem)] flex-col items-stretch justify-start rounded-[2rem] border border-slate-300 bg-slate-100/80 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-sm lg:h-[calc(100vh-2rem)]">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Palco flutuante</p>
                                                <p className="mt-1 text-sm font-medium text-slate-500">Acompanha a rolagem para ver as mudancas em tempo real</p>
                                            </div>
                                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 shadow-sm">
                                                {canvasSize.width}x{canvasSize.height}
                                            </span>
                                        </div>

                                        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-[1.75rem] border border-slate-200 bg-white/70 p-4">
                                            <div
                                        className={`relative shadow-2xl bg-white overflow-hidden transition-all duration-300 origin-top flex-shrink-0 flex items-center justify-center ${previewFrameClass}`}
                                    >

                                        {/* O Motor Real: Elemento GIGANTE e fixo em 1080x1080 ou 1080x1920 (Tamanho Nativo) */}
                                        {/* Usamos o ResizeObserver puro do CSS transform para caber no parente */}
                                        <div
                                            className="absolute top-0 left-0 origin-top-left"
                                            style={{
                                                width: `${canvasSize.width}px`,
                                                height: `${canvasSize.height}px`,
                                                transform: `scale(${previewScale})`,
                                            }}
                                        >
                                            <div
                                                ref={canvasRef}
                                                className={`${isStickerFormat ? 'w-[512px] h-[512px]' : isBlueprintFormat ? 'w-[1536px] h-[1024px] bg-[#050c12]' : `w-[1080px] ${format === 'feed' ? 'h-[1080px]' : 'h-[1920px]'} bg-white ${!customBgUrl ? selectedBg.class : ''}`} flex flex-col items-center justify-center relative`}
                                                style={canvasBackgroundStyle}
                                            >
                                                {/* Conteúdo Placeholder */}
                                                {!isStickerFormat && !selectedProduct && !customBgUrl && (
                                                    <div className="text-center space-y-8">
                                                        <ImageIcon className="w-48 h-48 mx-auto text-white/20" />
                                                        <h3 className="text-white/50 font-bold text-5xl tracking-widest uppercase">{settings.company_name || 'MERCADO DO VALE'}</h3>
                                                    </div>
                                                )}

                                                {!isStickerFormat && !selectedProduct && customBgUrl && (
                                                    <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center">
                                                        <h3 className="text-white font-bold text-5xl tracking-widest uppercase shadow-black/50 drop-shadow-lg">{settings.company_name || 'MERCADO DO VALE'}</h3>
                                                    </div>
                                                )}

                                                {isStickerFormat && renderStickerArtwork(true)}

                                                {!isStickerFormat && !isBlueprintFormat && selectedProduct && productArtworkData && (
                                                    <ProductMarketingCard
                                                        data={productArtworkData}
                                                        format={format}
                                                        imageUrl={selectedProductImage}
                                                        logoUrl={companyInfo?.watermarkLogoUrl || settings.logo_url}
                                                        whatsapp={artworkWhatsapp}
                                                        website={artworkWebsite}
                                                        showPrice={showArtworkPrice}
                                                        carouselLabel={showCarouselPreview ? `Slide ${activeCarouselSlide?.slideNumber ?? 1} de ${activeCarouselSlide?.totalSlides ?? 1}` : undefined}
                                                    />
                                                )}

                                                {isBlueprintFormat && selectedProduct && productBlueprintData && (
                                                    <ProductBlueprintCard
                                                        data={productBlueprintData}
                                                        imageUrls={selectedBlueprintImages}
                                                        watermarkUrl={companyInfo?.watermarkLogoUrl || settings.logo_url || '/brand/mercado-do-vale-logo.png'}
                                                    />
                                                )}

                                                {/* A ARTE RENDERIZADA AO VIVO (Tamanhos Grandes Oficiais em PX/REM) */}
                                                {false && !isStickerFormat && selectedProduct && (
                                                    <div className={`absolute inset-0 flex flex-col ${format === 'feed' ? 'p-12 lg:p-16' : 'p-16 lg:p-24 pt-32 pb-48'}`}>

                                                        {/* Módulo Superior: Imagem num Bloco Branco */}
                                                        <div className={`relative flex-1 ${format === 'status' ? 'rounded-[4rem]' : 'rounded-[4rem]'} mb-6 shadow-2xl flex items-center justify-center overflow-visible ${customBgUrl ? '' : 'bg-white'} ${format === 'feed' ? 'mt-[100px]' : ''}`}>

                                                            {/* Gatilho Flutuante removido à pedido */}

                                                            {showCarouselPreview && (
                                                                <>
                                                                    <div className="absolute inset-[8%] rounded-[3.75rem] border border-slate-200 bg-white/70 shadow-xl translate-x-10 -rotate-[4deg]" />
                                                                    <div className="absolute inset-[5%] rounded-[3.75rem] border border-slate-200 bg-white/85 shadow-2xl translate-x-5 -rotate-[2deg]" />
                                                                    <div className="absolute top-10 right-10 z-20 flex items-center gap-3 rounded-full bg-slate-900/90 px-6 py-3 text-white shadow-xl">
                                                                        <Layers className="w-7 h-7" />
                                                                        <span className="text-lg font-black uppercase tracking-[0.2em]">
                                                                            Slide {activeCarouselSlide?.slideNumber ?? 1} de {activeCarouselSlide?.totalSlides ?? 1}
                                                                        </span>
                                                                    </div>
                                                                </>
                                                            )}

                                                            {/* Imagem */}
                                                            {selectedProductImage && (
                                                                <div className="relative z-10 flex aspect-square w-[72%] items-center justify-center overflow-hidden rounded-[3rem] bg-white/95 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
                                                                    <img
                                                                        key={`${selectedProduct.id}-${selectedProductImage}`}
                                                                        data-marketing-product-image="true"
                                                                        src={selectedProductImage}
                                                                        crossOrigin="anonymous"
                                                                        alt="Aparelho"
                                                                        className="h-full w-full rounded-[2.25rem] object-contain object-center"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Logo Centralizada Entre os Módulos */}
                                                        <div className="relative z-30 flex justify-center items-center pointer-events-none" style={{ height: 0 }}>
                                                            <div className={`absolute bg-white rounded-full shadow-xl flex items-center justify-center p-5 border-[8px] border-slate-100 ${format === 'status' ? 'w-56 h-56 -top-36' : 'w-44 h-44 -top-28'}`} style={format === 'feed' ? { top: '-7rem' } : undefined}>
                                                                {(companyInfo?.watermarkLogoUrl || settings.logo_url) ? (
                                                                    <img
                                                                        src={companyInfo?.watermarkLogoUrl || settings.logo_url}
                                                                        crossOrigin="anonymous"
                                                                        alt="Logo Central"
                                                                        className="w-full h-full object-contain"
                                                                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                                                                    />
                                                                ) : (
                                                                    <span className={`font-black italic text-slate-800 uppercase text-center leading-tight ${format === 'status' ? 'text-3xl' : 'text-2xl'}`}>
                                                                        {settings.company_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Módulo Inferior: Textos e Preços num Bloco Branco Fixo na Base */}
                                                        <div className={`bg-white ${format === 'status' ? 'rounded-[4rem] px-16 pb-16 pt-24' : 'rounded-[3rem] px-10 pb-10 pt-16 mt-auto'} shadow-2xl relative shrink-0 overflow-hidden box-border ${format === 'feed' ? 'mb-[150px]' : ''}`}>
                                                            <h2 className={`${format === 'status' ? 'text-6xl text-center' : 'text-5xl text-center'} font-black text-slate-800 uppercase tracking-tight leading-tight flex flex-col items-center gap-3`}>
                                                                <span className="line-clamp-2">{selectedProduct.name}</span>
                                                                {selectedProduct.specs?.ram && selectedProduct.specs?.storage && (
                                                                    <span className={`${format === 'status' ? 'text-3xl' : 'text-2xl'} bg-slate-100 text-slate-600 px-4 py-2 rounded-2xl tracking-normal`}>
                                                                        {selectedProduct.specs.ram} / {selectedProduct.specs.storage}
                                                                    </span>
                                                                )}
                                                            </h2>

                                                            <div className="h-3 w-32 bg-pink-500 rounded-full my-8 mx-auto" />

                                                            {format === 'status' ? (
                                                                <div className="flex flex-col gap-4 relative z-10 items-center text-center">
                                                                    <div className="flex flex-col items-center">
                                                                        <p className="text-2xl border-b-[4px] border-green-200 pb-2 w-max font-bold text-green-700 mb-2">Por apenas:</p>
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className="text-[7.5rem] font-black text-green-600 tracking-tighter leading-none mt-2">
                                                                                {formatCurrency(selectedProduct.price_retail || 0)}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-2xl font-bold mt-4 text-slate-500 bg-slate-100 border-2 border-slate-200 px-6 py-3 rounded-xl inline-block">
                                                                            À vista (PIX)
                                                                        </p>
                                                                    </div>

                                                                    <div className="mt-6 text-3xl text-slate-500 font-bold border-t-2 border-slate-100 pt-6 w-full text-center">
                                                                        <span>Ou até 12x de </span>
                                                                        <span className="text-slate-800">{formatCurrency(Math.floor(((selectedProduct.price_retail || 0) * 1.15) / 12))}</span>
                                                                        <span> no cartão</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col gap-4 relative z-10 w-full">
                                                                    {/* Especificações Técnicas Estilo Catálogo */}
                                                                    <div className="grid grid-cols-2 gap-4 w-full">
                                                                        {selectedProduct.specs?.ram && (
                                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
                                                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Memória RAM</span>
                                                                                <span className="text-2xl font-black text-slate-800">{selectedProduct.specs.ram}</span>
                                                                            </div>
                                                                        )}
                                                                        {selectedProduct.specs?.storage && (
                                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
                                                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Armazenamento</span>
                                                                                <span className="text-2xl font-black text-slate-800">{selectedProduct.specs.storage}</span>
                                                                            </div>
                                                                        )}
                                                                        {selectedProduct.specs?.battery && (
                                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
                                                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Bateria</span>
                                                                                <span className="text-2xl font-black text-slate-800">{selectedProduct.specs.battery}</span>
                                                                            </div>
                                                                        )}
                                                                        {selectedProduct.specs?.processor && (
                                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
                                                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Processador</span>
                                                                                <span className="text-2xl font-black text-slate-800 truncate" title={selectedProduct.specs.processor}>{selectedProduct.specs.processor}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Etiqueta de disponibilidade em cores variadas se for agrupado */}
                                                                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 w-full flex items-center gap-3">
                                                                        <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
                                                                        <div className="flex flex-col">
                                                                            <span className="text-lg font-bold text-green-800 leading-tight">Catalogo Completo</span>
                                                                            <span className="text-sm text-green-700 leading-tight">Cores e Variações Detalhadas no Site</span>
                                                                        </div>
                                                                    </div>
                                                                    {showCarouselPreview && (
                                                                        <div className="flex items-center justify-center gap-3 pt-2">
                                                                            {carouselSlides.slice(0, 5).map((slide, index) => (
                                                                                <button
                                                                                    type="button"
                                                                                    key={`${selectedProduct?.id}-${index}-${slide.imageUrl ?? 'empty'}`}
                                                                                    onClick={() => setCarouselSlideIndex(index)}
                                                                                    className={`rounded-full transition-all ${index === carouselSlideIndex ? 'w-12 h-3 bg-slate-900' : 'w-3 h-3 bg-slate-300'}`}
                                                                                    aria-label={`Ir para slide ${slide.slideNumber}`}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </div>

                                        </div>
                                    <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-600">
                                        <Camera className="w-4 h-4" /> Arte pronta para exportacao ({canvasSize.width}x{canvasSize.height} escalonado)
                                    </p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                    {/* Canais separados: Instagram, Facebook e WhatsApp */}
                    {activeTab === 'studio' && (
                        <MarketingKitPanel
                            statusLabel={kitStatusLabel}
                            summary={marketingKit.summary}
                            instructions={marketingKit.instructions}
                            fields={[
                                { label: 'Legenda', value: marketingKit.caption },
                                { label: 'CTA', value: marketingKit.cta },
                                { label: 'Hashtags', value: marketingKit.hashtags },
                                { label: 'Legenda curta', value: marketingKit.shortCaption },
                            ]}
                            onCopy={handleCopyKitValue}
                            onCreateSlot={handleCreateSlotFromKit}
                        />
                    )}
                    {activeTab === 'whatsapp' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setWhatsappSchedulerView('status')}
                                        className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-black transition-colors ${whatsappSchedulerView === 'status'
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                            }`}
                                    >
                                        <MessageCircle className="h-4 w-4" /> Status automático
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWhatsappSchedulerView('stories')}
                                        className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-black transition-colors ${whatsappSchedulerView === 'stories'
                                            ? 'bg-violet-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                                            }`}
                                    >
                                        <CalendarClock className="h-4 w-4" /> Agendar Stories
                                    </button>
                                </div>
                                <p className="mt-2 px-1 text-xs text-slate-500">
                                    {whatsappSchedulerView === 'status'
                                        ? 'Programa produtos no Status do WhatsApp nos dias escolhidos.'
                                        : 'Escolha explicitamente WhatsApp, Instagram ou os dois para cada lote.'}
                                </p>
                            </div>
                            {whatsappSchedulerView === 'status'
                                ? <WhatsAppStatusCampaignPanel />
                                : <SocialStorySchedulerPanel defaultDestinations={['whatsapp']} />}
                        </div>
                    )}
                    {activeTab === 'facebook' && (
                        <div className="animate-in fade-in duration-300">
                            <FacebookMarketplaceSchedulerPanel
                                initialProduct={studioPrimaryProduct}
                                initialDescription={marketingKit.caption}
                            />
                        </div>
                    )}
                    {activeTab === 'calendar' && (
                        <MarketingCalendarPanel
                            onNavigateToTab={(t) => setActiveTab(t as any)}
                            onSelectDateForNewSchedule={() => setActiveTab('instagram')}
                        />
                    )}
                    {activeTab === 'campaigns' && <MarketingCampaignAgentPanel />}
                    {activeTab === 'approvals' && <MarketingApprovalCenterPanel />}
                    {activeTab === 'instagram' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <SocialStorySchedulerPanel defaultDestinations={['instagram']} />
                            {/* Day Selector */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                <div className="flex gap-1 overflow-x-auto pb-1">
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => {
                                        const count = scheduleSlots.filter(s => s.day_of_week === i && s.active).length;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedDay(i)}
                                                className={`flex flex-col items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all min-w-[60px] ${selectedDay === i
                                                    ? 'bg-pink-600 text-white shadow-md'
                                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                                    }`}
                                            >
                                                <span>{d}</span>
                                                {count > 0 && (
                                                    <span className={`text-[10px] mt-0.5 font-semibold ${selectedDay === i ? 'text-pink-100' : 'text-pink-500'}`}>
                                                        {count} post{count > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Slots do Dia + Botão Adicionar */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-pink-500" />
                                        {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][selectedDay]}
                                        <span className="text-sm font-normal text-slate-400">
                                            — {scheduleSlots.filter(s => s.day_of_week === selectedDay).length} slot(s)
                                        </span>
                                    </h2>
                                    <button
                                        onClick={handleOpenNewSlot}
                                        className="flex items-center gap-1.5 bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-pink-700 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" /> Adicionar Slot
                                    </button>
                                </div>

                                {scheduleLoading ? (
                                    <div className="p-8 text-center text-slate-400">Carregando...</div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {scheduleSlots
                                            .filter(s => s.day_of_week === selectedDay)
                                            .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                                            .map(slot => (
                                                <div key={slot.id} className={`p-4 transition-colors ${slot.active ? '' : 'opacity-50 bg-slate-50'}`}>
                                                    <div className="flex items-start gap-3">
                                                        {/* Toggle ativo */}
                                                        <button onClick={() => handleToggleSlotActive(slot)} className="mt-1 shrink-0" title={slot.active ? 'Desativar' : 'Ativar'}>
                                                            {slot.active
                                                                ? <ToggleRight className="w-6 h-6 text-green-500" />
                                                                : <ToggleLeft className="w-6 h-6 text-slate-300" />}
                                                        </button>

                                                        <div className="flex-1 min-w-0">
                                                            {/* Horário + tipo */}
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                                    <Clock className="w-3 h-3" />
                                                                    {slot.scheduled_time?.slice(0, 5)}
                                                                </span>
                                                                <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">
                                                                    {CONTENT_TYPE_LABELS[slot.content_type as ContentType]}
                                                                </span>
                                                                {slot.send_telegram_reminder && (
                                                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-semibold">📲 Telegram</span>
                                                                )}
                                                            </div>

                                                            {/* Hook */}
                                                            {slot.hook && (
                                                                <p className="text-sm font-semibold text-slate-800 mb-1">🎣 {slot.hook}</p>
                                                            )}

                                                            {/* Caption (truncada) */}
                                                            {slot.caption && (
                                                                <p className="text-xs text-slate-600 line-clamp-2 mb-1">{slot.caption}</p>
                                                            )}

                                                            {/* CTA */}
                                                            {slot.cta && (
                                                                <p className="text-xs text-emerald-700 font-medium">👉 {slot.cta}</p>
                                                            )}

                                                            {/* Hashtags */}
                                                            {slot.hashtags && (
                                                                <p className="text-[11px] text-blue-500 mt-1 truncate">{slot.hashtags}</p>
                                                            )}

                                                            {/* Notas visuais */}
                                                            {slot.visual_notes && (
                                                                <p className="text-[11px] text-amber-600 mt-1">🎨 {slot.visual_notes}</p>
                                                            )}
                                                        </div>

                                                        {/* Ações */}
                                                        <div className="flex gap-1 shrink-0">
                                                            <button
                                                                onClick={() => handleOpenEditSlot(slot)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                title="Editar"
                                                            >
                                                                <PenTool className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteSlot(slot.id)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                        {scheduleSlots.filter(s => s.day_of_week === selectedDay).length === 0 && (
                                            <div className="p-8 text-center">
                                                <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                                <p className="text-sm text-slate-400">Nenhum slot neste dia.</p>
                                                <p className="text-xs text-slate-300">Clique em "Adicionar Slot" para começar.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Modal / Form de Edição */}
                            {showSlotForm && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowSlotForm(false); }}>
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                                        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                                            <h3 className="font-bold text-slate-800 text-lg">
                                                {editingSlot ? 'Editar Slot' : 'Novo Slot de Conteúdo'}
                                            </h3>
                                            <button onClick={() => setShowSlotForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="p-6 space-y-4">
                                            {/* Dia da semana */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dia da Semana</label>
                                                <select
                                                    value={slotForm.day_of_week}
                                                    onChange={e => setSlotForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                >
                                                    {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => (
                                                        <option key={i} value={i}>{d}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Horário + Tipo */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário</label>
                                                    <input
                                                        type="time"
                                                        value={slotForm.scheduled_time || '09:00'}
                                                        onChange={e => setSlotForm(f => ({ ...f, scheduled_time: e.target.value }))}
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                                                    <select
                                                        value={slotForm.content_type}
                                                        onChange={e => setSlotForm(f => ({ ...f, content_type: e.target.value as ContentType }))}
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                    >
                                                        <option value="story">📸 Story</option>
                                                        <option value="reels">🎬 Reels</option>
                                                        <option value="carrossel">🎴 Carrossel</option>
                                                        <option value="post">📷 Post Feed</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Hook */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">🎣 Hook (primeiros 3 segundos)</label>
                                                <input
                                                    type="text"
                                                    value={slotForm.hook || ''}
                                                    onChange={e => setSlotForm(f => ({ ...f, hook: e.target.value }))}
                                                    placeholder="Ex: Você sabia que esse celular tem esse preço? 😱"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                />
                                            </div>

                                            {/* Legenda */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">📝 Legenda completa (pronta pra copiar)</label>
                                                <textarea
                                                    value={slotForm.caption || ''}
                                                    onChange={e => setSlotForm(f => ({ ...f, caption: e.target.value }))}
                                                    placeholder="Escreva a legenda completa do post..."
                                                    rows={5}
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                                                />
                                            </div>

                                            {/* CTA */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">👉 CTA (Call-to-Action)</label>
                                                <input
                                                    type="text"
                                                    value={slotForm.cta || ''}
                                                    onChange={e => setSlotForm(f => ({ ...f, cta: e.target.value }))}
                                                    placeholder="Ex: Manda 'QUERO' nos comentários!"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                />
                                            </div>

                                            {/* Hashtags */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">🏷️ Hashtags</label>
                                                <input
                                                    type="text"
                                                    value={slotForm.hashtags || ''}
                                                    onChange={e => setSlotForm(f => ({ ...f, hashtags: e.target.value }))}
                                                    placeholder="#celular #iphone #oferta #MercadoDoVale"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                />
                                            </div>

                                            {/* Notas Visuais */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">🎨 Notas Visuais</label>
                                                <input
                                                    type="text"
                                                    value={slotForm.visual_notes || ''}
                                                    onChange={e => setSlotForm(f => ({ ...f, visual_notes: e.target.value }))}
                                                    placeholder="Ex: Produto na mão, fundo branco, luz natural"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                />
                                            </div>

                                            {/* Toggles */}
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={slotForm.send_telegram_reminder ?? true}
                                                        onChange={e => setSlotForm(f => ({ ...f, send_telegram_reminder: e.target.checked }))}
                                                        className="w-4 h-4 text-pink-600 rounded border-slate-300 focus:ring-pink-500"
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">📲 Enviar no Telegram</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={slotForm.active ?? true}
                                                        onChange={e => setSlotForm(f => ({ ...f, active: e.target.checked }))}
                                                        className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">✅ Ativo</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
                                            <button
                                                onClick={() => setShowSlotForm(false)}
                                                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleSaveSlot}
                                                className="px-6 py-2 text-sm font-bold bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
                                            >
                                                {editingSlot ? 'Salvar Alterações' : 'Criar Slot'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
            </div>
        </div>
    );
}
