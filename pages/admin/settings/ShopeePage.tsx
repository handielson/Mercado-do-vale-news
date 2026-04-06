import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Store, Save, ExternalLink, RefreshCw, Key, ShieldCheck, AlertCircle,
    Package, Search, ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
    Upload, Check, X, Loader2, Tag, Download, Calculator, ShoppingBag, Printer, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { getCompanyData, saveCompanyData } from '../../../services/companyService';
import { supabase } from '../../../services/supabase';
import { vpsApiService } from '../../../services/vpsApiService';
import { Company } from '../../../types/company';
import ShopeeOrdersTab from './components/ShopeeOrdersTab';
import ShopeePrintersTab from './components/ShopeePrintersTab';
import ShopeeFinanceTab from './components/ShopeeFinanceTab';
import { NcmSearchWidget } from '../../../components/admin/NcmSearchWidget';
import { InmetroWidget } from '../../../components/admin/InmetroWidget';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ShopeeProduct {
    id: string;
    product_id: string;
    shopee_item_id: number | null;
    shopee_category_id: number | null;
    shopee_category_name: string | null;
    shopee_price: number | null;
    status: 'active' | 'inactive' | 'not_synced';
    last_synced_at: string | null;
    // joined from products table
    name?: string;
    sku?: string;
    images?: string[];
    price_retail?: number;
    price_cost?: number;
    category_slug?: string;
    inmetro_certificate?: string;
    ncm?: string;
}

interface LocalProduct {
    id: string;
    name: string;
    sku: string;
    images: string[];
    price_retail: number;
    price_cost: number;
    category_slug: string;
    inmetro_certificate?: string;
    ncm?: string;
}

type Tab = 'config' | 'products' | 'orders' | 'finance' | 'printers';
type Filter = 'all' | 'synced' | 'not_synced' | 'inactive';

// ─── Helper ───────────────────────────────────────────────────────────────────
const fmt = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);

