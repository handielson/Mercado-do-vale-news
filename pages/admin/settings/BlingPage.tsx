import React, { useState, useEffect, useMemo } from 'react';
import {
    Settings, Package, Save, Eye, EyeOff, CheckCircle, AlertCircle,
    Copy, ExternalLink, Download, Loader2, Search, RefreshCw, Link2, Webhook, Activity, ShieldCheck, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../services/supabase';
import { fetchAllBlingProducts, searchBlingProducts, importBlingProducts, fetchBlingCategories, fetchBlingProductDetail, BlingProduct, BlingProductDetail, BlingCategory, CategoryMapping, ImportResult, BLING_FIELD_MAPPINGS, DEFAULT_ENABLED_FIELDS, loadCategoryMappings, saveCategoryMappings, FieldMappingConfig, SYSTEM_FIELDS, loadFieldMappings, saveFieldMappings, getDefaultFieldMappings, ColorMapping, loadColorMappings, saveColorMappings, blingService } from '../../../services/blingService';
import { categoryService } from '../../../services/categories';
import { modelService } from '../../../services/models-new';
import { colorService } from '../../../services/colors';
import { Category } from '../../../types/category';
import { Model } from '../../../types/model-architecture';
import { Color } from '../../../types/color';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface BlingCredentials {
    bling_client_id: string;
    bling_client_secret: string;
    bling_callback_url: string;
}

type Tab = 'config' | 'products' | 'mappings' | 'webhook';

const CACHE_KEY = 'bling_products_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

interface BlingCache {
    timestamp: number;
    products: BlingProduct[];
}

function loadCache(): BlingCache | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cache: BlingCache = JSON.parse(raw);
        if (Date.now() - cache.timestamp > CACHE_TTL_MS) return null; // expirado
        return cache;
    } catch { return null; }
}

