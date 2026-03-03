import React, { useState, useEffect } from 'react';
import {
    Settings, Package, Save, Eye, EyeOff, CheckCircle, AlertCircle,
    Copy, ExternalLink, Download, Loader2, Search, RefreshCw, Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../services/supabase';
import { fetchAllBlingProducts, searchBlingProducts, importBlingProducts, fetchBlingCategories, fetchBlingProductDetail, BlingProduct, BlingProductDetail, BlingCategory, CategoryMapping, ImportResult, BLING_FIELD_MAPPINGS, DEFAULT_ENABLED_FIELDS, loadCategoryMappings, saveCategoryMappings } from '../../../services/blingService';
import { categoryService } from '../../../services/categories';
import { Category } from '../../../types/category';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface BlingCredentials {
    bling_client_id: string;
    bling_client_secret: string;
    bling_callback_url: string;
}

type Tab = 'config' | 'products' | 'mappings';

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
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [productSearch, setProductSearch] = useState('');
    const [blingSearch, setBlingSearch] = useState('');
    const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set(DEFAULT_ENABLED_FIELDS));
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [cacheInfo, setCacheInfo] = useState<{ timestamp: number } | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [importCategoryId, setImportCategoryId] = useState('');

    // ── Mappings ──
    const [blingCategories, setBlingCategories] = useState<BlingCategory[]>([]);
    const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>(loadCategoryMappings);
    const [loadingMappings, setLoadingMappings] = useState(false);

    // ── Product detail preview ──
    const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
    const [productDetails, setProductDetails] = useState<Map<number, BlingProductDetail>>(new Map());
    const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);

    // ─────────────────────────────────────────────────────
    // Load
    // ─────────────────────────────────────────────────────

    useEffect(() => {
        loadCredentials();
        categoryService.list().then(cats => {
            setCategories(cats);
            if (cats.length > 0) setImportCategoryId(cats[0].id);
        }).catch(() => { });

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

        const callbackUrl = credentials.bling_callback_url.trim() || `${window.location.origin}/admin/settings/bling/callback`;
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
            const activeIds = new Set(products.filter(p => p.situacao === 'A').map(p => p.id));
            setSelectedIds(activeIds);
        } catch (err: any) {
            toast.error('Erro ao buscar produtos: ' + err.message);
        } finally {
            setFetching(false);
        }
    }

    async function handleImport() {
        const toImport = blingProducts.filter(p => selectedIds.has(p.id));
        if (toImport.length === 0) { toast.error('Selecione ao menos um produto.'); return; }
        if (!importCategoryId) { toast.error('Selecione uma categoria padrão para importação.'); return; }

        setImporting(true);
        setImportResult(null);
        setImportProgress({ current: 0, total: toImport.length });

        try {
            const result = await importBlingProducts(toImport, enabledFields, importCategoryId, (current, total) => {
                setImportProgress({ current, total });
            });
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

    const filteredProducts = blingProducts.filter(p =>
        !productSearch ||
        p.nome.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.codigo || '').toLowerCase().includes(productSearch.toLowerCase())
    );

    function toggleSelectAll() {
        const allSelected = filteredProducts.every(p => selectedIds.has(p.id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            filteredProducts.forEach(p => allSelected ? next.delete(p.id) : next.add(p.id));
            return next;
        });
    }

    // ─────────────────────────────────────────────────────
    // Derived
    // ─────────────────────────────────────────────────────

    const tokenExpired = tokenExpiresAt ? new Date(tokenExpiresAt) < new Date() : false;

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
        <div className="max-w-3xl mx-auto space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-green-700" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Integração Bling</h1>
                    <p className="text-sm text-slate-500">Conecte e sincronize seus produtos com o Bling ERP</p>
                </div>
                {isConnected && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {tokenExpired ? 'Token expirado' : 'Conectado'}
                    </span>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('config')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'config'
                        ? 'border-green-600 text-green-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Settings className="w-4 h-4" />
                    Configuração
                </button>
                <button
                    onClick={() => setActiveTab('products')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'products'
                        ? 'border-green-600 text-green-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Package className="w-4 h-4" />
                    Produtos
                    {blingProducts.length > 0 && (
                        <span className="ml-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {blingProducts.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('mappings')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'mappings'
                        ? 'border-green-600 text-green-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <ArrowRight className="w-4 h-4" />
                    Mapeamentos
                    {categoryMappings.length > 0 && (
                        <span className="ml-1 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {categoryMappings.length}
                        </span>
                    )}
                </button>
            </div>

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

                    {/* Escopos */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-blue-800 mb-2">📋 Escopos necessários no app Bling</p>
                        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                            <li><strong>Produtos</strong> — leitura e escrita</li>
                            <li><strong>Estoques</strong> — leitura de saldos por depósito</li>
                        </ul>
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
                                <div className={`flex items-center gap-3 p-3 rounded-xl border ${!importCategoryId ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                                    <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">📂 Categoria padrão:</label>
                                    <select
                                        value={importCategoryId}
                                        onChange={e => setImportCategoryId(e.target.value)}
                                        className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    >
                                        <option value="">-- Selecione uma categoria --</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Field selection */}
                                <details open className="border border-slate-200 rounded-xl overflow-hidden">
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

                                {/* Search bar */}
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
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={blingSearch}
                                            onChange={e => setBlingSearch(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleFetchBlingProducts()}
                                            placeholder="Pesquisar produto no Bling (nome ou SKU)..."
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

                                {/* Product list */}
                                {blingProducts.length > 0 && (
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
                                            <button onClick={toggleSelectAll} className="text-xs text-blue-600 hover:underline font-medium whitespace-nowrap ml-2">
                                                {filteredProducts.every(p => selectedIds.has(p.id)) ? 'Desmarcar' : 'Todos'}
                                            </button>
                                        </div>
                                        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                                            {filteredProducts.map(p => {
                                                const isExpanded = expandedProductId === p.id;
                                                const detail = productDetails.get(p.id);
                                                const isLoadingDetail = loadingDetailId === p.id;
                                                const displayProduct = detail || p;
                                                return (
                                                    <div key={p.id} className="border-b border-slate-100 last:border-0">
                                                        {/* Summary row */}
                                                        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.has(p.id)}
                                                                onChange={() => toggleSelect(p.id)}
                                                                className="w-4 h-4 accent-green-600 flex-shrink-0"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-slate-800 truncate">{displayProduct.nome}</p>
                                                                <p className="text-xs text-slate-400">
                                                                    {displayProduct.codigo ? `SKU: ${displayProduct.codigo}` : ''}
                                                                    {displayProduct.gtin ? ` · EAN: ${displayProduct.gtin}` : ''}
                                                                    {displayProduct.marca ? ` · ${displayProduct.marca}` : ''}
                                                                </p>
                                                            </div>
                                                            <div className="text-right flex-shrink-0 mr-1">
                                                                {displayProduct.preco != null && (
                                                                    <p className="text-sm font-semibold text-slate-700">R$ {displayProduct.preco.toFixed(2).replace('.', ',')}</p>
                                                                )}
                                                                <p className={`text-xs font-medium ${displayProduct.stock_quantity > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                                    {detail ? displayProduct.stock_quantity : p.stock_quantity} estoque
                                                                </p>
                                                                <span className={`text-xs font-medium ${displayProduct.situacao === 'A' ? 'text-green-600' : 'text-slate-400'}`}>
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

                                                        {/* Expandable detail panel */}
                                                        {isExpanded && detail && (
                                                            <div className="mx-4 mb-3 border border-slate-200 rounded-xl bg-slate-50 p-4 space-y-3">
                                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dados do Bling — edite antes de importar</p>
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-sm">
                                                                    {[
                                                                        { label: 'Nome', field: 'nome', type: 'text' },
                                                                        { label: 'SKU (código)', field: 'codigo', type: 'text' },
                                                                        { label: 'EAN/GTIN', field: 'gtin', type: 'text' },
                                                                        { label: 'Marca', field: 'marca', type: 'text' },
                                                                        { label: 'Categoria Bling', field: 'categoria_nome', type: 'readonly' },
                                                                        { label: 'Situação', field: 'situacao', type: 'readonly' },
                                                                        { label: 'Preço venda (R$)', field: 'preco', type: 'number' },
                                                                        { label: 'Preço custo (R$)', field: 'precoCusto', type: 'number' },
                                                                        { label: 'Estoque', field: 'stock_quantity', type: 'number' },
                                                                        { label: 'NCM', field: 'ncm', type: 'text' },
                                                                        { label: 'CEST', field: 'cest', type: 'text' },
                                                                        { label: 'Origem', field: 'origem', type: 'number' },
                                                                        { label: 'Peso bruto (kg)', field: 'pesoBruto', type: 'number' },
                                                                        { label: 'Larg. (cm)', field: 'largura', type: 'number' },
                                                                        { label: 'Alt. (cm)', field: 'altura', type: 'number' },
                                                                        { label: 'Prof. (cm)', field: 'profundidade', type: 'number' },
                                                                    ].map(({ label, field, type }) => {
                                                                        const rawVal = field === 'categoria_nome'
                                                                            ? (detail.categoria?.descricao || '—')
                                                                            : (detail as any)[field];
                                                                        const val = rawVal ?? '';
                                                                        return (
                                                                            <div key={field}>
                                                                                <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                                                                                {type === 'readonly' ? (
                                                                                    <p className="text-sm text-slate-700 font-medium">{val || '—'}</p>
                                                                                ) : (
                                                                                    <input
                                                                                        type={type}
                                                                                        defaultValue={val}
                                                                                        onChange={e => {
                                                                                            const newVal = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                                                                                            setProductDetails(prev => {
                                                                                                const updated = new Map(prev);
                                                                                                const cur = updated.get(p.id)!;
                                                                                                updated.set(p.id, { ...cur, [field]: newVal });
                                                                                                return updated;
                                                                                            });
                                                                                        }}
                                                                                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                {detail.descricaoComplementar && (
                                                                    <div>
                                                                        <p className="text-xs text-slate-400 mb-0.5">Descrição</p>
                                                                        <textarea
                                                                            defaultValue={detail.descricaoComplementar}
                                                                            rows={2}
                                                                            onChange={e => setProductDetails(prev => {
                                                                                const updated = new Map(prev);
                                                                                updated.set(p.id, { ...updated.get(p.id)!, descricaoComplementar: e.target.value });
                                                                                return updated;
                                                                            })}
                                                                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {filteredProducts.length === 0 && (
                                                <p className="text-sm text-slate-400 text-center py-6">Nenhum produto encontrado.</p>
                                            )}
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
                                            ? <><Loader2 className="w-5 h-5 animate-spin" /> Importando {importProgress.current}/{importProgress.total}...</>
                                            : <><Download className="w-5 h-5" /> Importar {selectedIds.size} produto{selectedIds.size !== 1 ? 's' : ''}</>}
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
                    {!isConnected ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
                            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                            <p className="font-semibold text-amber-800">Bling não conectado</p>
                            <p className="text-sm text-amber-700">Configure as credenciais na aba <strong>Configuração</strong> primeiro.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">Mapeamento de Categorias</h2>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        Relacione cada categoria do Bling com uma categoria do sistema. Produtos importados serão classificados automaticamente.
                                    </p>
                                </div>
                                <button
                                    onClick={async () => {
                                        setLoadingMappings(true);
                                        try {
                                            const cats = await fetchBlingCategories();
                                            setBlingCategories(cats);
                                            // Inicializa mapeamentos para novas categorias que ainda não têm mapeamento
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
                                    Clique em <strong>"Carregar Categorias do Bling"</strong> para começar a mapear.
                                </div>
                            )}

                            {categoryMappings.length > 0 && (
                                <>
                                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-1/2">Categoria no Bling</th>
                                                    <th className="text-center px-2 py-3 text-slate-400">→</th>
                                                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-1/2">Categoria no Sistema</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {categoryMappings.map((mapping, idx) => (
                                                    <tr key={mapping.blingCategoryId} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">
                                                            <div>
                                                                <p className="font-medium text-slate-700">{mapping.blingCategoryName}</p>
                                                                <p className="text-xs text-slate-400">ID Bling: {mapping.blingCategoryId}</p>
                                                            </div>
                                                        </td>
                                                        <td className="text-center text-slate-300 px-2">→</td>
                                                        <td className="px-4 py-3">
                                                            <select
                                                                value={mapping.ourCategoryId}
                                                                onChange={e => {
                                                                    const cat = categories.find(c => c.id === e.target.value);
                                                                    const updated = [...categoryMappings];
                                                                    updated[idx] = {
                                                                        ...mapping,
                                                                        ourCategoryId: e.target.value,
                                                                        ourCategoryName: cat?.name || '',
                                                                    };
                                                                    setCategoryMappings(updated);
                                                                }}
                                                                className={`w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent ${mapping.ourCategoryId ? 'border-green-300 bg-green-50' : 'border-slate-300 bg-white'}`}
                                                            >
                                                                <option value="">-- Sem mapeamento (usa padrão) --</option>
                                                                {categories.map(c => (
                                                                    <option key={c.id} value={c.id}>{c.name}</option>
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
                                            💡 Produtos sem categoria mapeada usarão a "Categoria padrão" selecionada na aba Produtos.
                                        </p>
                                        <button
                                            onClick={() => {
                                                const valid = categoryMappings.filter(m => m.ourCategoryId);
                                                saveCategoryMappings(valid);
                                                setCategoryMappings(categoryMappings); // força re-render
                                                toast.success(`${valid.length} mapeamentos salvos!`);
                                            }}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                                        >
                                            <Save className="w-4 h-4" />
                                            Salvar Mapeamentos
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