const StatusBadge = ({ status }: { status: ShopeeProduct['status'] }) => {
    if (status === 'active')
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">🟢 Ativo</span>;
    if (status === 'inactive')
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">🟡 Inativo</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">⚫ Não sincronizado</span>;
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ShopeePage() {
    const [tab, setTab] = useState<Tab>('config');
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [shopeeConnected, setShopeeConnected] = useState(false);
    const [shopeeShopId, setShopeeShopId] = useState<string | null>(null);

    // Products tab state
    const [products, setProducts] = useState<ShopeeProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [importing, setImporting] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');
    const [searchQ, setSearchQ] = useState('');
    const [syncModal, setSyncModal] = useState<LocalProduct | null>(null);
    const [editingPrice, setEditingPrice] = useState<Record<string, number>>({});
    const [linkingProductId, setLinkingProductId] = useState<string | null>(null);
    const [linkInput, setLinkInput] = useState('');
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [expandStock, setExpandStock] = useState<Record<string, number>>({});

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            setLoading(true);
            const data = await getCompanyData();
            setCompany(data);
            const { data: sbSettings } = await supabase
                .from('company_settings')
                .select('shopee_access_token, shopee_shop_id')
                .limit(1).single();
            if (sbSettings?.shopee_access_token) {
                setShopeeConnected(true);
                setShopeeShopId(sbSettings.shopee_shop_id);
            }
        } catch { toast.error('Erro ao buscar configurações.'); }
        finally { setLoading(false); }
    }

    const loadProducts = useCallback(async () => {
        setLoadingProducts(true);
        try {
            // Fetch products from VPS (source of truth for catalog), bypassing 5-min cache to ensure Bling cost is fresh
            const localProds = await vpsApiService.getProducts({ limit: 500, status: 'all', noCache: true });

            // Fetch Shopee sync records from Supabase (integration metadata)
            const { data: shopeeRecords } = await supabase
                .from('shopee_products')
                .select('*');

            // Fetch raw Supabase products for instant price_cost retrieval (bypasses VPS sync delays)
            const { data: supaProds } = await supabase
                .from('products')
                .select('id, price_cost, parent_id');

            const syncMap = new Map((shopeeRecords || []).map((r: any) => [r.product_id, r]));
            const supaMap = new Map((supaProds || []).map((p: any) => [p.id, p]));

            const merged: ShopeeProduct[] = (localProds || []).map((p: any) => {
                const sr = syncMap.get(String(p.id)) as any;
                const sp = supaMap.get(String(p.id)) as any;
                
                // Puxa o custo real diretamente do Supabase local (que é salvo pelo ModelsPage)
                let actualCost = sp?.price_cost || p.price_cost || 0;
                
                // Se for 0 no pai, busca nas variações (filhos do Supabase)
                if (!actualCost) {
                    const variations = (supaProds || []).filter((child: any) => child.parent_id === p.id);
                    if (variations.length > 0) {
                        actualCost = Math.max(...variations.map((v: any) => v.price_cost || 0));
                    }
                }

                return {
                    id: sr?.id || p.id,
                    product_id: String(p.id),
                    shopee_item_id: sr?.shopee_item_id || null,
                    shopee_category_id: sr?.shopee_category_id || null,
                    shopee_category_name: sr?.shopee_category_name || null,
                    shopee_price: sr?.shopee_price || null,
                    status: sr?.status || 'not_synced',
                    last_synced_at: sr?.last_synced_at || null,
                    name: p.name,
                    sku: p.sku,
                    images: p.images,
                    price_retail: p.price_retail,
                    price_cost: actualCost,
                    category_slug: p.category_slug,
                };
            });
            setProducts(merged);
        } catch (e) { toast.error('Erro ao carregar produtos.'); }
        finally { setLoadingProducts(false); }
    }, []);

    useEffect(() => {
        if (tab === 'products') loadProducts();
    }, [tab, loadProducts]);

    const handleSave = async () => {
        if (!company) return;
        try {
            setSaving(true);
            await saveCompanyData(company);
            toast.success('Configurações da Shopee salvas!');
        } catch { toast.error('Erro ao salvar as configurações.'); }
        finally { setSaving(false); }
    };

    const handleOAuthLogin = async () => {
        if (!company?.shopee_partner_id || !company?.shopee_partner_key) {
            toast.error('Preencha o Partner ID e a Partner Key antes de tentar autenticar.');
            return;
        }
        try {
            toast.loading('Gerando link de integração...', { id: 'shopee-auth' });
            const res = await fetch('/api/shopee?action=auth');
            const data = await res.json();
            if (res.ok && data.url) {
                toast.success('Redirecionando para a Shopee...', { id: 'shopee-auth' });
                window.location.href = data.url;
            } else {
                toast.error(data.error || 'Erro ao gerar URL de autorização.', { id: 'shopee-auth' });
            }
        } catch { toast.error('Erro de conexão ao tentar autorizar.', { id: 'shopee-auth' }); }
    };

    const importFromShopee = async () => {
        setImporting(true);
        toast.loading('Buscando produtos na Shopee...', { id: 'shopee-import' });
        try {
            // 1. Fetch ALL active Shopee item IDs (paginated)
            const shopeeItems: any[] = [];
            let offset = 0;
            let hasNextPage = true;
            while (hasNextPage) {
                const listRes = await fetch(`/api/shopee-catalog?action=get_item_list&item_status=NORMAL&page_size=100&offset=${offset}`);
                const listData = await listRes.json();
                const pageItems: any[] = listData.response?.item || [];
                shopeeItems.push(...pageItems);
                hasNextPage = listData.response?.has_next_page === true;
                offset = listData.response?.next_offset ?? (offset + 100);
                if (pageItems.length === 0) break; // safety exit
                toast.loading(`Buscando produtos Shopee... ${shopeeItems.length} encontrados`, { id: 'shopee-import' });
            }

            if (shopeeItems.length === 0) {
                toast.warning('Nenhum produto encontrado na Shopee.', { id: 'shopee-import' });
                return;
            }

            // 2. Fetch full base info (incl. seller SKU) in batches of 50
            toast.loading(`Carregando detalhes de ${shopeeItems.length} itens...`, { id: 'shopee-import' });
            const itemIds = shopeeItems.map((i: any) => i.item_id);
            const batchSize = 50;
            const detailedItems: any[] = [];
            for (let i = 0; i < itemIds.length; i += batchSize) {
                const batch = itemIds.slice(i, i + batchSize).join(',');
                const infoRes = await fetch(`/api/shopee-catalog?action=get_item_base_info&item_id_list=${batch}`);
                const infoData = await infoRes.json();
                detailedItems.push(...(infoData.response?.item_list || []));
            }

            // 3. Fetch VPS products for matching
            const localProds = await vpsApiService.getProducts({ limit: 5000, noCache: true }) || [];
            // Build SKU map: both exact and cleaned (no hyphens/spaces) → works for "RMP-12P" vs "RMP12P"
            const cleanSku = (s: string) => s.toLowerCase().replace(/[-\s]/g, '');
            const skuMap    = new Map<string, any>();
            const skuClean  = new Map<string, any>();
            for (const p of localProds) {
                if (!p.sku) continue;
                skuMap.set(p.sku.toLowerCase(), p);
                skuClean.set(cleanSku(p.sku), p);
            }

            // 4. Match: item_sku → model_sku → cleaned SKU → fuzzy name
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            const matched: any[] = [];
            const unmatched: any[] = [];

            for (const item of detailedItems) {
                let localMatch: any = null;
                let matchedBySku = false;

                // 4a. item_sku (exact + cleaned)
                const itemSku = (item.item_sku || '').toLowerCase().trim();
                if (itemSku) {
                    localMatch = skuMap.get(itemSku) || skuClean.get(cleanSku(itemSku)) || null;
                    if (localMatch) matchedBySku = true;
                }

                // 4b. model_sku for each variation (Shopee hides item-level SKU for variant products)
                if (!localMatch && Array.isArray(item.models)) {
                    for (const model of item.models) {
                        const mSku = (model.model_sku || '').toLowerCase().trim();
                        if (!mSku) continue;
                        localMatch = skuMap.get(mSku) || skuClean.get(cleanSku(mSku)) || null;
                        if (localMatch) { matchedBySku = true; break; }
                    }
                }

                // 4c. Fuzzy name fallback (lowered threshold 0.45 → 0.35)
                if (!localMatch) {
                    const shopeeNameNorm = normalize(item.item_name || '');
                    let bestScore = 0;
                    for (const local of localProds) {
                        const localNorm = normalize(local.name || '');
                        const shopeeWords = shopeeNameNorm.split(/\s+/);
                        const localWords  = localNorm.split(/\s+/);
                        const common = shopeeWords.filter(w => w.length > 2 && localWords.some(lw => lw.includes(w) || w.includes(lw)));
                        const score  = common.length / Math.max(shopeeWords.length, localWords.length);
                        if (score > bestScore && score >= 0.35) { bestScore = score; localMatch = local; }
                    }
                }

                if (localMatch) {
                    matched.push({ shopeeItem: item, localProduct: localMatch, bysku: matchedBySku });
                } else {
                    unmatched.push(item);
                }
            }


            // 5. Deduplicate by product_id (SKU match wins over name match) and upsert
            const { data: existing } = await supabase.from('shopee_products').select('product_id');
            const existingIds = new Set((existing || []).map((r: any) => r.product_id));

            // Keep one Shopee item per VPS product (SKU match wins over name match)
            const bestMatchByProduct = new Map<string, typeof matched[0]>();
            for (const m of matched) {
                const pid = String(m.localProduct.id);
                const current = bestMatchByProduct.get(pid);
                if (!current || (!current.bysku && m.bysku)) {
                    bestMatchByProduct.set(pid, m);
                }
            }

            const toUpsert = [...bestMatchByProduct.values()]
                .filter(m => !existingIds.has(String(m.localProduct.id)))
                .map(m => ({
                    product_id: String(m.localProduct.id),
                    shopee_item_id: m.shopeeItem.item_id,
                    shopee_category_id: m.shopeeItem.category_id || null,
                    shopee_price: m.shopeeItem.price_info?.[0]?.original_price
                        ? Math.round(m.shopeeItem.price_info[0].original_price * 100)
                        : null,
                    status: 'active',
                    last_synced_at: new Date().toISOString(),
                }));

            let insertedCount = 0;
            if (toUpsert.length > 0) {
                const { error: upsertError, count } = await supabase
                    .from('shopee_products')
                    .upsert(toUpsert, { onConflict: 'product_id', count: 'exact' });
                if (upsertError) throw new Error(`Supabase: ${upsertError.message}`);
                insertedCount = count ?? toUpsert.length;
            }

            const bySkuCount = [...bestMatchByProduct.values()].filter(m => m.bysku).length;
            const byNameCount = bestMatchByProduct.size - bySkuCount;
            const alreadyExisted = bestMatchByProduct.size - toUpsert.length;

            toast.success(
                `✅ ${insertedCount} novos vínculos criados\n` +
                `📦 Shopee: ${shopeeItems.length} itens | VPS: ${localProds.length} produtos\n` +
                `🔗 Match SKU: ${bySkuCount} | Nome: ${byNameCount} | Já existiam: ${alreadyExisted}\n` +
                `❌ Sem match: ${unmatched.length}`,
                { id: 'shopee-import', duration: 10000 }
            );
            loadProducts();
        } catch (e: any) {
            toast.error(`Erro ao importar: ${e.message}`, { id: 'shopee-import' });
        } finally {
            setImporting(false);
        }
    };


    const handleManualLink = async (p: ShopeeProduct) => {
        const itemId = linkInput.trim();
        if (!itemId || isNaN(Number(itemId))) {
            toast.error('Digite um Shopee Item ID válido (numérico).');
            return;
        }
        try {
            await supabase.from('shopee_products').upsert({
                product_id: p.product_id,
                shopee_item_id: Number(itemId),
                status: 'active',
                last_synced_at: new Date().toISOString(),
            }, { onConflict: 'product_id' });
            toast.success(`Produto vinculado ao Item Shopee #${itemId}!`);
            setLinkingProductId(null);
            setLinkInput('');
            loadProducts();
        } catch { toast.error('Erro ao vincular produto.'); }
    };

    const handleToggleStatus = async (p: ShopeeProduct) => {
        if (!p.shopee_item_id) return;
        const newStatus = p.status === 'active' ? 'INACTIVE' : 'NORMAL';
        try {
            const res = await fetch('/api/shopee-catalog?action=update_item_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: p.shopee_item_id, item_status: newStatus }),
            });
            const data = await res.json();
            if (data.error) { toast.error(`Erro: ${data.message}`); return; }
            await supabase.from('shopee_products').update({
                status: newStatus === 'NORMAL' ? 'active' : 'inactive'
            }).eq('product_id', p.product_id);
            toast.success(`Produto ${newStatus === 'NORMAL' ? 'ativado' : 'desativado'} na Shopee!`);
            loadProducts();
        } catch { toast.error('Erro ao alterar status.'); }
    };

    const handleUpdatePrice = async (p: ShopeeProduct) => {
        const newPrice = editingPrice[p.product_id];
        if (!newPrice || !p.shopee_item_id) return;
        try {
            const res = await fetch('/api/shopee-catalog?action=update_price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: p.shopee_item_id,
                    price_list: [{ model_id: 0, original_price: newPrice / 100 }],
                }),
            });
            const data = await res.json();
            if (data.error) { toast.error(`Erro: ${data.message}`); return; }
            await supabase.from('shopee_products')
                .update({ shopee_price: newPrice })
                .eq('product_id', p.product_id);
            toast.success('Preço atualizado na Shopee!');
            setEditingPrice(prev => { const n = { ...prev }; delete n[p.product_id]; return n; });
            loadProducts();
        } catch { toast.error('Erro ao atualizar preço.'); }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
    );

    const isConnected = shopeeConnected;

    const filtered = products.filter(p => {
        const matchFilter =
            filter === 'all' ? true :
            filter === 'synced' ? p.status === 'active' :
            filter === 'not_synced' ? p.status === 'not_synced' :
            p.status === 'inactive';
        const matchSearch = !searchQ || p.name?.toLowerCase().includes(searchQ.toLowerCase()) || p.sku?.toLowerCase().includes(searchQ.toLowerCase());
        return matchFilter && matchSearch;
    });

    const stats = {
        total: products.length,
        synced: products.filter(p => p.status === 'active').length,
        inactive: products.filter(p => p.status === 'inactive').length,
        notSynced: products.filter(p => p.status === 'not_synced').length,
    };

    return (
        <div className="animate-in fade-in duration-500 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Store className="w-8 h-8 text-orange-500" />
                        Shopee Integration
                    </h1>
                    <p className="text-slate-500 mt-1">Gerencie sua loja na Shopee Open Platform</p>
                </div>
                {tab === 'config' && (
                    <button onClick={handleSave} disabled={saving}
                        className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-orange-600 transition-colors disabled:opacity-50 shadow-sm">
                        {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                        Salvar Chaves
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
                {[
                    { id: 'config' as Tab, label: 'Configurações', icon: Key },
                    { id: 'products' as Tab, label: 'Produtos', icon: Package },
                    { id: 'orders' as Tab, label: 'Pedidos', icon: ShoppingBag },
                    { id: 'finance' as Tab, label: 'Financeiro', icon: DollarSign },
                    { id: 'printers' as Tab, label: 'Impressoras', icon: Printer },
                ].map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            tab === id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Tab: Configurações ── */}
            {tab === 'config' && (
                <div className="space-y-6">
                    {/* Credentials card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                            <Key className="w-5 h-5 text-slate-500" />
                            <div>
                                <h2 className="text-base font-bold text-slate-800">Credenciais do Custom App</h2>
                                <p className="text-xs text-slate-500">Crie um app na Shopee Open Platform e copie as chaves abaixo.</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Partner ID</label>
                                    <input type="text" value={company?.shopee_partner_id || ''}
                                        onChange={(e) => company && setCompany({ ...company, shopee_partner_id: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-orange-500 bg-white"
                                        placeholder="Ex: 2031856" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Partner Key</label>
                                    <input type="password" value={company?.shopee_partner_key || ''}
                                        onChange={(e) => company && setCompany({ ...company, shopee_partner_key: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-orange-500 bg-white font-mono text-sm"
                                        placeholder="Sua chave secreta" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <AlertCircle className="w-4 h-4 text-amber-500" />
                                    Sandbox ativo se o Partner ID for do ambiente de testes.
                                </div>
                                <a href="https://open.shopee.com/" target="_blank" rel="noopener noreferrer"
                                    className="text-sm font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1">
                                    Acessar Console <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* OAuth card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="w-5 h-5 text-slate-500" />
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">Autorização OAuth 2.0</h2>
                                    <p className="text-xs text-slate-500">Vincule sua conta de Vendedor ao App.</p>
                                </div>
                            </div>
                            {isConnected
                                ? <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 uppercase">Conectado</span>
                                : <span className="px-3 py-1 bg-slate-200 text-slate-500 text-xs font-bold rounded-full border border-slate-300 uppercase">Desconectado</span>
                            }
                        </div>
                        <div className="p-6">
                            {isConnected ? (
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-bold text-green-800">Autenticação Ativa</p>
                                        <p className="text-xs text-green-700 mt-1">Shop ID: <span className="font-mono bg-white px-2 py-0.5 rounded border border-green-200">{shopeeShopId}</span></p>
                                    </div>
                                    <button onClick={handleOAuthLogin}
                                        className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4" />
                                        Reconectar / Atualizar Token
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                                        <Store className="w-8 h-8 text-orange-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Conecte sua Loja</h3>
                                        <p className="text-sm text-slate-500 mx-auto max-w-sm mt-1">Para sincronizar produtos, autorize este sistema a acessar sua conta da Shopee.</p>
                                    </div>
                                    <button onClick={handleOAuthLogin}
                                        className="mt-2 bg-[#ee4d2d] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#d73f21] transition-colors shadow-md shadow-orange-500/20">
                                        Autorizar com a Shopee
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tab: Produtos ── */}
            {tab === 'products' && (
                <div className="space-y-4">
                    {!isConnected && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            Conecte sua loja Shopee na aba <strong>Configurações</strong> antes de gerenciar produtos.
                        </div>
                    )}

                    {/* Import from Shopee button */}
                    {isConnected && (
                        <div className="flex justify-end">
                            <button onClick={importFromShopee} disabled={importing || loadingProducts}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm">
                                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-slate-500" />}
                                Importar da Shopee
                            </button>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Total', value: stats.total, color: 'slate' },
                            { label: 'Ativos', value: stats.synced, color: 'green' },
                            { label: 'Inativos', value: stats.inactive, color: 'amber' },
                            { label: 'Não sincronizados', value: stats.notSynced, color: 'slate' },
                        ].map(s => (
                            <div key={s.label} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                                <p className="text-xs text-slate-500">{s.label}</p>
                                <p className="text-2xl font-bold text-slate-800 mt-0.5">{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filters + Search */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                                placeholder="Buscar por nome ou SKU..."
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 bg-white" />
                        </div>
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
                            {([
                                ['all', 'Todos'],
                                ['synced', '🟢 Ativos'],
                                ['not_synced', '⚫ Não sincronizados'],
                                ['inactive', '🟡 Inativos'],
                            ] as [Filter, string][]).map(([id, label]) => (
                                <button key={id} onClick={() => setFilter(id)}
                                    className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${filter === id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {loadingProducts ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                <Package className="w-10 h-10 mb-2 opacity-30" />
                                <p className="text-sm">Nenhum produto encontrado</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Produto</th>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Categoria Shopee</th>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Preço Shopee</th>
                                            <th className="text-right px-4 py-3 font-semibold text-slate-600">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filtered.map(p => (
                                            <React.Fragment key={p.product_id}>
                                            <tr className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        {p.images?.[0] ? (
                                                            <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-lg object-contain bg-slate-100 shrink-0" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                                <Package className="w-5 h-5 text-slate-300" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            {p.shopee_item_id ? (
                                                                <a
                                                                    href={`https://shopee.com.br/product/${shopeeShopId}/${p.shopee_item_id}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="font-medium text-slate-800 hover:text-orange-600 truncate max-w-[200px] flex items-center gap-1 transition-colors"
                                                                >
                                                                    <span className="truncate max-w-[185px]">{p.name}</span>
                                                                    <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                                                                </a>
                                                            ) : (
                                                                <p className="font-medium text-slate-800 truncate max-w-[200px]">{p.name}</p>
                                                            )}
                                                            <p className="text-xs text-slate-400 font-mono">{p.sku || '—'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 hidden md:table-cell">
                                                    <span className="text-xs text-slate-500">
                                                        {p.shopee_category_name || <span className="italic text-slate-300">Não mapeado</span>}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge status={p.status} />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {editingPrice[p.product_id] !== undefined ? (
                                                            <>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    autoFocus
                                                                    value={editingPrice[p.product_id] / 100}
                                                                    onChange={e => setEditingPrice(prev => ({
                                                                        ...prev,
                                                                        [p.product_id]: Math.round(parseFloat(e.target.value) * 100)
                                                                    }))}
                                                                    onBlur={e => { if (!e.target.value) setEditingPrice(prev => { const n = { ...prev }; delete n[p.product_id]; return n; }); }}
                                                                    className="w-24 px-2 py-1 border border-orange-400 rounded-lg text-xs focus:ring-1 focus:ring-orange-500"
                                                                />
                                                                {p.shopee_item_id && (
                                                                    <button onClick={() => handleUpdatePrice(p)}
                                                                        className="p-1 rounded bg-green-500 text-white hover:bg-green-600">
                                                                        <Check className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span
                                                                onClick={() => setEditingPrice(prev => ({
                                                                    ...prev,
                                                                    [p.product_id]: p.shopee_price || p.price_retail || 0
                                                                }))}
                                                                title="Clique para editar"
                                                                className="text-sm font-medium text-slate-700 cursor-pointer hover:text-orange-600 transition-colors"
                                                            >
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((p.shopee_price || p.price_retail || 0) / 100)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        {/* Toggle ativo/inativo */}
                                                        {p.shopee_item_id && (
                                                            <button onClick={() => handleToggleStatus(p)} title={p.status === 'active' ? 'Desativar' : 'Ativar'}
                                                                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                                                                {p.status === 'active'
                                                                    ? <ToggleRight className="w-5 h-5 text-green-500" />
                                                                    : <ToggleLeft className="w-5 h-5 text-slate-400" />
                                                                }
                                                            </button>
                                                        )}
                                                        {/* Actions */}
                                                        {p.status === 'not_synced' ? (
                                                            linkingProductId === p.product_id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <input
                                                                        autoFocus
                                                                        type="number"
                                                                        value={linkInput}
                                                                        onChange={e => setLinkInput(e.target.value)}
                                                                        onKeyDown={e => e.key === 'Enter' && handleManualLink(p)}
                                                                        placeholder="Item ID Shopee"
                                                                        className="w-28 px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-orange-500"
                                                                    />
                                                                    <button onClick={() => handleManualLink(p)}
                                                                        className="p-1 rounded bg-green-500 text-white hover:bg-green-600">
                                                                        <Check className="w-3 h-3" />
                                                                    </button>
                                                                    <button onClick={() => { setLinkingProductId(null); setLinkInput(''); }}
                                                                        className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => setSyncModal({
                                                                            id: p.product_id,
                                                                            name: p.name || '',
                                                                            sku: p.sku || '',
                                                                            images: p.images || [],
                                                                            price_retail: p.price_retail || 0,
                                                                            price_cost: p.price_cost || 0,
                                                                            category_slug: p.category_slug || '',
                                                                        })}
                                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-[#ee4d2d] text-white hover:bg-[#d73f21]">
                                                                        Sincronizar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setLinkingProductId(p.product_id); setLinkInput(''); }}
                                                                        title="Vincular a item já existente na Shopee"
                                                                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors">
                                                                        <Tag className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            )
                                                        ) : (
                                                            <span title={`Item Shopee: ${p.shopee_item_id}`}
                                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-400 cursor-default select-none">
                                                                #{p.shopee_item_id}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Expand chevron */}
                                                <td className="px-2">
                                                    <button onClick={() => setExpandedProductId(expandedProductId === p.product_id ? null : p.product_id)}
                                                        className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400"
                                                        title="Expandir detalhes">
                                                        {expandedProductId === p.product_id
                                                            ? <ChevronDown className="w-4 h-4" />
                                                            : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* ── Expanded panel ─────────────────────── */}
                                            {expandedProductId === p.product_id && (
                                                <ExpandedItemPanel
                                                    p={p}
                                                    shopeeShopId={shopeeShopId}
                                                    onClose={() => setExpandedProductId(null)}
                                                    onPriceChange={val => setEditingPrice(prev => ({ ...prev, [p.product_id]: val }))}
                                                    editingPriceVal={editingPrice[p.product_id]}
                                                    onSaved={() => { setExpandedProductId(null); loadProducts(); }}
                                                />
                                            )}
                                            </React.Fragment>

                                        ))}

                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {syncModal && (
                        <ShopeeSyncModal
                            product={syncModal}
                            onClose={() => setSyncModal(null)}
                            onSuccess={() => { setSyncModal(null); loadProducts(); }}
                        />
                    )}
                </div>
            )}

            {/* ── Tab: Pedidos ── */}
            {tab === 'orders' && (
                <ShopeeOrdersTab isConnected={isConnected} />
            )}

            {/* ── Tab: Financeiro ── */}
            {tab === 'finance' && (
                <ShopeeFinanceTab />
            )}

            {/* ── Tab: Impressoras ── */}
            {tab === 'printers' && (
                <ShopeePrintersTab />
            )}
        </div>
    );
}

// ─── Sync Modal ───────────────────────────────────────────────────────────────
function ShopeeSyncModal({
    product, onClose, onSuccess
}: { product: LocalProduct; onClose: () => void; onSuccess: () => void }) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [catSearch, setCatSearch] = useState('');
    const [categories, setCategories] = useState<any[]>([]);
    const [loadingCats, setLoadingCats] = useState(false);
    const [selectedCat, setSelectedCat] = useState<any>(null);
    const [attributes, setAttributes] = useState<any[]>([]);
    const [loadingAttrs, setLoadingAttrs] = useState(false);
    const [attrValues, setAttrValues] = useState<Record<number, any>>({});
    const [syncing, setSyncing] = useState(false);
    const [shopeePrice, setShopeePrice] = useState(product.price_retail / 100);
    const [shopeeStock, setShopeeStock] = useState(10);

    const searchCategories = async () => {
        if (!catSearch.trim()) return;
        setLoadingCats(true);
        try {
            const res = await fetch(`/api/shopee-catalog?action=categories`);
            const data = await res.json();
            // filter categories that have names matching the search (leaf nodes)
            const flattenCats = (cats: any[], level = 0): any[] => {
                return cats.flatMap((c: any) => {
                    const children = c.children ? flattenCats(c.children, level + 1) : [];
                    const match = c.display_category_name?.toLowerCase().includes(catSearch.toLowerCase()) ||
                        c.original_category_name?.toLowerCase().includes(catSearch.toLowerCase());
                    return [...(match ? [{ ...c, level }] : []), ...children];
                });
            };
            const allCats = data.response?.category_list || [];
            setCategories(flattenCats(allCats).slice(0, 30));
        } catch { toast.error('Erro ao buscar categorias.'); }
        finally { setLoadingCats(false); }
    };

    const selectCategory = async (cat: any) => {
        setSelectedCat(cat);
        setStep(2);
        setLoadingAttrs(true);
        try {
            const res = await fetch(`/api/shopee-catalog?action=attributes&category_id=${cat.category_id}`);
            const data = await res.json();
            const attrs = data.response?.attribute_list || [];
            setAttributes(attrs);
        } catch { toast.error('Erro ao carregar atributos.'); }
        finally { setLoadingAttrs(false); }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            // Build attribute list
            const attributeList = Object.entries(attrValues).map(([attrId, val]) => ({
                attribute_id: parseInt(attrId),
                attribute_value_list: Array.isArray(val)
                    ? val.map((v: any) => ({ value_id: v.value_id || 0, original_attribute_value: v.original_attribute_value || String(v) }))
                    : [{ value_id: val.value_id || 0, original_attribute_value: val.original_attribute_value || String(val) }]
            }));

            const payload = {
                original_price: shopeePrice,
                description: product.name,
                item_name: product.name,
                category_id: selectedCat.category_id,
                attribute_list: attributeList,
                logistics_info: [{ logistic_id: 80031, enabled: true }],
                stock_info_v2: {
                    summary_info: { total_reserved_stock: 0, total_available_stock: shopeeStock }
                },
                image: {
                    image_url_list: product.images?.slice(0, 9) || []
                },
                weight: '0.3',
                item_status: 'NORMAL',
                condition: 'NEW',
            };

            const res = await fetch('/api/shopee-catalog?action=add_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (data.error && data.error !== '') {
                toast.error(`Shopee: ${data.message || data.error}`);
                return;
            }

            // Save to Supabase
            const shopeeItemId = data.response?.item_id;
            await supabase.from('shopee_products').upsert({
                product_id: product.id,
                shopee_item_id: shopeeItemId,
                shopee_category_id: selectedCat.category_id,
                shopee_category_name: selectedCat.display_category_name,
                shopee_price: Math.round(shopeePrice * 100),
                status: 'active',
                last_synced_at: new Date().toISOString(),
            }, { onConflict: 'product_id' });

            toast.success('Produto publicado na Shopee! 🎉');
            onSuccess();
        } catch (e: any) {
            toast.error('Erro ao sincronizar produto.');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Modal header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Sincronizar com Shopee</h2>
                        <p className="text-xs text-slate-500 truncate max-w-sm">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                {/* Steps indicator */}
                <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-50">
                    {[['1', 'Categoria'], ['2', 'Atributos'], ['3', 'Confirmar']].map(([n, label], i) => (
                        <React.Fragment key={n}>
                            <div className={`flex items-center gap-1.5 text-xs font-semibold ${step >= parseInt(n) ? 'text-orange-500' : 'text-slate-400'}`}>
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step >= parseInt(n) ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{n}</span>
                                <span className="hidden sm:inline">{label}</span>
                            </div>
                            {i < 2 && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
                        </React.Fragment>
                    ))}
                </div>

                <div className="p-6 space-y-4">
                    {/* Step 1: Category Search */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">Busque a categoria da Shopee que melhor representa este produto.</p>
                            <div className="flex gap-2">
                                <input value={catSearch} onChange={e => setCatSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && searchCategories()}
                                    placeholder="Ex: Celular, Notebook, Câmera..."
                                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500" />
                                <button onClick={searchCategories} disabled={loadingCats}
                                    className="px-4 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50">
                                    {loadingCats ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                </button>
                            </div>
                            {categories.length > 0 && (
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {categories.map(cat => (
                                        <button key={cat.category_id} onClick={() => selectCategory(cat)}
                                            className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-orange-50 border border-transparent hover:border-orange-200 transition-all text-sm">
                                            <span className="font-medium text-slate-800">{cat.display_category_name}</span>
                                            <span className="ml-2 text-xs text-slate-400">ID: {cat.category_id}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Attributes */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm">
                                <Tag className="w-4 h-4 text-orange-500" />
                                <span className="font-medium text-slate-700">Categoria: <span className="text-orange-600">{selectedCat?.display_category_name}</span></span>
                            </div>
                            {loadingAttrs ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-72 overflow-y-auto">
                                    {attributes.filter(a => a.is_mandatory).map((attr: any) => (
                                        <div key={attr.attribute_id}>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                {attr.display_attribute_name}
                                                <span className="text-red-400 ml-1">*</span>
                                            </label>
                                            {attr.input_type === 'DROP_DOWN' || attr.input_type === 'MULTIPLE_SELECT' ? (
                                                <select
                                                    onChange={e => {
                                                        const opt = attr.attribute_value_list?.find((v: any) => String(v.value_id) === e.target.value);
                                                        setAttrValues(prev => ({ ...prev, [attr.attribute_id]: opt || { original_attribute_value: e.target.value } }));
                                                    }}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500">
                                                    <option value="">Selecione...</option>
                                                    {(attr.attribute_value_list || []).map((v: any) => (
                                                        <option key={v.value_id} value={v.value_id}>{v.display_attribute_value}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input type="text"
                                                    onChange={e => setAttrValues(prev => ({ ...prev, [attr.attribute_id]: { original_attribute_value: e.target.value } }))}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500"
                                                    placeholder={attr.display_attribute_name} />
                                            )}
                                        </div>
                                    ))}
                                    {attributes.filter(a => a.is_mandatory).length === 0 && (
                                        <p className="text-sm text-slate-500 text-center py-4">Nenhum atributo obrigatório para esta categoria.</p>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Preço (R$)</label>
                                    <input type="number" step="0.01" value={shopeePrice}
                                        onChange={e => setShopeePrice(parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Estoque inicial</label>
                                    <input type="number" value={shopeeStock}
                                        onChange={e => setShopeeStock(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                            </div>
                            <button onClick={() => setStep(3)}
                                className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors text-sm">
                                Avançar → Confirmar
                            </button>
                        </div>
                    )}

                    {/* Step 3: Confirm */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Produto</span><span className="font-medium text-slate-800 text-right max-w-[60%]">{product.name}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Categoria</span><span className="font-medium text-orange-600">{selectedCat?.display_category_name}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Preço</span><span className="font-semibold text-slate-800">R$ {shopeePrice.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Estoque</span><span className="font-medium">{shopeeStock} un.</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Atributos preenchidos</span><span className="font-medium">{Object.keys(attrValues).length}</span></div>
                            </div>
                            <button onClick={handleSync} disabled={syncing}
                                className="w-full py-3 bg-[#ee4d2d] text-white rounded-xl font-bold hover:bg-[#d73f21] transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                                {syncing ? <><Loader2 className="w-4 h-4 animate-spin" />Publicando...</> : <><Upload className="w-4 h-4" />Publicar na Shopee</>}
                            </button>
                            <button onClick={() => setStep(2)} className="w-full py-2 text-slate-500 text-sm hover:text-slate-800">← Voltar e ajustar</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


// ─── Expanded Item Panel ───────────────────────────────────────────────────────
function ExpandedItemPanel({
    p, shopeeShopId, onClose, onPriceChange, editingPriceVal, onSaved,
}: {
    p: ShopeeProduct;
    shopeeShopId: string | null;
    onClose: () => void;
    onPriceChange: (val: number) => void;
    editingPriceVal?: number;
    onSaved: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [attrs, setAttrs] = useState<any[]>([]);
    const [loadingAttrs, setLoadingAttrs] = useState(false);
    const [attrValues, setAttrValues] = useState<Record<number, string>>({});
    const [effectiveCategoryId, setEffectiveCategoryId] = useState(p.shopee_category_id || '');
    const descRef = useRef<HTMLTextAreaElement>(null);
    const [form, setForm] = useState({
        item_name:      p.name || '',
        description:    '',
        item_sku:       p.sku || '',
        price:          ((p.shopee_price || p.price_retail || 0) / 100).toFixed(2),
        item_weight:    '',
        package_length: '',
        package_width:  '',
        package_height: '',
        condition:      'NEW' as 'NEW' | 'USED',
        ncm:            '',
        gtin:           '',
    });
    const setF = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));
    const [loadingItem, setLoadingItem] = useState(false);
    
    // Calculator extra states
    const [calcTaxes, setCalcTaxes] = useState('0');
    const [calcExtras, setCalcExtras] = useState('0');
    const [calcMargin, setCalcMargin] = useState('10');

    // Load current item data from Shopee on mount to pre-populate form
    useEffect(() => {
        if (!p.shopee_item_id) return;
        setLoadingItem(true);
        fetch(`/api/shopee-catalog?action=get_item_base_info&item_id_list=${p.shopee_item_id}`)
            .then(r => r.json())
            .then(d => {
                // DEBUG: log full raw response
                console.log('[Shopee Panel] full response:', JSON.stringify(d).substring(0, 2000));

                if (d.error && d.error !== '') {
                    toast.error(`Shopee API: ${d.message || d.error}`);
                    return;
                }
                const item = d.response?.item_list?.[0];
                if (!item) {
                    toast.error('Shopee não retornou dados do item');
                    return;
                }

                console.log('[Shopee Panel] item keys:', Object.keys(item));
                console.log('[Shopee Panel] weight:', item.weight, '| dimension:', JSON.stringify(item.dimension), '| tax_info:', JSON.stringify(item.tax_info), '| description length:', item.description?.length);

                // Extended description fallback (HTML blocks format)
                const extDesc = item.description_info?.extended_description?.field_list
                    ?.filter((f: any) => f.field_type === 'text')
                    .map((f: any) => f.text).join('\n') || '';

                const dim = item.dimension || {};
                setForm(prev => ({
                    ...prev,
                    item_name:      item.item_name      || prev.item_name,
                    description:    item.description    || extDesc || '',
                    item_sku:       item.item_sku       || prev.item_sku,
                    item_weight:    item.weight         != null ? String(item.weight) : '',
                    package_length: dim.package_length  != null ? String(dim.package_length) : '',
                    package_width:  dim.package_width   != null ? String(dim.package_width)  : '',
                    package_height: dim.package_height  != null ? String(dim.package_height) : '',
                    condition:      item.condition === 'USED' ? 'USED' : 'NEW',
                    ncm:            item.tax_info?.ncm  || '',
                    gtin:           item.tax_info?.gtin || '',
                    price: item.price_info?.[0]?.original_price != null
                        ? String(item.price_info[0].original_price)
                        : prev.price,
                }));

                // Pre-populate category attribute values (Resolução, Garantia, etc.)
                if (Array.isArray(item.attribute_list) && item.attribute_list.length > 0) {
                    const attrMap: Record<number, string> = {};
                    for (const attr of item.attribute_list) {
                        const v = attr.attribute_value_list?.[0];
                        if (!v) continue;
                        // Always use original_value_name (text) to match select option values
                        attrMap[attr.attribute_id] = v.original_value_name || '';
                    }
                    if (Object.keys(attrMap).length > 0) setAttrValues(attrMap);
                }
                // Resolve category id from live API (covers cases where Supabase has null)
                if (item.category_id) setEffectiveCategoryId(String(item.category_id));
                // Auto-resize description textarea
                setTimeout(() => {
                    if (descRef.current) {
                        descRef.current.style.height = 'auto';
                        descRef.current.style.height = descRef.current.scrollHeight + 'px';
                    }
                }, 50);
            })
            .catch((e) => { console.error('[Shopee Panel] fetch error:', e); toast.error('Erro ao buscar dados da Shopee'); })
            .finally(() => setLoadingItem(false));
    }, [p.shopee_item_id]);


    // Load category attributes — uses effectiveCategoryId (from Shopee live data) as fallback
    useEffect(() => {
        if (!effectiveCategoryId) return;
        setLoadingAttrs(true);
        fetch(`/api/shopee-catalog?action=attributes&category_id=${effectiveCategoryId}`)
            .then(r => r.json())
            .then((d) => {
                const attrList = d.response?.list?.[0]?.attribute_tree || [];
                setAttrs(attrList);
            })
            .catch(() => {})
            .finally(() => setLoadingAttrs(false));
    }, [effectiveCategoryId]);

    const handleSave = async () => {
        if (!p.shopee_item_id) { toast.error('Produto sem Item ID na Shopee.'); return; }
        setSaving(true);
        try {
            const payload: Record<string, any> = { item_id: p.shopee_item_id };
            if (form.item_name.trim())    payload.item_name      = form.item_name.trim();
            if (form.description.trim())  payload.description    = form.description.trim();
            if (form.item_sku.trim())     payload.item_sku       = form.item_sku.trim();
            if (form.item_weight)         payload.item_weight    = parseFloat(form.item_weight);
            if (form.package_length)      payload.package_length = parseInt(form.package_length);
            if (form.package_width)       payload.package_width  = parseInt(form.package_width);
            if (form.package_height)      payload.package_height = parseInt(form.package_height);
            payload.condition = form.condition;

            // Tax info
            if (form.ncm.trim() || form.gtin.trim()) {
                payload.tax_info = {};
                if (form.ncm.trim())  payload.tax_info.ncm  = form.ncm.trim();
                if (form.gtin.trim()) payload.tax_info.gtin = form.gtin.trim();
            }

            // Dynamic category attributes (INMETRO, ANATEL, etc.)
            const attrList = Object.entries(attrValues)
                .filter(([, v]) => v?.trim())
                .map(([id, val]) => {
                    const attrId = parseInt(id);
                    const attrDef = attrs.find((a: any) => a.attribute_id === attrId);
                    let valId = 0;
                    if (attrDef && Array.isArray(attrDef.attribute_value_list)) {
                        const opt = attrDef.attribute_value_list.find((o: any) => o.name === val.trim() || o.original_value_name === val.trim());
                        if (opt && opt.value_id) valId = opt.value_id;
                    }
                    return {
                        attribute_id: attrId,
                        attribute_value_list: [{ value_id: valId, original_value_name: val.trim() }],
                    };
                });
            if (attrList.length > 0) payload.attribute_list = attrList;

            const promises: Promise<any>[] = [
                fetch('/api/shopee-catalog?action=update_item', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }).then(r => r.json()),
            ];
            const priceVal = parseFloat(form.price);
            if (!isNaN(priceVal) && priceVal > 0) {
                promises.push(fetch('/api/shopee-catalog?action=update_price', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item_id: p.shopee_item_id, price_list: [{ model_id: 0, original_price: priceVal }] }),
                }).then(r => r.json()));
            }

            const results = await Promise.all(promises);
            const errs = results.filter(r => r.error || r.message?.toLowerCase().includes('error'));
            if (errs.length > 0) throw new Error(errs[0].message || errs[0].error);
            toast.success('Item atualizado na Shopee!');
            onSaved();
        } catch (e: any) {
            toast.error(`Erro: ${e.message}`);
        } finally { setSaving(false); }
    };

    const inp = (label: string, k: keyof typeof form, type = 'text', ph = '', cls = '') => (
        <div className={`flex flex-col gap-1 ${cls}`}>
            <label className="text-xs font-medium text-slate-500">{label}</label>
            <input type={type} value={form[k]} placeholder={ph}
                onChange={e => setF(k, e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white" />
        </div>
    );

    return (
        <tr className="bg-orange-50/40">
            <td colSpan={6} className="px-6 py-5 border-t border-orange-100">
                {/* Header */}
                <div className="flex items-center gap-2 mb-5">
                    <span className="text-sm font-semibold text-slate-700">✏️ Editar na Shopee</span>
                    {loadingItem && <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />}
                    {p.shopee_item_id && (
                        <a href={`https://shopee.com.br/product/${shopeeShopId}/${p.shopee_item_id}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs font-mono text-orange-500 hover:underline flex items-center gap-0.5">
                            #{p.shopee_item_id} <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                    {!p.shopee_category_id && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            ⚠️ Sem categoria — atributos (INMETRO/ANATEL) indisponíveis
                        </span>
                    )}
                </div>

                {/* ── Informações básicas */}
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Informações Básicas</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">Nome (Shopee)</label>
                        <input type="text" value={form.item_name} onChange={e => setF('item_name', e.target.value)}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">SKU Shopee</label>
                        <input type="text" value={form.item_sku} placeholder={p.sku || ''}
                            onChange={e => setF('item_sku', e.target.value)}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">Preço (R$)</label>
                        <input type="number" step="0.01" value={form.price} placeholder="0.00"
                            onChange={e => setF('price', e.target.value)}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white" />
                    </div>
                </div>

                {/* ── Calculadora Shopee */}
                {parseFloat(form.price) > 0 && (
                    <div className="mb-4 bg-orange-50/50 border border-orange-100 rounded-xl p-3 flex flex-col gap-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                    <Calculator className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-orange-800">Simulador de Ganhos Shopee</p>
                                    <p className="text-[10px] text-orange-600/80">Comissão de 20% (Frete Grátis) + Taxa Fixa CNPJ</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                    <label className="text-[10px] font-medium text-slate-500">Imposto (%)</label>
                                    <input type="text" inputMode="decimal" value={calcTaxes} onChange={e => setCalcTaxes(e.target.value.replace(/[^0-9.,]/g, ''))}
                                        className="w-14 px-1.5 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-orange-500 text-center" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <label className="text-[10px] font-medium text-slate-500">Extras (R$)</label>
                                    <input type="text" inputMode="decimal" value={calcExtras} onChange={e => setCalcExtras(e.target.value.replace(/[^0-9.,]/g, ''))}
                                        className="w-16 px-1.5 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-orange-500 text-center" />
                                </div>
                                <div className="flex items-center gap-1.5 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                    <label className="text-[10px] font-bold text-indigo-700">Meta Lucro (%)</label>
                                    <input type="text" inputMode="decimal" value={calcMargin} onChange={e => setCalcMargin(e.target.value.replace(/[^0-9.,]/g, ''))}
                                        className="w-12 px-1 py-0.5 border border-indigo-200 rounded text-xs font-bold text-indigo-700 focus:ring-1 focus:ring-indigo-500 bg-white text-center" />
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const val = parseFloat(form.price) || 0;
                            const comissao = val * 0.20;
                            let taxaFixa = 0;
                            if (val < 80) taxaFixa = 4;
                            else if (val < 100) taxaFixa = 16;
                            else if (val < 200) taxaFixa = 20;
                            else if (val < 500) taxaFixa = 26;
                            else taxaFixa = 28;
                            
                            const impostoReal = val * ((parseFloat(calcTaxes.replace(',', '.')) || 0) / 100);
                            const extraDespesas = parseFloat(calcExtras.replace(',', '.')) || 0;
                            const custoProduto = (p.price_cost || 0) / 100;
                            
                            const liquidoShopee = val - comissao - taxaFixa; // Cai na conta
                            const lucroReal = liquidoShopee - custoProduto - impostoReal - extraDespesas;

                            // -- Calculate Suggested Price based on desired margin %
                            const margemDec = (parseFloat(calcMargin.replace(',', '.')) || 0) / 100;
                            const impostoDec = (parseFloat(calcTaxes.replace(',', '.')) || 0) / 100;
                            const denominator = 1 - 0.20 - impostoDec - margemDec;
                            
                            let precoSugerido = 0;
                            if (denominator > 0) {
                                const brackets = [
                                    { max: 79.99, taxa: 4 },
                                    { max: 99.99, taxa: 16 },
                                    { max: 199.99, taxa: 20 },
                                    { max: 499.99, taxa: 26 },
                                    { max: Infinity, taxa: 28 },
                                ];
                                for (const b of brackets) {
                                    const pCalc = (custoProduto + extraDespesas + b.taxa) / denominator;
                                    if (pCalc <= b.max) {
                                        precoSugerido = pCalc;
                                        break;
                                    }
                                }
                                // Fallback se pCalc estourou todos os limites (muito improvável, mas garante safety na última taxa)
                                if (!precoSugerido) precoSugerido = (custoProduto + extraDespesas + 28) / denominator;
                            }

                            return (
                                <>
                                    <div className="bg-white/60 p-2 rounded-lg border border-orange-100/50">
                                        <div className="flex flex-wrap items-center justify-between xl:justify-start gap-4 text-xs font-medium text-slate-600">
                                            <div className="flex flex-col items-end">
                                                <span className="text-red-500">- R$ {comissao.toFixed(2)} <span className="text-[9px] text-slate-400 font-normal">(20%)</span></span>
                                                <span className="text-red-500">- R$ {taxaFixa.toFixed(2)} <span className="text-[9px] text-slate-400 font-normal">(Fixo)</span></span>
                                            </div>
                                            <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
                                            
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-400 uppercase">Recebível Shopee</span>
                                                <span className={`text-sm font-bold ${liquidoShopee > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>R$ {liquidoShopee.toFixed(2)}</span>
                                            </div>
                                            <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
                                            
                                            <div className="flex flex-col gap-0.5 text-[10px] items-end xl:items-start text-slate-500">
                                                <span>Custo: <strong className="text-slate-700">R$ {custoProduto.toFixed(2)}</strong></span>
                                                {impostoReal > 0 && <span>Imposto: <strong className="text-red-500">-R$ {impostoReal.toFixed(2)}</strong></span>}
                                                {extraDespesas > 0 && <span>Extras: <strong className="text-red-500">-R$ {extraDespesas.toFixed(2)}</strong></span>}
                                            </div>
                                            <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

                                            <div className="flex flex-col ml-auto xl:ml-0 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                                <span className="text-[10px] text-blue-600/80 uppercase mb-0.5 font-bold">Lucro Real Simul./Atual</span>
                                                <span className={`text-base font-black ${lucroReal > 0 ? 'text-blue-700' : 'text-red-600'}`}>R$ {lucroReal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Box de Preço Sugerido */}
                                    <div className="mt-1 flex items-center justify-between bg-indigo-50/80 p-2.5 rounded-lg border border-indigo-200">
                                        <div className="flex items-center gap-2">
                                            <Tag className="w-4 h-4 text-indigo-500" />
                                            <div>
                                                <p className="text-[11px] font-bold text-indigo-800">Preço Sugerido de Venda</p>
                                                <p className="text-[9px] text-indigo-600/80 leading-tight">Calculado automaticamente para garantir {calcMargin}% líquidos na conta (margem inversamente extraída).</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-black text-indigo-700">
                                                {precoSugerido > 0 ? `R$ ${precoSugerido.toFixed(2)}` : 'INVÁLIDO'}
                                            </span>
                                            <button 
                                                onClick={() => setF('price', precoSugerido.toFixed(2))}
                                                disabled={precoSugerido <= 0}
                                                title="Aplicar preço sugerido ao produto"
                                                className="px-2 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition disabled:opacity-50">
                                                Aplicar Sugestão
                                            </button>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* ── Embalagem */}
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Embalagem & Logística</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    {inp('Peso (kg)', 'item_weight', 'number', '0.35')}
                    {inp('Comprimento (cm)', 'package_length', 'number', '30')}
                    {inp('Largura (cm)', 'package_width', 'number', '20')}
                    {inp('Altura (cm)', 'package_height', 'number', '10')}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">Condição</label>
                        <select value={form.condition} onChange={e => setF('condition', e.target.value as any)}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white">
                            <option value="NEW">Novo</option>
                            <option value="USED">Usado</option>
                        </select>
                    </div>
                </div>

                {/* ── Fiscal */}
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Informações Fiscais</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {/* NCM com busca inteligente */}
                    <NcmSearchWidget
                        productId={p.product_id}
                        sku={p.sku}
                        productName={form.item_name}
                        currentNcm={form.ncm}
                        autoSave={true}
                        onSaved={ncm => setF('ncm', ncm)}
                        onChange={ncm => setF('ncm', ncm)}
                    />
                    {inp('GTIN / EAN', 'gtin', 'text', 'ex: 7891234560123')}
                </div>
                <div className="mb-4">
                    <InmetroWidget
                        productId={p.product_id}
                        productName={form.item_name}
                        currentCertificate={p.inmetro_certificate || ''}
                        autoSave={true}
                    />
                </div>

                {/* ── Atributos de categoria (INMETRO, ANATEL etc.) */}
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Atributos da Categoria {loadingAttrs && <span className="text-orange-400 normal-case font-normal">carregando...</span>}
                </p>
                {!effectiveCategoryId ? (
                    <p className="text-xs text-slate-400 mb-4 italic">
                        Vincule o produto a uma categoria Shopee via "Sincronizar" para ver os atributos de INMETRO, ANATEL e outros.
                    </p>
                ) : attrs.length === 0 && !loadingAttrs ? (
                    <p className="text-xs text-slate-400 mb-4 italic">Nenhum atributo disponível para esta categoria.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {attrs.map((attr: any) => {
                            const isEnum = Array.isArray(attr.attribute_value_list) && attr.attribute_value_list.length > 0;
                            const translatedAttrName = attr.multi_lang?.find((m: any) => m.language === 'pt-BR')?.value || attr.name;
                            return (
                                <div key={attr.attribute_id} className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                        {translatedAttrName}
                                        {attr.mandatory && <span className="text-red-400 text-[10px]">*</span>}
                                    </label>
                                    {isEnum ? (
                                        <select
                                            value={attrValues[attr.attribute_id] || ''}
                                            onChange={e => setAttrValues(prev => ({ ...prev, [attr.attribute_id]: e.target.value }))}
                                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white">
                                            <option value="">— selecione —</option>
                                            {attr.attribute_value_list.map((v: any) => {
                                                const translatedValueName = v.multi_lang?.find((m: any) => m.language === 'pt-BR')?.value || v.name;
                                                return <option key={v.value_id} value={v.name}>{translatedValueName}</option>;
                                            })}
                                        </select>
                                    ) : (
                                        <input type="text"
                                            value={attrValues[attr.attribute_id] || ''}
                                            placeholder={attr.input_type === 3 ? 'texto longo...' : 'valor...'}
                                            onChange={e => setAttrValues(prev => ({ ...prev, [attr.attribute_id]: e.target.value }))}
                                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Descrição */}
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Descrição</p>
                <textarea ref={descRef} value={form.description}
                    placeholder="Deixe em branco para não alterar"
                    onChange={e => {
                        setF('description', e.target.value);
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                    }}
                    style={{ resize: 'none', overflow: 'hidden', minHeight: '80px' }}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white mb-4" />

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving || !p.shopee_item_id}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#ee4d2d] text-white hover:bg-[#d73f21] transition-colors flex items-center gap-1.5 disabled:opacity-50">
                        {saving ? <><Loader2 className="w-3 h-3 animate-spin" />Salvando...</> : <><Upload className="w-3 h-3" />Salvar na Shopee</>}
                    </button>
                </div>
            </td>
        </tr>
    );
}