function saveCache(products: BlingProduct[]) {
    try {
        const cache: BlingCache = { timestamp: Date.now(), products };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch { /* quota exceeded - ignora */ }
}

function clearCache() {
    localStorage.removeItem(CACHE_KEY);
}

function formatCacheAge(timestamp: number): string {
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return 'agora';
    if (mins === 1) return 'há 1 min';
    return `há ${mins} min`;
}

interface CategoryTreeOption {
    id: string;
    name: string;
    path: string;
    depth: number;
    searchable: string;
}

function normalizeCategoryName(name: string): string {
    return (name || '').trim().replace(/\s+/g, ' ');
}

function sortCategories(categories: Category[]): Category[] {
    return [...categories].sort((a, b) => {
        const orderA = a.sort_order ?? 9999;
        const orderB = b.sort_order ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return normalizeCategoryName(a.name).localeCompare(normalizeCategoryName(b.name), 'pt-BR', { sensitivity: 'base' });
    });
}

function buildCategoryTreeOptions(categories: Category[]): CategoryTreeOption[] {
    if (!categories.length) return [];

    const normalizedCategories = categories.map(cat => ({
        ...cat,
        name: normalizeCategoryName(cat.name),
    }));

    const byId = new Map(normalizedCategories.map(cat => [cat.id, cat]));
    const childrenByParent = new Map<string, Category[]>();
    const roots: Category[] = [];

    for (const cat of normalizedCategories) {
        const parentId = cat.parent_id && byId.has(cat.parent_id) ? cat.parent_id : null;
        if (!parentId) {
            roots.push(cat);
            continue;
        }
        const current = childrenByParent.get(parentId) || [];
        current.push(cat);
        childrenByParent.set(parentId, current);
    }

    const result: CategoryTreeOption[] = [];

    const walk = (cat: Category, depth: number, parentPath: string) => {
        const currentPath = parentPath ? `${parentPath} > ${cat.name}` : cat.name;
        result.push({
            id: cat.id,
            name: cat.name,
            path: currentPath,
            depth,
            searchable: `${cat.name} ${currentPath}`.toLowerCase(),
        });

        const children = sortCategories(childrenByParent.get(cat.id) || []);
        for (const child of children) {
            walk(child, depth + 1, currentPath);
        }
    };

    for (const root of sortCategories(roots)) {
        walk(root, 0, '');
    }

    return result;
}

function getLatestCreatedCategoryId(categories: Category[]): string | null {
    const withCreatedAt = categories
        .filter(cat => !!cat.created_at)
        .map(cat => ({
            id: cat.id,
            ts: new Date(cat.created_at as string).getTime(),
        }))
        .filter(item => Number.isFinite(item.ts))
        .sort((a, b) => b.ts - a.ts);

    if (withCreatedAt.length > 0) return withCreatedAt[0].id;
    if (categories.length > 0) return categories[categories.length - 1].id;
    return null;
}

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────

export default function BlingPage() {
    const [activeTab, setActiveTab] = useState<Tab>('config');

    // ── Credentials ──
    const [credentials, setCredentials] = useState<BlingCredentials>({
        bling_client_id: '',
        bling_client_secret: '',
        bling_callback_url: `${window.location.origin}/admin/settings/bling/callback`,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);

    // ── Products import ──
    const [fetching, setFetching] = useState(false);
    const [importing, setImporting] = useState(false);
    const [blingProducts, setBlingProducts] = useState<BlingProduct[]>([]);
    const [existingBlingIds, setExistingBlingIds] = useState<Set<number>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [productSearch, setProductSearch] = useState('');
    const [blingSearch, setBlingSearch] = useState('');
    const [productListFilter, setProductListFilter] = useState<'new' | 'imported' | 'out_of_stock' | 'all'>('new');
    const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set(DEFAULT_ENABLED_FIELDS));
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [cacheInfo, setCacheInfo] = useState<{ timestamp: number } | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [refreshingCategories, setRefreshingCategories] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [importCategoryId, setImportCategoryId] = useState('');
    const [models, setModels] = useState<Model[]>([]);
    const [importModelId, setImportModelId] = useState('');
    const [autoCreateModel, setAutoCreateModel] = useState(false);
    const [systemColors, setSystemColors] = useState<Color[]>([]);
    const [colorMappings, setColorMappings] = useState<ColorMapping[]>(loadColorMappings);

    // ── Mappings ──
    const [blingCategories, setBlingCategories] = useState<BlingCategory[]>([]);
    const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>(loadCategoryMappings);
    const [loadingMappings, setLoadingMappings] = useState(false);

    // ── Product detail preview ──
    const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
    const [productDetails, setProductDetails] = useState<Map<number, BlingProductDetail>>(new Map());
    const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);
    const [fieldMappings, setFieldMappings] = useState<FieldMappingConfig[]>(loadFieldMappings);

    // ── Shortcuts ──
    const [blingDashboardUrl, setBlingDashboardUrl] = useState(() => localStorage.getItem('bling_dashboard_url') || 'https://www.bling.com.br/b/dashboard');



    // ── Webhook diagnostics ──
    const [webhookTestResult, setWebhookTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [testingWebhook, setTestingWebhook] = useState(false);
    const [checkingBlingIds, setCheckingBlingIds] = useState(false);
    const [blingIdStats, setBlingIdStats] = useState<{ total: number; with_id: number; without_id: number } | null>(null);
    const [productsWithoutId, setProductsWithoutId] = useState<{ id: string; name: string; sku: string | null }[]>([]);
    const [reimportingIds, setReimportingIds] = useState<Set<string>>(new Set());
    const [reimportResults, setReimportResults] = useState<Map<string, { ok: boolean; message: string }>>(new Map());
    const [reimportingAll, setReimportingAll] = useState(false);
    const [webhookLogs, setWebhookLogs] = useState<{ id: string; payload: any; received_at: string }[] | null>(null);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logsTableExists, setLogsTableExists] = useState<boolean | null>(null);

    const categoryTreeOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);
    const filteredCategoryTreeOptions = useMemo(() => {
        const q = categoryFilter.trim().toLowerCase();
        if (!q) return categoryTreeOptions;
        return categoryTreeOptions.filter(opt => opt.searchable.includes(q));
    }, [categoryFilter, categoryTreeOptions]);

    // ── Fiscal Sync ──
    const [fiscalSku, setFiscalSku] = useState('');
    const [fiscalNcm, setFiscalNcm] = useState('');
    const [fiscalCest, setFiscalCest] = useState('');
    const [fiscalSyncing, setFiscalSyncing] = useState(false);
    const [fiscalResult, setFiscalResult] = useState<{ ok: boolean; message: string } | null>(null);

    // ─────────────────────────────────────────────────────
    // Load
    // ─────────────────────────────────────────────────────

    useEffect(() => {
        loadCredentials();
        refreshCategories();
        modelService.list().then(mods => {
            const sorted = [...mods].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setModels(sorted);
            if (sorted.length > 0) setImportModelId(sorted[0].id);
        }).catch(() => { });
        colorService.list().then(cols => setSystemColors(cols)).catch(() => { });

        const params = new URLSearchParams(window.location.search);
        if (params.get('connected') === 'true') {
            toast.success('Bling conectado com sucesso!');
            setIsConnected(true);
            window.history.replaceState({}, '', window.location.pathname);
        } else if (params.get('error')) {
            const errMap: Record<string, string> = {
                missing_code: 'Código de autorização não recebido.',
                token_exchange_failed: 'Falha ao trocar o token com o Bling.',
                server_config: 'Erro de configuração do servidor.',
                callback_failed: 'Erro ao processar o callback.',
            };
            const msg = errMap[params.get('error')!] || `Erro: ${params.get('error')}`;
            toast.error(msg);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    useEffect(() => {
        const handleFocus = () => {
            refreshCategories();
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                refreshCategories();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    async function loadCredentials() {
        try {
            const { data, error } = await supabase
                .from('company_settings')
                .select('bling_client_id, bling_client_secret, bling_access_token, bling_token_expires_at, bling_callback_url')
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setCredentials({
                    bling_client_id: data.bling_client_id || '',
                    bling_client_secret: data.bling_client_secret || '',
                    bling_callback_url: data.bling_callback_url || `${window.location.origin}/admin/settings/bling/callback`,
                });
                setIsConnected(!!data.bling_access_token);
                setTokenExpiresAt(data.bling_token_expires_at || null);
            }
        } catch (err: any) {
            toast.error('Erro ao carregar configurações: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    async function refreshCategories(options: { selectLatestCreated?: boolean; showToast?: boolean } = {}) {
        const { selectLatestCreated = false, showToast = false } = options;
        setRefreshingCategories(true);
        try {
            const cats = await categoryService.list(true);
            setCategories(cats);

            const available = new Set(cats.map(c => c.id));
            setImportCategoryId(prev => {
                if (selectLatestCreated) {
                    const latestId = getLatestCreatedCategoryId(cats);
                    if (latestId && available.has(latestId)) return latestId;
                    return '';
                }
                if (prev && available.has(prev)) return prev;
                return '';
            });

            if (showToast) {
                const latestId = getLatestCreatedCategoryId(cats);
                const latestName = cats.find(c => c.id === latestId)?.name;
                toast.success(
                    latestName
                        ? `Categorias atualizadas. Selecionada: ${latestName}`
                        : 'Categorias atualizadas.'
                );
            }
        } catch (err: any) {
            toast.error('Erro ao atualizar categorias: ' + (err?.message || 'Tente novamente.'));
        } finally {
            setRefreshingCategories(false);
        }
    }

    // ─────────────────────────────────────────────────────
    // Config handlers
    // ─────────────────────────────────────────────────────

    async function handleSave() {
        if (!credentials.bling_client_id.trim() || !credentials.bling_client_secret.trim()) {
            toast.error('Preencha o Client ID e o Client Secret.');
            return;
        }

        setSaving(true);
        try {
            const { data: existing } = await supabase
                .from('company_settings')
                .select('id')
                .limit(1)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase
                    .from('company_settings')
                    .update({
                        bling_client_id: credentials.bling_client_id.trim(),
                        bling_client_secret: credentials.bling_client_secret.trim(),
                        bling_callback_url: credentials.bling_callback_url.trim(),
                    })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('company_settings')
                    .insert({
                        bling_client_id: credentials.bling_client_id.trim(),
                        bling_client_secret: credentials.bling_client_secret.trim(),
                        bling_callback_url: credentials.bling_callback_url.trim(),
                    });
                if (error) throw error;
            }
            toast.success('Credenciais salvas!');
        } catch (err: any) {
            toast.error('Erro ao salvar: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    function handleConnectBling() {
        if (!credentials.bling_client_id.trim()) {
            toast.error('Salve o Client ID antes de conectar.');
            return;
        }

        let callbackUrl = credentials.bling_callback_url.trim() || `${window.location.origin}/admin/settings/bling/callback`;
        // Ensure callback URL is always absolute
        if (!callbackUrl.startsWith('http')) {
            callbackUrl = `${window.location.origin}${callbackUrl}`;
        }
        const authUrl = new URL('https://www.bling.com.br/Api/v3/oauth/authorize');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', credentials.bling_client_id.trim());
        authUrl.searchParams.set('redirect_uri', callbackUrl);
        authUrl.searchParams.set('state', 'bling_oauth');

        window.location.href = authUrl.toString();
    }

    function copyCallbackUrl() {
        navigator.clipboard.writeText(credentials.bling_callback_url);
        toast.success('URL copiada!');
    }

    async function handleSyncFiscal() {
        const sku = fiscalSku.trim();
        const ncm = fiscalNcm.trim().replace(/\D/g, '');
        if (!sku) { toast.error('Informe o SKU do produto.'); return; }
        if (!ncm && !fiscalCest.trim()) { toast.error('Informe ao menos NCM ou CEST.'); return; }

        setFiscalSyncing(true);
        setFiscalResult(null);
        try {
            // 1. Busca o produto na VPS pelo SKU para obter o bling_id
            const vpsBase = import.meta.env.DEV ? '/vps-proxy' : (import.meta.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br');
            const vpsRes = await fetch(`${vpsBase}/products?search=${encodeURIComponent(sku)}&limit=5`);
            const vpsData = vpsRes.ok ? await vpsRes.json() : null;
            const products: any[] = Array.isArray(vpsData) ? vpsData : vpsData?.products ?? vpsData?.data ?? [];
            const product = products.find((p: any) =>
                (p.sku || '').toLowerCase() === sku.toLowerCase()
            ) ?? products[0];

            if (!product?.bling_id) {
                toast.error(`Produto "${sku}" não encontrado na VPS ou sem bling_id.`);
                setFiscalResult({ ok: false, message: `Sem bling_id para SKU "${sku}"` });
                return;
            }

            const blingId = product.bling_id;

            // 2. Atualiza NCM/CEST no Bling via proxy
            const blingRes = await fetch('/api/bling?resource=product-update-fiscal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blingId,
                    ncm: ncm || undefined,
                    cest: fiscalCest.trim() || undefined,
                }),
            });
            const blingJson = await blingRes.json();

            if (!blingRes.ok || !blingJson.ok) {
                const msg = blingJson.detail || blingJson.error || 'Falha ao atualizar o Bling';
                toast.error(msg);
                setFiscalResult({ ok: false, message: msg });
                return;
            }

            // 3. Sincroniza também na VPS MySQL (fire-and-forget)
            const syncKey = import.meta.env.VITE_VPS_SYNC_KEY || '';
            if (syncKey && product.id) {
                fetch(`${vpsBase}/products/${product.id}/fiscal`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
                    body: JSON.stringify({ ncm: ncm || undefined, cest: fiscalCest.trim() || undefined }),
                }).catch(() => {});
            }

            const msg = `NCM/CEST atualizado no Bling para "${product.name || sku}" (bling_id: ${blingId})`;
            toast.success(msg);
            setFiscalResult({ ok: true, message: msg });
        } catch (err: any) {
            const msg = err.message || 'Erro inesperado';
            toast.error(msg);
            setFiscalResult({ ok: false, message: msg });
        } finally {
            setFiscalSyncing(false);
        }
    }

    // ─────────────────────────────────────────────────────
    // Products handlers
    // ─────────────────────────────────────────────────────

    async function handleFetchBlingProducts(forceRefresh = false) {
        setFetching(true);
        setBlingProducts([]);
        setSelectedIds(new Set());
        setImportResult(null);
        try {
            let products: BlingProduct[];

            if (blingSearch.trim()) {
                // Busca específica → vai direto ao Bling, sem cache
                products = await searchBlingProducts(blingSearch.trim());
                setCacheInfo(null);
            } else if (!forceRefresh) {
                // Sem filtro → tenta usar cache primeiro
                const cached = loadCache();
                if (cached) {
                    products = cached.products;
                    setCacheInfo({ timestamp: cached.timestamp });
                    toast.success(`${products.length} produtos carregados do cache (${formatCacheAge(cached.timestamp)}).`);
                } else {
                    products = await fetchAllBlingProducts();
                    saveCache(products);
                    setCacheInfo({ timestamp: Date.now() });
                    if (products.length === 0) toast.error('Nenhum produto encontrado.');
                    else toast.success(`${products.length} produtos carregados do Bling.`);
                }
            } else {
                // Forçar atualização → limpa cache e recarrega
                clearCache();
                products = await fetchAllBlingProducts();
                saveCache(products);
                setCacheInfo({ timestamp: Date.now() });
                if (products.length === 0) toast.error('Nenhum produto encontrado.');
                else toast.success(`${products.length} produtos atualizados do Bling.`);
            }

            setBlingProducts(products);

            // Verifica quais já existem no sistema
            const ids = products.map(p => p.id);
            const existing = await blingService.checkExistingBlingProducts(ids);
            setExistingBlingIds(existing);

            // Seleciona por padrão apenas os ativos, não importados, e com estoque > 0
            const activeIds = new Set(products.filter(p => p.situacao === 'A' && !existing.has(p.id) && Number(p.stock_quantity) > 0).map(p => p.id));
            setSelectedIds(activeIds);
        } catch (err: any) {
            toast.error('Erro ao buscar produtos: ' + err.message);
        } finally {
            setFetching(false);
        }
    }

    async function handleImport() {
        const toImportBase = blingProducts.filter(p => selectedIds.has(p.id));
        if (toImportBase.length === 0) { toast.error('Selecione ao menos um produto.'); return; }
        if (!importCategoryId) { toast.error('Selecione uma categoria padrão para importação.'); return; }

        // Merge productDetails (edited fields) over original blingProducts
        const toImport = toImportBase.map(p => {
            const detail = productDetails.get(p.id);
            return detail ? { ...p, ...detail } : p;
        });

        setImporting(true);
        setImportResult(null);
        setImportProgress({ current: 0, total: toImport.length });

        try {
            const result = await importBlingProducts(toImport, enabledFields, importCategoryId, (current, total) => {
                setImportProgress({ current, total });
            }, importModelId || undefined, autoCreateModel);

            setImportResult(result);

            if (result.errors.length === 0) {
                toast.success(`Importação concluída! ${result.created} criados, ${result.updated} atualizados.`);
            } else {
                toast.warning(`Importação com erros: ${result.errors.length} falhas.`);
            }
        } catch (err: any) {
            toast.error('Erro na importação: ' + (err.message || 'Tente novamente.'));
        } finally {
            setImporting(false);
        }
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    const filteredProducts = blingProducts.filter(p => {
        // 1. Text Search Filter
        const matchesSearch = !productSearch ||
            p.nome.toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.codigo || '').toLowerCase().includes(productSearch.toLowerCase());
        if (!matchesSearch) return false;

        // 2. Tab Filter
        if (productListFilter === 'new') {
            return !existingBlingIds.has(p.id) && Number(p.stock_quantity) > 0;
        } else if (productListFilter === 'imported') {
            return existingBlingIds.has(p.id);
        } else if (productListFilter === 'out_of_stock') {
            return !existingBlingIds.has(p.id) && Number(p.stock_quantity) <= 0;
        }
        return true;
    });

    function toggleSelectAll() {
        // We only consider products that are NOT already existing for the "Select All" logic.
        // If they want to select an existing product, they must do it individually.
        const nonExistingFiltered = filteredProducts.filter(p => !existingBlingIds.has(p.id));
        const allSelected = nonExistingFiltered.length > 0 && nonExistingFiltered.every(p => selectedIds.has(p.id));

        setSelectedIds(prev => {
            const next = new Set(prev);
            nonExistingFiltered.forEach(p => allSelected ? next.delete(p.id) : next.add(p.id));
            return next;
        });
    }

    // ─────────────────────────────────────────────────────
    // Derived
    // ─────────────────────────────────────────────────────

    // Mantemos o vínculo como conectado e deixamos a renovação acontecer automaticamente.
    const tokenExpired = false;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-green-500" />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-green-50 rounded-xl">
                    <Link2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Integração Bling</h1>
                    <p className="text-sm text-slate-500">Conecte e sincronize seus produtos com o Bling ERP</p>
                </div>
                {isConnected && !tokenExpired && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Conectado
                    </span>
                )}
                {(tokenExpired || !isConnected) && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-100 px-3 py-1.5 rounded-full">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {tokenExpired ? 'Token expirado' : 'Desconectado'}
                    </span>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Menu Lateral */}
                <div className="w-full md:w-64 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm sticky top-24">
                    <nav className="flex flex-col gap-1.5">
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'config'
                                ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Settings className={`w-5 h-5 ${activeTab === 'config' ? 'text-blue-600' : 'text-slate-400'}`} />
                                Configuração
                            </div>
                            {activeTab === 'config' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </button>

                        <button
                            onClick={() => setActiveTab('products')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'products'
                                ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Package className={`w-5 h-5 ${activeTab === 'products' ? 'text-blue-600' : 'text-slate-400'}`} />
                                Produtos
                                {blingProducts.length > 0 && (
                                    <span className="ml-1.5 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {blingProducts.length}
                                    </span>
                                )}
                            </div>
                            {activeTab === 'products' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </button>

                        <button
                            onClick={() => setActiveTab('mappings')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'mappings'
                                ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <ArrowRight className={`w-5 h-5 ${activeTab === 'mappings' ? 'text-blue-600' : 'text-slate-400'}`} />
                                Mapeamentos
                                {categoryMappings.length > 0 && (
                                    <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {categoryMappings.length}
                                    </span>
                                )}
                            </div>
                            {activeTab === 'mappings' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('webhook')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'webhook'
                                ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Activity className={`w-5 h-5 ${activeTab === 'webhook' ? 'text-blue-600' : 'text-slate-400'}`} />
                                Webhook
                            </div>
                            {activeTab === 'webhook' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </button>
                    </nav>

                    {/* Atalhos rápidos */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-2 mb-2">
                            Atalhos
                        </p>
                        <div className="flex flex-col gap-1">
                            <a
                                href="/admin/settings/models"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                                <Package className="w-4 h-4 text-slate-400 shrink-0" />
                                Modelos
                                <ExternalLink className="w-3 h-3 text-slate-300 ml-auto" />
                            </a>
                            <a
                                href="/admin/products"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                                <Download className="w-4 h-4 text-slate-400 shrink-0" />
                                Produtos
                                <ExternalLink className="w-3 h-3 text-slate-300 ml-auto" />
                            </a>
                            <a
                                href="/"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                                <Eye className="w-4 h-4 text-slate-400 shrink-0" />
                                Página de Vendas
                                <ExternalLink className="w-3 h-3 text-slate-300 ml-auto" />
                            </a>
                            <a
                                href={blingDashboardUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 mt-2 rounded-lg text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4 shrink-0" />
                                    Acessar Bling
                                </div>
                                <span className="text-[10px] font-normal text-green-600/80">Abrir painel em nova aba</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Conteúdo Principal */}
                <div className="flex-1 min-w-0 space-y-6">
                    {/* Alerta de reconexão necessária */}
                    {(!isConnected || tokenExpired) && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-red-800">
                                    {!isConnected
                                        ? '⚠️ Bling desconectado — webhook de estoque parado'
                                        : '⚠️ Token OAuth expirado — webhook de estoque parado'}
                                </p>
                                <p className="text-red-700 mt-0.5">
                                    {!isConnected
                                        ? 'O token foi invalidado (possivelmente expirado sem conseguir renovar). Clique em "Conectar com Bling" na aba Configuração para reconectar. Após reconectar, verifique se o webhook está cadastrado no Bling em Configurações → Integrações → Webhooks.'
                                        : 'O token expirou e não foi renovado automaticamente. Clique em "Conectar com Bling" para reautenticar.'}
                                </p>
                            </div>
                        </div>
                    )}
                    {/* ══════════════════════════════════════ */}
                    {/* TAB: CONFIGURAÇÃO                      */}
                    {/* ══════════════════════════════════════ */}
                    {activeTab === 'config' && (
                        <div className="space-y-4">
                            {/* Credenciais */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">1</span>
                                    Credenciais do App Bling
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Crie um app em{' '}
                                    <a href="https://developer.bling.com.br/aplicativos#/" target="_blank" rel="noreferrer" className="text-green-600 underline">
                                        developer.bling.com.br
                                    </a>{' '}
                                    e cole o <strong>Client ID</strong> e <strong>Client Secret</strong> abaixo.
                                </p>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
                                        <input
                                            type="text"
                                            value={credentials.bling_client_id}
                                            onChange={e => setCredentials({ ...credentials, bling_client_id: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                                            placeholder="Cole o Client ID aqui"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Client Secret</label>
                                        <div className="relative">
                                            <input
                                                type={showSecret ? 'text' : 'password'}
                                                value={credentials.bling_client_secret}
                                                onChange={e => setCredentials({ ...credentials, bling_client_secret: e.target.value })}
                                                className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                                                placeholder="Cole o Client Secret aqui"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSecret(!showSecret)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saving ? 'Salvando...' : 'Salvar Credenciais'}
                                </button>
                            </div>

                            {/* Callback URL */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
                                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">2</span>
                                    URL de Callback (Redirecionamento)
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Cadastre esta URL no campo <strong>"Link de Redirecionamento"</strong> do seu app no Bling:
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={credentials.bling_callback_url}
                                        onChange={e => setCredentials({ ...credentials, bling_callback_url: e.target.value })}
                                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm bg-slate-50"
                                        placeholder="https://seudominio.com/admin/settings/bling/callback"
                                    />
                                    <button onClick={copyCallbackUrl} className="flex-shrink-0 p-3 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Autorizar */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">3</span>
                                    Autorizar Acesso
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Clique em <strong>"Conectar com Bling"</strong> para autorizar via OAuth2. Você será redirecionado para o Bling e voltará automaticamente.
                                </p>
                                <button
                                    onClick={handleConnectBling}
                                    disabled={!credentials.bling_client_id}
                                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                    {isConnected && !tokenExpired ? 'Reconectar com Bling' : 'Conectar com Bling'}
                                </button>
                            </div>

                            {/* Link Rápido Bling */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
                                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">4</span>
                                    Link de Acesso Rápido
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Este link será usado no botão de acesso rápido no menu lateral.
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={blingDashboardUrl}
                                        onChange={e => {
                                            setBlingDashboardUrl(e.target.value);
                                            localStorage.setItem('bling_dashboard_url', e.target.value);
                                        }}
                                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm bg-slate-50"
                                        placeholder="https://www.bling.com.br/b/dashboard"
                                    />
                                    <a
                                        href={blingDashboardUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-shrink-0 p-3 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                                        title="Acessar link"
                                    >
                                        <ExternalLink className="w-5 h-5" />
                                    </a>
                                </div>
                            </div>

                            {/* Escopos */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-sm font-semibold text-blue-800 mb-2">📋 Escopos necessários no app Bling</p>
                                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                                    <li><strong>Produtos</strong> — leitura e escrita</li>
                                    <li><strong>Estoques</strong> — leitura de saldos por depósito</li>
                                </ul>
                            </div>

                            {/* ── Sincronização Fiscal ── */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-700">5</span>
                                    Sincronizar NCM / CEST → Bling
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Informe o <strong>SKU</strong> do produto e os dados fiscais para atualizar diretamente o cadastro no Bling ERP.
                                    Também sincroniza na VPS MySQL.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">SKU do produto</label>
                                        <input
                                            type="text"
                                            value={fiscalSku}
                                            onChange={e => setFiscalSku(e.target.value)}
                                            placeholder="Ex: XRED-12-64"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">NCM</label>
                                        <input
                                            type="text"
                                            value={fiscalNcm}
                                            onChange={e => setFiscalNcm(e.target.value.replace(/[^0-9.]/g, '').slice(0, 11))}
                                            placeholder="Ex: 8517.62.62"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">CEST <span className="font-normal text-slate-400">(opcional)</span></label>
                                        <input
                                            type="text"
                                            value={fiscalCest}
                                            onChange={e => setFiscalCest(e.target.value.replace(/[^0-9.]/g, '').slice(0, 9))}
                                            placeholder="Ex: 21.062.00"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleSyncFiscal}
                                    disabled={fiscalSyncing || !isConnected || !fiscalSku.trim() || (!fiscalNcm.trim() && !fiscalCest.trim())}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {fiscalSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    {fiscalSyncing ? 'Sincronizando...' : 'Sincronizar NCM → Bling'}
                                </button>

                                {!isConnected && (
                                    <p className="text-xs text-amber-600">⚠️ Conecte o Bling (passo 3) antes de sincronizar.</p>
                                )}

                                {fiscalResult && (
                                    <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
                                        fiscalResult.ok
                                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                                            : 'bg-red-50 border border-red-200 text-red-800'
                                    }`}>
                                        {fiscalResult.ok
                                            ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                                            : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />}
                                        <span>{fiscalResult.message}</span>
                                    </div>
                                )}
                            </div>

                        </div>
                    )}

                    {/* ══════════════════════════════════════ */}
                    {/* TAB: PRODUTOS                          */}
                    {/* ══════════════════════════════════════ */}
                    {activeTab === 'products' && (
                        <div className="space-y-4">
                            {!isConnected ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
                                    <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                                    <p className="font-semibold text-amber-800">Bling não conectado</p>
                                    <p className="text-sm text-amber-700">Configure as credenciais e conecte o Bling na aba <strong>Configuração</strong> primeiro.</p>
                                    <button onClick={() => setActiveTab('config')} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700">
                                        Ir para Configuração
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Importação */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                                        <div>
                                            <h2 className="text-base font-bold text-slate-800">Importar Produtos do Bling</h2>
                                            <p className="text-sm text-slate-500 mt-0.5">
                                                Busque, selecione e importe produtos do Bling para o sistema.
                                            </p>
                                        </div>

                                        {/* Default category selector */}
                                        <div className={`p-3 rounded-xl border ${!importCategoryId ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'} space-y-2`}>
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">📂 Categoria padrão:</label>
                                                <select
                                                    value={importCategoryId}
                                                    onChange={e => setImportCategoryId(e.target.value)}
                                                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                >
                                                    <option value="">-- Selecione uma categoria --</option>
                                                    {filteredCategoryTreeOptions.map(c => (
                                                        <option key={c.id} value={c.id}>{`${'-- '.repeat(c.depth)}${c.name}`}</option>
                                                    ))}
                                                </select>
                                                {/* Atualizar lista */}
                                                <button
                                                    type="button"
                                                    title="Atualizar categorias"
                                                    onClick={() => refreshCategories({ selectLatestCreated: true, showToast: true })}
                                                    disabled={refreshingCategories}
                                                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-slate-500 flex-shrink-0 disabled:opacity-50"
                                                >
                                                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingCategories ? 'animate-spin' : ''}`} />
                                                </button>
                                                {/* Atalho para criar categoria */}
                                                <a
                                                    href="/admin/settings/categories"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="Cadastrar nova categoria (abre em nova aba)"
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-colors text-xs font-semibold text-blue-600 whitespace-nowrap flex-shrink-0"
                                                >
                                                    + Categoria
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={categoryFilter}
                                                    onChange={e => setCategoryFilter(e.target.value)}
                                                    placeholder="Filtrar categoria por nome ou caminho..."
                                                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                />
                                                <span className="text-[11px] text-slate-500 whitespace-nowrap">
                                                    {filteredCategoryTreeOptions.length}/{categoryTreeOptions.length}
                                                </span>
                                            </div>
                                            {importCategoryId && (
                                                <p className="text-[11px] text-slate-500">
                                                    Caminho selecionado: {categoryTreeOptions.find(c => c.id === importCategoryId)?.path || 'N/A'}
                                                </p>
                                            )}
                                        </div>

                                        {/* Default model selector */}
                                        <div className="flex flex-col gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">📱 Modelo padrão:</label>
                                                <select
                                                    value={importModelId}
                                                    onChange={e => setImportModelId(e.target.value)}
                                                    disabled={autoCreateModel}
                                                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:bg-slate-100"
                                                >
                                                    <option value="">-- Nenhum modelo --</option>
                                                    {models.map(m => (
                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                    ))}
                                                </select>
                                                {/* Atualizar lista */}
                                                <button
                                                    type="button"
                                                    title="Atualizar modelos"
                                                    onClick={() => modelService.list().then(mods => {
                                                        const sorted = [...mods].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                                                        setModels(sorted);
                                                        if (sorted.length > 0 && !importModelId && !autoCreateModel) setImportModelId(sorted[0].id);
                                                    }).catch(() => { })}
                                                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-slate-500 flex-shrink-0"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                </button>
                                                {/* Atalho para criar modelo */}
                                                <a
                                                    href="/admin/settings/models"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="Cadastrar novo modelo (abre em nova aba)"
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-colors text-xs font-semibold text-blue-600 whitespace-nowrap flex-shrink-0"
                                                >
                                                    + Modelo
                                                </a>
                                            </div>
                                            
                                            <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-200">
                                                <input
                                                    type="checkbox"
                                                    checked={autoCreateModel}
                                                    onChange={e => {
                                                        setAutoCreateModel(e.target.checked);
                                                        if (e.target.checked) setImportModelId('');
                                                    }}
                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-slate-700">
                                                    Criar marcas e modelos automaticamente <span className="font-normal text-slate-500">(baseado no nome do Bling)</span>
                                                </span>
                                            </label>
                                        </div>


                                        {/* Cache banner */}

                                        {cacheInfo && (
                                            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs">
                                                <span className="text-amber-700">📦 Lista carregada do cache · {formatCacheAge(cacheInfo.timestamp)}</span>
                                                <button onClick={() => handleFetchBlingProducts(true)} disabled={fetching} className="text-amber-700 font-semibold underline hover:no-underline disabled:opacity-50">
                                                    Atualizar do Bling
                                                </button>
                                            </div>
                                        )}

                                        {/* Search bar */}
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={blingSearch}
                                                        onChange={e => setBlingSearch(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleFetchBlingProducts()}
                                                        placeholder="Pesquisar por nome, SKU ou código de barras..."
                                                        className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleFetchBlingProducts()}
                                                    disabled={fetching || importing}
                                                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 flex-shrink-0"
                                                >
                                                    {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                    {fetching ? 'Buscando...' : blingProducts.length > 0 ? 'Atualizar' : 'Buscar'}
                                                </button>
                                            </div>
                                            <p className="text-[11.5px] text-slate-500 flex items-center gap-1.5 ml-1 mt-0.5">
                                                <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                                A API do Bling requer que a busca seja pelo início exato do nome (ex: "Kit Teclado"). Para buscar palavras no meio do nome, carregue os produtos acima e use o filtro local abaixo.
                                            </p>
                                        </div>

                                        {/* Product list */}
                                        {blingProducts.length > 0 && (
                                            <div className="space-y-3">
                                                {/* UI Das Abas Segmentadas */}
                                                <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                                                    <button
                                                        onClick={() => setProductListFilter('new')}
                                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${productListFilter === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                                    >
                                                        ✨ Novos c/ Estoque
                                                        <span className="ml-1.5 text-xs text-slate-400">({blingProducts.filter(p => !existingBlingIds.has(p.id) && Number(p.stock_quantity) > 0).length})</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setProductListFilter('out_of_stock')}
                                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${productListFilter === 'out_of_stock' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                                    >
                                                        🚫 Sem Estoque
                                                        <span className="ml-1.5 text-xs text-slate-400">({blingProducts.filter(p => !existingBlingIds.has(p.id) && Number(p.stock_quantity) <= 0).length})</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setProductListFilter('imported')}
                                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${productListFilter === 'imported' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                                    >
                                                        ✅ Já Importados
                                                        <span className="ml-1.5 text-xs text-slate-400">({blingProducts.filter(p => existingBlingIds.has(p.id)).length})</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setProductListFilter('all')}
                                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${productListFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                                    >
                                                        📦 Todos
                                                        <span className="ml-1.5 text-xs text-slate-400">({blingProducts.length})</span>
                                                    </button>
                                                </div>

                                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                    <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-200">
                                                        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                        <input
                                                            type="text"
                                                            value={productSearch}
                                                            onChange={e => setProductSearch(e.target.value)}
                                                            placeholder="Filtrar por nome ou SKU..."
                                                            className="flex-1 bg-transparent text-sm outline-none text-slate-700"
                                                        />
                                                        <span className="text-xs text-slate-400 whitespace-nowrap">{selectedIds.size} selecionados</span>
                                                        <button 
                                                            onClick={() => {
                                                                const selectableProducts = filteredProducts.filter(p => p.formato !== 'E' && p.formato !== 'V');
                                                                if (selectableProducts.every(p => selectedIds.has(p.id))) {
                                                                    setSelectedIds(new Set()); // Desmarca todos
                                                                } else {
                                                                    setSelectedIds(new Set(selectableProducts.map(p => p.id))); // Marca todos os selecionáveis
                                                                }
                                                            }} 
                                                            className="text-xs text-blue-600 hover:underline font-medium whitespace-nowrap ml-2"
                                                        >
                                                            {filteredProducts.filter(p => p.formato !== 'E' && p.formato !== 'V').every(p => selectedIds.has(p.id)) && filteredProducts.filter(p => p.formato !== 'E' && p.formato !== 'V').length > 0 ? 'Desmarcar' : 'Todos'}
                                                        </button>
                                                    </div>
                                                <div className="divide-y divide-slate-100">
                                                    {filteredProducts.map(p => {
                                                        const isExpanded = expandedProductId === p.id;
                                                        const detail = productDetails.get(p.id);
                                                        const isLoadingDetail = loadingDetailId === p.id;
                                                        const displayProduct = detail || p;
                                                        const isExisting = existingBlingIds.has(p.id);
                                                        return (
                                                            <div key={p.id} className={`border-b border-slate-100 last:border-0 ${isExisting ? 'opacity-70 bg-slate-50/50' : ''}`}>
                                                                {/* Summary row */}
                                                                <div className={`flex items-center gap-3 py-2.5 transition-colors ${(p.formato === 'E' || p.formato === 'V') ? 'bg-slate-100 border-l-[3px] border-slate-300 pl-[13px] pr-4 opacity-90' : 'px-4 hover:bg-slate-50'}`}>
                                                                    {(p.formato !== 'E' && p.formato !== 'V') ? (
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedIds.has(p.id)}
                                                                            onChange={() => toggleSelect(p.id)}
                                                                            className="w-4 h-4 accent-green-600 flex-shrink-0"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-4 h-4 flex-shrink-0" title="Produtos Pai não podem ser importados sozinhos." />
                                                                    )}
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                             <p className="text-sm font-medium text-slate-800 truncate">{displayProduct.nome}</p>
                                                                             {(p.formato === 'E' || p.formato === 'V') && (
                                                                                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium whitespace-nowrap border border-slate-300">
                                                                                    Produto Pai
                                                                                </span>
                                                                             )}
                                                                        </div>
                                                                        <p className="text-xs text-slate-400">
                                                                            {displayProduct.codigo && displayProduct.codigo !== displayProduct.nome ? `SKU: ${displayProduct.codigo}` : ''}
                                                                            {displayProduct.gtin ? ` · EAN: ${displayProduct.gtin}` : ''}
                                                                            {displayProduct.marca ? ` · ${displayProduct.marca}` : ''}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right flex-shrink-0 mr-1">
                                                                        {displayProduct.preco != null && (
                                                                            <p className="text-sm font-semibold text-slate-700">R$ {displayProduct.preco.toFixed(2).replace('.', ',')}</p>
                                                                        )}
                                                                        <div className="flex items-center justify-end gap-2 mt-0.5">
                                                                            {isExisting && (
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                                                                    Já importado
                                                                                </span>
                                                                            )}
                                                                            <p className={`text-xs font-medium ${displayProduct.stock_quantity > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                                                {detail ? displayProduct.stock_quantity : p.stock_quantity} estoque
                                                                            </p>
                                                                        </div>
                                                                        <span className={`text-xs font-medium mt-1 inline-block ${displayProduct.situacao === 'A' ? 'text-green-600' : 'text-slate-400'}`}>
                                                                            {displayProduct.situacao === 'A' ? 'Ativo' : 'Inativo'}
                                                                        </span>
                                                                    </div>
                                                                    {/* Expand button */}
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (isExpanded) { setExpandedProductId(null); return; }
                                                                            setExpandedProductId(p.id);
                                                                            if (!productDetails.has(p.id)) {
                                                                                setLoadingDetailId(p.id);
                                                                                const d = await fetchBlingProductDetail(p.id);
                                                                                if (d) setProductDetails(prev => new Map(prev).set(p.id, d));
                                                                                setLoadingDetailId(null);
                                                                            }
                                                                        }}
                                                                        className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 flex-shrink-0"
                                                                        title="Ver todos os campos"
                                                                    >
                                                                        {isLoadingDetail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                </div>

                                                                {/* Expandable detail panel — Comparação Bling ↔ Sistema */}
                                                                {isExpanded && detail && (() => {
                                                                    const varNome = (detail as any).variacao?.nome || '';
                                                                    const cor = varNome ? varNome.split(';').find((p: string) => p.toLowerCase().startsWith('cor'))?.split(':')[1]?.trim() : null;

                                                                    const MAPPING_ROWS: Array<{
                                                                        systemField: string;
                                                                        systemLabel: string;
                                                                        blingPath: string;
                                                                        editField: string;
                                                                        type: 'text' | 'number' | 'readonly';
                                                                        getValue: (d: BlingProductDetail) => any;
                                                                    }> = [
                                                                            { systemField: 'name', systemLabel: 'Nome do produto', blingPath: 'nome (limpo)', editField: 'nome', type: 'text', getValue: d => d.nome },
                                                                            { systemField: 'sku', systemLabel: 'SKU / Código', blingPath: 'codigo', editField: 'codigo', type: 'text', getValue: d => d.codigo },
                                                                            { systemField: 'ean', systemLabel: 'EAN / GTIN', blingPath: 'gtin', editField: 'gtin', type: 'text', getValue: d => d.gtin },
                                                                            { systemField: 'brand', systemLabel: 'Marca', blingPath: 'marca', editField: 'marca', type: 'text', getValue: d => d.marca },
                                                                            { systemField: 'category_id', systemLabel: 'Categoria Bling', blingPath: 'categoria.descricao', editField: 'categoria_nome', type: 'readonly', getValue: d => d.categoria?.descricao },
                                                                            { systemField: 'specs.color', systemLabel: 'Cor (variação)', blingPath: 'variacao.nome → COR:', editField: '_cor', type: 'readonly', getValue: () => cor },
                                                                            { systemField: 'price_cost', systemLabel: 'Preço custo (R$)', blingPath: 'precoCusto (pai)', editField: 'precoCusto', type: 'number', getValue: d => d.precoCusto },
                                                                            { systemField: 'price_retail', systemLabel: 'Preço Varejo (R$)', blingPath: 'preco', editField: 'preco', type: 'number', getValue: d => d.preco },
                                                                            { systemField: 'price_reseller', systemLabel: 'Preço Revenda (R$)', blingPath: '— (Manual)', editField: '_precoRevenda', type: 'number', getValue: d => d._precoRevenda ?? d.preco },
                                                                            { systemField: 'price_wholesale', systemLabel: 'Preço Atacado (R$)', blingPath: '— (Manual)', editField: '_precoAtacado', type: 'number', getValue: d => d._precoAtacado ?? d.preco },
                                                                            { systemField: 'stock_quantity', systemLabel: 'Estoque', blingPath: 'estoques/saldos', editField: 'stock_quantity', type: 'number', getValue: d => d.stock_quantity },
                                                                            { systemField: 'ncm', systemLabel: 'NCM', blingPath: 'tributacao.ncm (pai)', editField: 'ncm', type: 'text', getValue: d => d.ncm },
                                                                            { systemField: 'cest', systemLabel: 'CEST', blingPath: 'tributacao.cest (pai)', editField: 'cest', type: 'text', getValue: d => d.cest },
                                                                            { systemField: 'origin', systemLabel: 'Origem (0-8)', blingPath: 'tributacao.origem (pai)', editField: 'origem', type: 'number', getValue: d => d.origem },
                                                                            { systemField: 'weight_kg', systemLabel: 'Peso bruto (kg)', blingPath: 'dimensoes.pesoBruto (pai)', editField: 'pesoBruto', type: 'number', getValue: d => d.pesoBruto },
                                                                            { systemField: 'dimensions.width_cm', systemLabel: 'Largura (cm)', blingPath: 'dimensoes.largura (pai)', editField: 'largura', type: 'number', getValue: d => d.largura },
                                                                            { systemField: 'dimensions.height_cm', systemLabel: 'Altura (cm)', blingPath: 'dimensoes.altura (pai)', editField: 'altura', type: 'number', getValue: d => d.altura },
                                                                            { systemField: 'dimensions.depth_cm', systemLabel: 'Profundidade (cm)', blingPath: 'dimensoes.profundidade (pai)', editField: 'profundidade', type: 'number', getValue: d => d.profundidade },
                                                                            { systemField: 'images', systemLabel: 'Imagem (1ª)', blingPath: 'imagens[0].link (pai)', editField: '_img', type: 'readonly', getValue: d => d.imagens?.[0]?.link || d.imagens?.[0]?.url },
                                                                        ];

                                                                    return (
                                                                        <div className="mx-4 mb-3 border border-slate-200 rounded-xl bg-white overflow-hidden">
                                                                            {/* Header */}
                                                                            <div className="flex items-center justify-between bg-slate-100 border-b border-slate-200 px-3 py-2">
                                                                                <div className="grid grid-cols-[2fr_2fr_3fr_1.5rem] gap-0 w-full text-xs font-bold text-slate-500 uppercase tracking-wide">
                                                                                    <span>Campo do Sistema</span>
                                                                                    <span>Origem no Bling</span>
                                                                                    <span>Valor / Editar</span>
                                                                                    <span></span>
                                                                                </div>
                                                                                {detail.variacao?.produtoPai?.id && (
                                                                                    (() => {
                                                                                        const paiId = detail.variacao.produtoPai.id;
                                                                                        // Conta quantos "irmãos" estão na lista atual de blingProducts
                                                                                        const irmaosCount = blingProducts.filter(x => x.variacao?.produtoPai?.id === paiId && x.id !== p.id).length;

                                                                                        if (irmaosCount > 0) {
                                                                                            return (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    title="Copiar os 4 preços abaixo para as outras variações desta capinha/produto selecionadas na lista"
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        const source = productDetails.get(p.id);
                                                                                                        if (!source) return;

                                                                                                        const precoCusto = source.precoCusto;
                                                                                                        const preco = source.preco;
                                                                                                        const _precoRevenda = source._precoRevenda ?? source.preco;
                                                                                                        const _precoAtacado = source._precoAtacado ?? source.preco;

                                                                                                        setProductDetails(prev => {
                                                                                                            const next = new Map(prev);
                                                                                                            let copiedCount = 0;
                                                                                                            for (const sibling of blingProducts) {
                                                                                                                if (sibling.variacao?.produtoPai?.id === paiId && sibling.id !== p.id) {
                                                                                                                    const sibCurrent = next.get(sibling.id) || sibling as any;
                                                                                                                    next.set(sibling.id, {
                                                                                                                        ...sibCurrent,
                                                                                                                        precoCusto,
                                                                                                                        preco,
                                                                                                                        _precoRevenda,
                                                                                                                        _precoAtacado
                                                                                                                    });
                                                                                                                    copiedCount++;
                                                                                                                }
                                                                                                            }
                                                                                                            toast.success(`Preços copiados para ${copiedCount} variação(ões)!`, { icon: '✨' });
                                                                                                            return next;
                                                                                                        });
                                                                                                    }}
                                                                                                    className="ml-4 flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
                                                                                                >
                                                                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                                                                    Copiar p/ {irmaosCount} irmãos
                                                                                                </button>
                                                                                            );
                                                                                        }
                                                                                        return null;
                                                                                    })()
                                                                                )}
                                                                            </div>

                                                                            {/* Rows */}
                                                                            {MAPPING_ROWS.map(({ systemLabel, blingPath, editField, type, getValue }) => {
                                                                                const val = getValue(detail);
                                                                                const isEmpty = val === null || val === undefined || val === '' || val === 0;
                                                                                return (
                                                                                    <div
                                                                                        key={editField}
                                                                                        className={`grid grid-cols-[2fr_2fr_3fr_1.5rem] gap-0 items-center px-3 py-1.5 border-b border-slate-100 text-sm ${isEmpty ? 'bg-red-50' : ''}`}
                                                                                    >
                                                                                        {/* Campo sistema */}
                                                                                        <span className="text-slate-700 font-medium text-xs">{systemLabel}</span>

                                                                                        {/* Origem Bling */}
                                                                                        <span className="text-slate-400 text-xs font-mono truncate pr-2">{blingPath}</span>

                                                                                        {/* Valor / Input */}
                                                                                        {type === 'readonly' ? (
                                                                                            <span className={`text-xs truncate ${isEmpty ? 'text-red-400 italic' : 'text-slate-700'}`}>
                                                                                                {isEmpty ? '— não disponível no Bling' : String(val)}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <input
                                                                                                type={type}
                                                                                                defaultValue={val ?? ''}
                                                                                                placeholder={isEmpty ? 'Preencher manualmente...' : ''}
                                                                                                onChange={e => {
                                                                                                    const newVal = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                                                                                                    setProductDetails(prev => {
                                                                                                        const updated = new Map(prev);
                                                                                                        const cur = updated.get(p.id)!;
                                                                                                        updated.set(p.id, { ...cur, [editField]: newVal });
                                                                                                        return updated;
                                                                                                    });
                                                                                                }}
                                                                                                className={`w-full px-2 py-0.5 border rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${isEmpty ? 'border-red-300 placeholder-red-300' : 'border-slate-200'}`}
                                                                                            />
                                                                                        )}

                                                                                        {/* Status */}
                                                                                        <span className="text-center">
                                                                                            {type === 'readonly'
                                                                                                ? (isEmpty ? '❌' : '✅')
                                                                                                : (isEmpty ? '⚠️' : '✅')
                                                                                            }
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}

                                                                            {/* Descrição */}
                                                                            <div className="px-3 py-2 border-b border-slate-100">
                                                                                <div className="flex items-center justify-between mb-1">
                                                                                    <span className="text-xs font-medium text-slate-700">Descrição</span>
                                                                                    <span className="text-xs text-slate-400 font-mono">descricaoComplementar</span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setProductDetails(prev => {
                                                                                            const updated = new Map(prev);
                                                                                            const cur = updated.get(p.id)!;
                                                                                            updated.set(p.id, { ...cur, _edited: !cur._edited });
                                                                                            return updated;
                                                                                        })}
                                                                                        className="text-xs text-blue-500 hover:underline ml-auto"
                                                                                    >
                                                                                        {detail._edited ? 'Ver preview' : 'Editar HTML'}
                                                                                    </button>
                                                                                </div>
                                                                                {detail._edited ? (
                                                                                    <textarea
                                                                                        defaultValue={detail.descricaoComplementar || detail.descricaoCurta || ''}
                                                                                        rows={4}
                                                                                        onChange={e => setProductDetails(prev => {
                                                                                            const updated = new Map(prev);
                                                                                            updated.set(p.id, { ...updated.get(p.id)!, descricaoComplementar: e.target.value });
                                                                                            return updated;
                                                                                        })}
                                                                                        placeholder="Sem descrição no Bling"
                                                                                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono bg-white focus:ring-1 focus:ring-blue-500"
                                                                                    />
                                                                                ) : (
                                                                                    <div
                                                                                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 prose prose-sm max-w-none"
                                                                                        dangerouslySetInnerHTML={{ __html: detail.descricaoComplementar || detail.descricaoCurta || '<span class="text-slate-400">Sem descrição no Bling</span>' }}
                                                                                    />
                                                                                )}
                                                                            </div>

                                                                            {/* Legenda */}
                                                                            <div className="px-3 py-1.5 flex gap-4 text-xs text-slate-400">
                                                                                <span>✅ Preenchido</span>
                                                                                <span>⚠️ Vazio — edite antes de importar</span>
                                                                                <span>❌ Indisponível no Bling</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}

                                                            </div>
                                                        );
                                                    })}
                                                    {filteredProducts.length === 0 && (
                                                        <p className="text-sm text-slate-400 text-center py-6">Nenhum produto encontrado.</p>
                                                    )}
                                                </div>
                                            </div>
                                            </div>
                                        )}

                                        {/* Import button */}
                                        {selectedIds.size > 0 && (
                                            <button
                                                onClick={handleImport}
                                                disabled={importing}
                                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                                            >
                                                {importing
                                                    ? <><Loader2 className="w-5 h-5 animate-spin" /> {productListFilter === 'imported' ? 'Sincronizando' : 'Importando'} {importProgress.current}/{importProgress.total}...</>
                                                    : <><Download className="w-5 h-5" /> {productListFilter === 'imported' ? 'Sincronizar' : 'Importar'} {selectedIds.size} produto{selectedIds.size !== 1 ? 's' : ''}</>}
                                            </button>
                                        )}

                                        {/* Progress bar */}
                                        {importing && importProgress.total > 0 && (
                                            <div className="w-full bg-slate-100 rounded-full h-2">
                                                <div
                                                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                                />
                                            </div>
                                        )}

                                        {/* Results */}
                                        {importResult && (
                                            <div className={`rounded-lg border p-4 space-y-3 ${importResult.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                                <p className="text-sm font-bold text-slate-700">Resultado da Importação</p>
                                                <div className="flex gap-6">
                                                    <div className="text-center">
                                                        <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                                                        <p className="text-xs text-slate-500">criados</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                                                        <p className="text-xs text-slate-500">atualizados</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-2xl font-bold text-red-500">{importResult.errors.length}</p>
                                                        <p className="text-xs text-slate-500">com erro</p>
                                                    </div>
                                                </div>
                                                {importResult.errors.length > 0 && (
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Detalhes dos Erros</p>
                                                            <div className="max-h-48 overflow-y-auto space-y-1.5">
                                                                {importResult.errors.map((e, i) => (
                                                                    <div key={i} className="bg-white border border-red-200 rounded-lg px-3 py-2">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <div className="min-w-0">
                                                                                <p className="text-xs font-semibold text-slate-800 truncate">{e.name}</p>
                                                                                {e.sku && <p className="text-xs text-slate-400">SKU: {e.sku}</p>}
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-xs text-red-600 mt-1">⚠️ {e.reason}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Re-import errors button */}
                                                        {importResult.errors.some((e: any) => e.id) && (
                                                            <button
                                                                onClick={() => {
                                                                    const idsToRetry = importResult.errors.filter((e: any) => e.id).map((e: any) => e.id as number);
                                                                    setSelectedIds(new Set(idsToRetry));
                                                                    setImportResult(null); // Clear previous results
                                                                }}
                                                                className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 transition-colors rounded-lg text-sm font-semibold"
                                                            >
                                                                <RefreshCw className="w-4 h-4" />
                                                                Tentar importar os {importResult.errors.length} com erro novamente
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ══════════════════════════════════════ */}
                    {/* TAB: MAPEAMENTOS                       */}
                    {/* ══════════════════════════════════════ */}
                    {activeTab === 'mappings' && (
                        <div className="space-y-4">
                            {/* Configurar campos a importar — movido da aba Produtos */}
                            {isConnected && (
                                <details open className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                    <summary className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer text-sm font-semibold text-slate-700 select-none hover:bg-slate-100">
                                        <span>⚙️ Configurar campos a importar</span>
                                        <span className="text-xs font-normal text-slate-400">{enabledFields.size} de {BLING_FIELD_MAPPINGS.length} campos ativos</span>
                                    </summary>
                                    <div className="p-4 space-y-4">
                                        {(['basico', 'preco', 'fiscal', 'fisico', 'midia'] as const).map(group => {
                                            const groupLabels: Record<string, string> = { basico: 'Dados Básicos', preco: 'Preços', fiscal: 'Fiscal (NCM/CEST)', fisico: 'Físico (Peso/Dim.)', midia: 'Mídia' };
                                            const fields = BLING_FIELD_MAPPINGS.filter(f => f.group === group);
                                            return (
                                                <div key={group}>
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{groupLabels[group]}</p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {fields.map(f => (
                                                            <label key={f.key} className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${enabledFields.has(f.key) ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 opacity-60'} ${f.required ? 'cursor-not-allowed' : ''}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={enabledFields.has(f.key)}
                                                                    disabled={f.required}
                                                                    onChange={() => {
                                                                        if (f.required) return;
                                                                        setEnabledFields(prev => {
                                                                            const next = new Set(prev);
                                                                            next.has(f.key) ? next.delete(f.key) : next.add(f.key);
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    className="mt-0.5 accent-green-600 flex-shrink-0"
                                                                />
                                                                <div>
                                                                    <p className="text-xs font-semibold text-slate-700">{f.label}</p>
                                                                    <p className="text-xs text-slate-400 font-mono">{f.blingField} → {f.localField}</p>
                                                                    {f.required && <p className="text-xs text-green-600">obrigatório</p>}
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </details>
                            )}
                            {!isConnected ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
                                    <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                                    <p className="font-semibold text-amber-800">Bling nao conectado</p>
                                    <p className="text-sm text-amber-700">Configure as credenciais na aba <strong>Configuracao</strong> primeiro.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Secao 1: Mapeamento de Categorias */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h2 className="text-base font-bold text-slate-800">Mapeamento de Categorias</h2>
                                                <p className="text-sm text-slate-500 mt-0.5">
                                                    Relacione cada categoria do Bling com uma categoria do sistema.
                                                </p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    setLoadingMappings(true);
                                                    try {
                                                        const cats = await fetchBlingCategories();
                                                        setBlingCategories(cats);
                                                        const existing = loadCategoryMappings();
                                                        const merged: CategoryMapping[] = [...existing];
                                                        for (const bc of cats) {
                                                            if (!merged.find(m => m.blingCategoryId === bc.id)) {
                                                                merged.push({ blingCategoryId: bc.id, blingCategoryName: bc.descricao, ourCategoryId: '', ourCategoryName: '' });
                                                            }
                                                        }
                                                        setCategoryMappings(merged);
                                                        toast.success(`${cats.length} categorias carregadas do Bling.`);
                                                    } catch (err: any) {
                                                        toast.error('Erro ao carregar categorias: ' + err.message);
                                                    } finally {
                                                        setLoadingMappings(false);
                                                    }
                                                }}
                                                disabled={loadingMappings}
                                                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex-shrink-0"
                                            >
                                                {loadingMappings ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                {loadingMappings ? 'Carregando...' : 'Carregar Categorias do Bling'}
                                            </button>
                                        </div>

                                        {categoryMappings.length === 0 && !loadingMappings && (
                                            <div className="text-center py-8 text-slate-400 text-sm">
                                                Clique em <strong>"Carregar Categorias do Bling"</strong> para comecar a mapear.
                                            </div>
                                        )}

                                        {categoryMappings.length > 0 && (
                                            <>
                                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-slate-50 border-b border-slate-200">
                                                            <tr>
                                                                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-1/2">Categoria no Bling</th>
                                                                <th className="text-center px-2 py-3 text-slate-400">-&gt;</th>
                                                                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-1/2">Categoria no Sistema</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {categoryMappings.map((mapping, idx) => (
                                                                <tr key={mapping.blingCategoryId} className="hover:bg-slate-50">
                                                                    <td className="px-4 py-3">
                                                                        <p className="font-medium text-slate-700">{mapping.blingCategoryName}</p>
                                                                        <p className="text-xs text-slate-400">ID Bling: {mapping.blingCategoryId}</p>
                                                                    </td>
                                                                    <td className="text-center text-slate-300 px-2">-&gt;</td>
                                                                    <td className="px-4 py-3">
                                                                        <select
                                                                            value={mapping.ourCategoryId}
                                                                            onChange={e => {
                                                                                const cat = categories.find(c => c.id === e.target.value);
                                                                                const updated = [...categoryMappings];
                                                                                updated[idx] = { ...mapping, ourCategoryId: e.target.value, ourCategoryName: cat?.name || '' };
                                                                                setCategoryMappings(updated);
                                                                            }}
                                                                            className={`w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent ${mapping.ourCategoryId ? 'border-green-300 bg-green-50' : 'border-slate-300 bg-white'}`}
                                                                        >
                                                                            <option value="">-- Sem mapeamento (usa padrao) --</option>
                                                                            {categoryTreeOptions.map(c => (
                                                                                <option key={c.id} value={c.id}>{`${'-- '.repeat(c.depth)}${c.path}`}</option>
                                                                            ))}
                                                                        </select>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs text-slate-500">
                                                        Produtos sem categoria mapeada usarao a Categoria padrao selecionada na aba Produtos.
                                                    </p>
                                                    <button
                                                        onClick={() => {
                                                            const valid = categoryMappings.filter(m => m.ourCategoryId);
                                                            saveCategoryMappings(valid);
                                                            toast.success(`${valid.length} mapeamentos salvos!`);
                                                        }}
                                                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                        Salvar Categorias
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* ── Seção: Mapeamento de Cores ── */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h2 className="text-base font-bold text-slate-800">🎨 Mapeamento de Cores</h2>
                                                <p className="text-sm text-slate-500 mt-0.5">
                                                    Relacione cada cor encontrada no Bling com uma cor do sistema.
                                                </p>
                                            </div>
                                        </div>

                                        {blingProducts.length === 0 ? (
                                            <div className="text-center py-6 text-slate-400 text-sm">
                                                Busque produtos na aba <strong>Produtos</strong> primeiro para extrair as cores do Bling.
                                            </div>
                                        ) : (() => {
                                            // Extrai cores únicas dos produtos carregados
                                            const uniqueColors = Array.from(new Set(
                                                blingProducts
                                                    .map(p => p.variacao?.nome)
                                                    .filter(Boolean)
                                                    .map(nome => nome!.split(';').find(p => p.toLowerCase().startsWith('cor'))?.split(':')[1]?.trim())
                                                    .filter(Boolean) as string[]
                                            )).sort();

                                            if (uniqueColors.length === 0) {
                                                return (
                                                    <div className="text-center py-6 text-slate-400 text-sm">
                                                        Nenhuma cor encontrada nos produtos carregados. Verifique se há variações com "Cor:" nos nomes.
                                                    </div>
                                                );
                                            }

                                            return (
                                                <>
                                                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                                <tr>
                                                                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-1/2">Cor no Bling</th>
                                                                    <th className="text-center px-2 py-3 text-slate-400">→</th>
                                                                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-1/2">Cor no Sistema</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {uniqueColors.map(blingColor => {
                                                                    const mapping = colorMappings.find(m => m.blingColorName.toLowerCase() === blingColor.toLowerCase());
                                                                    const idx = colorMappings.findIndex(m => m.blingColorName.toLowerCase() === blingColor.toLowerCase());
                                                                    const isMapped = !!mapping?.systemColorId;
                                                                    return (
                                                                        <tr key={blingColor} className="hover:bg-slate-50">
                                                                            <td className="px-4 py-3">
                                                                                <p className="font-medium text-slate-700">{blingColor}</p>
                                                                            </td>
                                                                            <td className="text-center text-slate-300 px-2">→</td>
                                                                            <td className="px-4 py-3 space-y-1">
                                                                                <select
                                                                                    value={mapping?.systemColorId || ''}
                                                                                    onChange={e => {
                                                                                        const col = systemColors.find(c => c.id === e.target.value);
                                                                                        const updated = [...colorMappings];
                                                                                        if (idx >= 0) {
                                                                                            updated[idx] = { blingColorName: blingColor, systemColorId: e.target.value, systemColorName: col?.name || '' };
                                                                                        } else {
                                                                                            updated.push({ blingColorName: blingColor, systemColorId: e.target.value, systemColorName: col?.name || '' });
                                                                                        }
                                                                                        setColorMappings(updated);
                                                                                    }}
                                                                                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent ${isMapped ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}
                                                                                >
                                                                                    <option value="">-- Sem mapeamento --</option>
                                                                                    {systemColors.map(c => (
                                                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                                                    ))}
                                                                                </select>
                                                                                {!isMapped && (
                                                                                    <p className="text-xs text-amber-600">
                                                                                        ⚠️ Cor não mapeada.{' '}
                                                                                        <a href="/admin/cores" className="underline font-medium hover:text-amber-800">Cadastrar nova cor</a>
                                                                                        {' '}e volte aqui para mapear.
                                                                                    </p>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs text-slate-500">
                                                            {colorMappings.filter(m => m.systemColorId).length} de {uniqueColors.length} cores mapeadas.
                                                        </p>
                                                        <button
                                                            onClick={() => {
                                                                const valid = colorMappings.filter(m => m.systemColorId);
                                                                saveColorMappings(valid);
                                                                toast.success(`${valid.length} mapeamentos de cor salvos!`);
                                                            }}
                                                            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                                                        >
                                                            <Save className="w-4 h-4" />
                                                            Salvar Cores
                                                        </button>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    {/* Secao 2: Mapeamento de Campos */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h2 className="text-base font-bold text-slate-800">Mapeamento de Campos</h2>
                                                <p className="text-sm text-slate-500 mt-0.5">
                                                    Configure qual campo do Bling alimenta qual campo do sistema.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const defaults = getDefaultFieldMappings();
                                                    setFieldMappings(defaults);
                                                    saveFieldMappings(defaults);
                                                    toast.success('Mapeamentos restaurados.');
                                                }}
                                                className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 flex-shrink-0"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                Restaurar Padrao
                                            </button>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 border-b border-slate-200">
                                                    <tr>
                                                        <th className="text-center px-3 py-3 font-semibold text-slate-600 w-10">Ativo</th>
                                                        <th className="text-left px-4 py-3 font-semibold text-slate-600 w-2/5">Campo no Bling</th>
                                                        <th className="text-center px-2 py-3 text-slate-400 w-8">-</th>
                                                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Campo no Sistema</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {fieldMappings.map((mapping, idx) => (
                                                        <tr key={mapping.blingKey} className={`hover:bg-slate-50 ${!mapping.enabled ? 'opacity-50' : ''}`}>
                                                            <td className="px-3 py-2.5 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={mapping.enabled}
                                                                    onChange={e => {
                                                                        const updated = [...fieldMappings];
                                                                        updated[idx] = { ...mapping, enabled: e.target.checked };
                                                                        setFieldMappings(updated);
                                                                    }}
                                                                    className="w-4 h-4 accent-green-600"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <p className="font-medium text-slate-700">{mapping.blingLabel}</p>
                                                                <p className="text-xs text-slate-400 font-mono">{mapping.blingField}</p>
                                                            </td>
                                                            <td className="text-center text-slate-300 px-2">-</td>
                                                            <td className="px-4 py-2.5">
                                                                <select
                                                                    value={mapping.systemField}
                                                                    disabled={!mapping.enabled}
                                                                    onChange={e => {
                                                                        const updated = [...fieldMappings];
                                                                        updated[idx] = { ...mapping, systemField: e.target.value };
                                                                        setFieldMappings(updated);
                                                                    }}
                                                                    className={`w-full text-sm border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed ${mapping.systemField ? 'border-green-300 bg-green-50' : 'border-slate-300 bg-white'}`}
                                                                >
                                                                    <option value="">-- Nao importar --</option>
                                                                    {Object.entries(
                                                                        SYSTEM_FIELDS.reduce((acc, f) => {
                                                                            if (!acc[f.group]) acc[f.group] = [];
                                                                            acc[f.group].push(f);
                                                                            return acc;
                                                                        }, {} as Record<string, typeof SYSTEM_FIELDS>)
                                                                    ).map(([group, fields]) => (
                                                                        <optgroup key={group} label={group}>
                                                                            {fields.map(f => (
                                                                                <option key={f.field} value={f.field}>{f.label}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => {
                                                    saveFieldMappings(fieldMappings);
                                                    toast.success('Mapeamentos de campos salvos!');
                                                }}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                                            >
                                                <Save className="w-4 h-4" />
                                                Salvar Mapeamentos de Campos
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {/* ════════════════════════════════════ */}
                    {/* TAB: WEBHOOK                         */}
                    {/* ════════════════════════════════════ */}
                    {activeTab === 'webhook' && (() => {
                        const webhookUrl = `${window.location.origin}/api/bling?resource=webhook`;

                        async function testWebhookPing() {
                            setTestingWebhook(true);
                            setWebhookTestResult(null);
                            try {
                                const res = await fetch('/api/bling?resource=webhook');
                                if (res.ok) {
                                    setWebhookTestResult({ ok: true, message: 'Endpoint respondeu com 200 — URL válida!' });
                                } else {
                                    setWebhookTestResult({ ok: false, message: `Endpoint retornou ${res.status}` });
                                }
                            } catch (e: any) {
                                setWebhookTestResult({ ok: false, message: 'Erro de rede: ' + e.message });
                            } finally {
                                setTestingWebhook(false);
                            }
                        }

                        async function checkBlingIds() {
                            setCheckingBlingIds(true);
                            setBlingIdStats(null);
                            setProductsWithoutId([]);
                            try {
                                const { data, error } = await supabase
                                    .from('products')
                                    .select('id, name, sku, bling_id');
                                if (error) throw error;
                                const total = data?.length || 0;
                                const withId = data?.filter((p: any) => p.bling_id) || [];
                                const withoutId = data?.filter((p: any) => !p.bling_id) || [];
                                setBlingIdStats({ total, with_id: withId.length, without_id: withoutId.length });
                                setProductsWithoutId(withoutId.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku })));
                            } catch (e: any) {
                                toast.error('Erro ao checar bling_id: ' + e.message);
                            } finally {
                                setCheckingBlingIds(false);
                            }
                        }

                        async function reimportProduct(productId: string, sku: string | null, name: string) {
                            if (!sku && !name) { toast.error('Produto sem SKU ou nome para buscar no Bling'); return; }
                            setReimportingIds(prev => new Set([...prev, productId]));
                            setReimportResults(prev => { const m = new Map(prev); m.delete(productId); return m; });
                            try {
                                const query = sku || name;
                                const results = await searchBlingProducts(query);
                                const match = results.find(p => (sku && p.codigo === sku) || p.nome.toLowerCase() === name.toLowerCase()) || results[0];
                                if (!match) {
                                    setReimportResults(prev => new Map(prev).set(productId, { ok: false, message: 'Produto não encontrado no Bling' }));
                                    return;
                                }
                                // atualiza o bling_id diretamente
                                const { error } = await supabase.from('products').update({ bling_id: match.id }).eq('id', productId);
                                if (error) throw error;
                                setReimportResults(prev => new Map(prev).set(productId, { ok: true, message: `bling_id ${match.id} vinculado` }));
                                setProductsWithoutId(prev => prev.filter(p => p.id !== productId));
                                setBlingIdStats(prev => prev ? { ...prev, with_id: prev.with_id + 1, without_id: prev.without_id - 1 } : prev);
                            } catch (e: any) {
                                setReimportResults(prev => new Map(prev).set(productId, { ok: false, message: e.message }));
                            } finally {
                                setReimportingIds(prev => { const s = new Set(prev); s.delete(productId); return s; });
                            }
                        }

                        async function reimportAll() {
                            setReimportingAll(true);
                            for (const p of productsWithoutId) {
                                await reimportProduct(p.id, p.sku, p.name);
                            }
                            setReimportingAll(false);
                            toast.success('Reimportação em massa concluída!');
                        }

                        async function loadWebhookLogs() {
                            setLoadingLogs(true);
                            try {
                                const res = await fetch('/api/bling?resource=webhook-logs');
                                const json = await res.json();
                                setLogsTableExists(json.tableExists ?? false);
                                setWebhookLogs(json.logs || []);
                            } catch (e: any) {
                                toast.error('Erro ao carregar logs: ' + e.message);
                            } finally {
                                setLoadingLogs(false);
                            }
                        }

                        return (
                            <div className="space-y-4">

                                {/* URL do Webhook */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
                                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-blue-600" />
                                        URL do Webhook do Bling
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        Configure esta URL no seu app Bling em <strong>Configurar &rarr; Webhooks &rarr; Servidores</strong>,
                                        depois marque os eventos de <strong>nome, estoque e valor</strong> conforme checklist abaixo.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono text-slate-800 break-all">
                                            {webhookUrl}
                                        </code>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada!'); }}
                                            className="flex-shrink-0 p-3 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={testWebhookPing}
                                        disabled={testingWebhook}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {testingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                        {testingWebhook ? 'Testando...' : 'Testar Endpoint'}
                                    </button>
                                    {webhookTestResult && (
                                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                                            webhookTestResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                                        }`}>
                                            {webhookTestResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                            {webhookTestResult.message}
                                        </div>
                                    )}
                                </div>

                                {/* Checklist de configuração */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
                                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        <Info className="w-5 h-5 text-amber-500" />
                                        Checklist de Configuração
                                    </h2>
                                    <ul className="space-y-3 text-sm">
                                        {[
                                            { label: 'URL do webhook cadastrada no Bling (Aplicativo → Webhooks → Servidores)', tip: 'Use a URL acima. O Bling faz um GET de verificação, então ela precisa responder 200.' },
                                            { label: 'Webhook de estoque habilitado (stock.updated / virtual_stock.updated / movimentacaoEstoque)', tip: 'Sem os eventos de estoque, não há baixa automática na loja.' },
                                            { label: 'Webhook de nome habilitado (product.updated / produto)', tip: 'Sem evento de produto, mudanças de nome no Bling não refletem na loja.' },
                                            { label: 'Webhook de valor habilitado (product.updated com preço)', tip: 'Sem evento de produto/preço, alterações de valor no Bling não sincronizam.' },
                                            { label: 'Versão do payload: versão 1 (formato recomendado)', tip: 'O sistema suporta v3 (event em inglês) e legado em português.' },
                                            { label: 'App Bling tem escopo de Estoques habilitado', tip: 'Sem esse escopo, o recurso de Webhook de Estoque não aparece nas opções.' },
                                            { label: 'Produto importado pelo Bling (tem bling_id salvo)', tip: 'Produtos criados manualmente não têm bling_id — o webhook não consegue associá-los.' },
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                                <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                                                <div>
                                                    <p className="font-medium text-slate-800">{item.label}</p>
                                                    <p className="text-slate-500 text-xs mt-0.5">{item.tip}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Verificar e reimportar bling_id */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                            <Package className="w-5 h-5 text-green-600" />
                                            Vincular Bling ID nos Produtos
                                        </h2>
                                        {productsWithoutId.length > 0 && (
                                            <button
                                                onClick={reimportAll}
                                                disabled={reimportingAll || !isConnected}
                                                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
                                            >
                                                {reimportingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                {reimportingAll ? 'Vinculando todos...' : `Vincular todos (${productsWithoutId.length})`}
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        O webhook só atualiza produtos que têm um <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">bling_id</code> salvo.
                                        Use os botões abaixo para vincular produtos pelo SKU automaticamente.
                                    </p>
                                    <button
                                        onClick={checkBlingIds}
                                        disabled={checkingBlingIds}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {checkingBlingIds ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        {checkingBlingIds ? 'Verificando...' : 'Verificar Produtos'}
                                    </button>

                                    {blingIdStats && (
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                <p className="text-2xl font-bold text-slate-800">{blingIdStats.total}</p>
                                                <p className="text-xs text-slate-500 mt-1">Total de produtos</p>
                                            </div>
                                            <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                                                <p className="text-2xl font-bold text-green-700">{blingIdStats.with_id}</p>
                                                <p className="text-xs text-green-600 mt-1">Com Bling ID ✓</p>
                                            </div>
                                            <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-200">
                                                <p className="text-2xl font-bold text-amber-700">{blingIdStats.without_id}</p>
                                                <p className="text-xs text-amber-600 mt-1">Sem Bling ID ⚠</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Lista de produtos sem bling_id */}
                                    {productsWithoutId.length > 0 && (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs font-semibold text-amber-800">
                                                Produtos sem Bling ID — clique em "Vincular" para buscar no Bling pelo SKU
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {productsWithoutId.map(p => {
                                                    const isLoading = reimportingIds.has(p.id);
                                                    const result = reimportResults.get(p.id);
                                                    return (
                                                        <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                                                                <p className="text-xs text-slate-400">{p.sku ? `SKU: ${p.sku}` : 'Sem SKU'}</p>
                                                                {result && (
                                                                    <p className={`text-xs font-medium mt-0.5 ${result.ok ? 'text-green-600' : 'text-red-500'}`}>
                                                                        {result.ok ? '✓' : '✗'} {result.message}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => reimportProduct(p.id, p.sku, p.name)}
                                                                disabled={isLoading || reimportingAll || !isConnected}
                                                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                                                            >
                                                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                                                {isLoading ? 'Vinculando...' : 'Vincular'}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {blingIdStats && blingIdStats.without_id === 0 && (
                                        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                                            <CheckCircle className="w-4 h-4" />
                                            Todos os produtos estão vinculados ao Bling ID!
                                        </div>
                                    )}
                                </div>


                                {/* Formato do payload */}
                                <div className="bg-slate-800 rounded-xl p-5 space-y-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Formato esperado do payload (Bling v3 - Versão 1)</p>
                                    <pre className="text-xs text-green-400 overflow-auto">{JSON.stringify({
                                        eventId: "abc-123",
                                        event: "stock.updated",
                                        companyId: "...",
                                        data: {
                                            produto: { id: 12345678 },
                                            deposito: { id: 12345678, saldoFisico: 1250.75, saldoVirtual: 1250.75 },
                                            operacao: "E",
                                            quantidade: 26,
                                            saldoFisicoTotal: 1500.75,
                                            saldoVirtualTotal: 1500.75,
                                        }
                                    }, null, 2)}</pre>
                                </div>

                                {/* Logs do webhook em tempo real */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-blue-600" />
                                            Logs do Webhook (últimos eventos recebidos)
                                        </h2>
                                        <button
                                            onClick={loadWebhookLogs}
                                            disabled={loadingLogs}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {loadingLogs ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                            {loadingLogs ? 'Carregando...' : 'Carregar Logs'}
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Se esta lista estiver vazia após uma movimentação de estoque no Bling, significa que o webhook <strong>não está configurado</strong> no painel do Bling.
                                    </p>

                                    {logsTableExists === false && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                                            <p className="text-sm font-semibold text-red-700">⚠️ Tabela webhook_logs não existe no Supabase</p>
                                            <p className="text-xs text-red-600">Execute o SQL abaixo no Supabase → SQL Editor:</p>
                                            <pre className="text-xs bg-slate-900 text-green-400 rounded-lg p-3 overflow-auto">{`CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT,
  payload JSONB,
  received_at TIMESTAMPTZ DEFAULT now()
);`}</pre>
                                        </div>
                                    )}

                                    {webhookLogs !== null && logsTableExists && webhookLogs.length === 0 && (
                                        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            Nenhum evento recebido ainda. Configure o webhook no painel do Bling e faça uma movimentação de estoque para testar.
                                        </div>
                                    )}

                                    {webhookLogs !== null && webhookLogs.length > 0 && (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-xs font-semibold text-green-800">
                                                ✓ {webhookLogs.length} evento(s) recebido(s) — Bling está chamando o servidor
                                            </div>
                                            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                                                {webhookLogs.map((log, i) => {
                                                    const evt = log.payload?.event || log.payload?.evento || 'desconhecido';
                                                    const blingId = log.payload?.data?.produto?.id;
                                                    const saldo = log.payload?.data?.saldoFisicoTotal;
                                                    const updated = log.payload?.updated;
                                                    return (
                                                        <div key={log.id || i} className="px-4 py-3 text-xs space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-semibold text-slate-800">{evt}</span>
                                                                <span className="text-slate-400">{new Date(log.received_at).toLocaleString('pt-BR')}</span>
                                                            </div>
                                                            <div className="flex gap-4 text-slate-500">
                                                                {blingId && <span>produto.id: <strong className="text-slate-700">{blingId}</strong></span>}
                                                                {saldo !== undefined && <span>saldoFisicoTotal: <strong className="text-slate-700">{saldo}</strong></span>}
                                                                {updated !== undefined && (
                                                                    <span className={updated ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                                                                        {updated ? '✓ produto atualizado' : '✗ produto NÃO encontrado'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Arquitetura & Solução de Problemas (Bling -> VPS) */}
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
                                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5 text-green-600" />
                                        Arquitetura &amp; Solução de Problemas (Bling ↔ VPS)
                                    </h2>
                                    <p className="text-sm text-slate-600">
                                        Este guia documenta o fluxo de fallback e auto-recuperação do Webhook, 
                                        implementado para manter nome e estoque sincronizados entre o Bling ERP e a VPS MySQL.
                                    </p>

                                    <div className="space-y-4">
                                        {/* Ponto 1: Token Recovery */}
                                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 mb-2">
                                                <RefreshCw className="w-4 h-4 text-blue-500" />
                                                1. Renovação Automática de Token (Failover)
                                            </h3>
                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                O token do Bling expira naturalmente. O Webhook detecta a expiração (falha com HTTP 401) e executa um fluxo de <code>refresh_token</code> utilizando as credenciais (Client ID e Secret) registradas nesta página. O novo token é automaticamente renovado e gravado no Supabase para continuar processando eventos sem interferência manual.
                                            </p>
                                        </div>

                                        {/* Ponto 2: Resolução de SKU / Fonte da Verdade */}
                                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 mb-2">
                                                <Search className="w-4 h-4 text-amber-500" />
                                                2. Resolução de SKU via VPS (Fonte da Verdade)
                                            </h3>
                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                Durante eventos de webhook (ex: <code>stock.created</code>, <code>product.updated</code>), o SKU nem sempre é transmitido ou confiável. Em vez de depender do payload ou Supabase de forma isolada, o webhook faz uma chamada direta para a API da VPS <code>/products/bling/{"{bling_id}"}</code>. Isso garante compatibilidade total com o catálogo local hospedado no MySQL.
                                            </p>
                                        </div>

                                        {/* Ponto 3: Endpoint PATCH Name */}
                                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 mb-2">
                                                <Package className="w-4 h-4 text-green-600" />
                                                3. Sincronização de Nomes e Estoque (server.js)
                                            </h3>
                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                O webhook também captura edições gerais de produtos (<code>product.updated</code>). Um endpoint novo na VPS (<code>PATCH /products/name</code>) foi adicionado em <code>/var/www/mdv-api/server.js</code> para lidar com esse ciclo. Ou seja, ao modificar um Título no Bling, a mudança reflete em tempo real no banco MySQL e também é persistida.
                                            </p>
                                        </div>

                                        {/* Troubleshooting */}
                                        <div className="bg-red-50 p-4 rounded-lg border border-red-200 mt-4 shadow-sm">
                                            <h3 className="font-semibold text-red-800 text-sm flex items-center gap-2 mb-2">
                                                <AlertCircle className="w-4 h-4" />
                                                Em Caso de Quebra de Sincronização (Troubleshooting)
                                            </h3>
                                            <ul className="text-xs text-red-700 list-disc list-inside space-y-2 leading-relaxed">
                                                <li><strong>O Estoque parou de atualizar:</strong> Vá no painel do Bling → <em>Integrações → Webhooks</em>. Certifique-se de que a URL não foi "Desativada" por limite de retentativas. Caso haja travamento, ative novamente por lá.</li>
                                                <li><strong>Erro de Token Expirado (Unauthorized):</strong> Verifique se o <strong>Client ID</strong> e o <strong>Client Secret</strong> estão preenchidos na aba Configurações. Crie a conexão manual usando o botão "Reconectar com Bling".</li>
                                                <li><strong>Logs falhos na VPS:</strong> Se o webhook na Vercel relatar Timeout ou falha de acesso à VPS, acesse a nuvem Hostinger via Terminal SSH e confira o funcionamento do Node. Digite <code>pm2 logs mdv-api</code>. Caso note falhas no banco mysql, restarte via <code>pm2 restart mdv-api</code>.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    )
}


