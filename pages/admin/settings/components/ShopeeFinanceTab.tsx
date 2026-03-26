import React, { useState, useEffect, useRef } from 'react';
import {
    DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw,
    Loader2, AlertCircle, Check, Calendar, Download, Truck, Database
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EscrowItem {
    order_sn: string;
    buyer_total_amount: number;  // Bruto total (com frete)
    shipping_fee: number;        // Frete pago pelo comprador
    product_value: number;       // Bruto SEM frete (base tributária)
    escrow_amount: number;       // Líquido recebido
    fee: number;                 // Taxas Shopee
}

interface CacheStore {
    items: Record<string, EscrowItem>;           // by order_sn
    // ranges fetched: key = "YYYYMMDD-YYYYMMDD"
    fetchedRanges: Record<string, number>;       // value = fetchedAt (unix ms)
}

const CACHE_KEY = 'shopee_finance_v3';
const FRESH_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days in ms
const CHUNK_DAYS = 14;
const fmt = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

// ─── Cache helpers ────────────────────────────────────────────────────────────

function loadCache(): CacheStore {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return { items: {}, fetchedRanges: {} };
        return JSON.parse(raw);
    } catch { return { items: {}, fetchedRanges: {} }; }
}

function saveCache(store: CacheStore) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(store)); } catch { /* quota */ }
}

function rangeKey(from: number, to: number) {
    return `${from}-${to}`;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function safeRefreshToken() {
    const r = await fetch('/api/shopee-actions?action=refresh_token');
    return r.ok;
}

async function fetchOrdersChunk(from: number, to: number): Promise<{ order_sn: string }[]> {
    const res = await fetch(`/api/shopee-actions?action=get_order_list&time_from=${from}&time_to=${to}&page_size=50&order_status=COMPLETED`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.response?.order_list || [];
}

async function fetchEscrowDetail(orderSn: string): Promise<EscrowItem | null> {
    try {
        const r = await fetch(`/api/shopee-actions?action=get_escrow_detail&order_sn=${orderSn}`);
        const d = await r.json();
        const income = d.response?.order_income;
        if (!income) return null;
        const buyer_total = income.buyer_total_amount || 0;
        const shipping_fee = income.buyer_paid_shipping_fee || 0;
        const product_value = buyer_total - shipping_fee;
        const escrow = income.escrow_amount || 0;
        return {
            order_sn: orderSn,
            buyer_total_amount: buyer_total,
            shipping_fee,
            product_value,
            escrow_amount: escrow,
            fee: buyer_total - escrow,
        };
    } catch { return null; }
}

function exportCSV(items: EscrowItem[], dateRange: number) {
    const header = 'Pedido,Vendas Brutas (R$),Frete (R$),Base Tributária s/ Frete (R$),Taxas Shopee (R$),Líquido Recebido (R$)\n';
    const rows = items.map(i =>
        `${i.order_sn},${i.buyer_total_amount.toFixed(2)},${i.shipping_fee.toFixed(2)},${i.product_value.toFixed(2)},${i.fee.toFixed(2)},${i.escrow_amount.toFixed(2)}`
    ).join('\n');
    const totals = [
        'TOTAL',
        items.reduce((a, i) => a + i.buyer_total_amount, 0).toFixed(2),
        items.reduce((a, i) => a + i.shipping_fee, 0).toFixed(2),
        items.reduce((a, i) => a + i.product_value, 0).toFixed(2),
        items.reduce((a, i) => a + i.fee, 0).toFixed(2),
        items.reduce((a, i) => a + i.escrow_amount, 0).toFixed(2),
    ].join(',');
    const csv = header + rows + '\n' + totals;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopee-financeiro-${dateRange}d-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShopeeFinanceTab() {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<EscrowItem[]>([]);
    const [apiError, setApiError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState(30);
    const [progress, setProgress] = useState('');
    const [fromCache, setFromCache] = useState(false);
    const abortRef = useRef(false);

    const fetchFinance = async (retry = false) => {
        setLoading(true);
        setApiError(null);
        abortRef.current = false;

        const cache = loadCache();
        const now = Date.now();
        const timeTo = Math.floor(now / 1000);
        const timeFrom = timeTo - (dateRange * 24 * 60 * 60);
        const freshCutoff = Math.floor((now - FRESH_THRESHOLD_MS) / 1000); // 30 days ago in unix

        const chunkSecs = CHUNK_DAYS * 24 * 60 * 60;
        const chunks: { from: number; to: number }[] = [];
        let cursor = timeFrom;
        while (cursor < timeTo) {
            chunks.push({ from: cursor, to: Math.min(cursor + chunkSecs, timeTo) });
            cursor = Math.min(cursor + chunkSecs, timeTo);
        }

        // ── Step 1: Show cached data immediately ──────────────────────────────
        const cachedItems = Object.values(cache.items);
        if (cachedItems.length > 0) {
            setItems(cachedItems);
            setFromCache(true);
        }

        // ── Step 2: Determine which chunks need fresh fetch ───────────────────
        //   Always refresh if chunk overlaps last 30 days
        //   Or if no cache entry exists for that range
        const chunksToFetch = chunks.filter(c => {
            const key = rangeKey(c.from, c.to);
            const cachedAt = cache.fetchedRanges[key];
            // Refresh if: no cache, or chunk is "recent" (last 30 days)
            return !cachedAt || c.to >= freshCutoff;
        });

        if (chunksToFetch.length === 0) {
            setLoading(false);
            setProgress('');
            setFromCache(true);
            return;
        }

        setFromCache(false);

        try {
            let allOrders: { order_sn: string }[] = [];
            for (let i = 0; i < chunksToFetch.length; i++) {
                if (abortRef.current) return;
                setProgress(`Atualizando período ${i + 1}/${chunksToFetch.length}...`);
                try {
                    const chunk = await fetchOrdersChunk(chunksToFetch[i].from, chunksToFetch[i].to);
                    allOrders = [...allOrders, ...chunk];
                    // Mark range as fetched
                    cache.fetchedRanges[rangeKey(chunksToFetch[i].from, chunksToFetch[i].to)] = now;
                } catch (e: any) {
                    if (e.message === 'invalid_access_token' || e.message === 'error_auth') {
                        if (!retry) {
                            const ok = await safeRefreshToken();
                            if (ok) return fetchFinance(true);
                        }
                        setApiError('Sessão expirada. Vá em Configurações e vincule a loja novamente.');
                        return;
                    }
                    throw e;
                }
            }

            // Deduplicate + skip orders already in cache that are old (stable)
            const snAlreadyCached = new Set(Object.keys(cache.items));
            const unique = Array.from(new Map(allOrders.map(o => [o.order_sn, o])).values());
            // Only fresh-fetch escrow for: new orders OR orders from "fresh" chunks
            const toFetchEscrow = unique.filter(o => {
                // If cached and NOT in a fresh chunk range, skip
                if (snAlreadyCached.has(o.order_sn)) {
                    // Was this order's chunk "fresh"? Check if it needs refresh
                    // Since we don't know its exact date, always refresh for the last 30 days window
                    return true; // Simple: always refresh orders found in fetched chunks
                }
                return true; // New order, always fetch
            });

            const BATCH = 10;
            for (let i = 0; i < toFetchEscrow.length; i += BATCH) {
                if (abortRef.current) return;
                const batch = toFetchEscrow.slice(i, i + BATCH);
                setProgress(`Calculando valores... (${Math.min(i + BATCH, toFetchEscrow.length)}/${toFetchEscrow.length})`);
                const resolved = await Promise.all(batch.map(o => fetchEscrowDetail(o.order_sn)));
                resolved.forEach(r => { if (r) cache.items[r.order_sn] = r; });
                // Show incrementally - all cache items (old + new)
                const all = Object.values(cache.items);
                setItems([...all]);
                setFromCache(false);
            }

            saveCache(cache);

        } catch (e: any) {
            setApiError(e.message || 'Erro de conexão ao buscar financeiro.');
        } finally {
            if (!abortRef.current) {
                setLoading(false);
                setProgress('');
            }
        }
    };

    useEffect(() => {
        fetchFinance();
        return () => { abortRef.current = true; };
    }, [dateRange]);

    const totalBruto = items.reduce((acc, i) => acc + i.buyer_total_amount, 0);
    const totalFrete = items.reduce((acc, i) => acc + i.shipping_fee, 0);
    const totalSemFrete = items.reduce((acc, i) => acc + i.product_value, 0);
    const totalFees = items.reduce((acc, i) => acc + i.fee, 0);
    const totalLiquido = items.reduce((acc, i) => acc + i.escrow_amount, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <DollarSign className="w-6 h-6 text-green-600" />
                        Financeiro Shopee
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                        Histórico contábil de pedidos concluídos.
                        {fromCache && items.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                <Database className="w-3 h-3" /> Do cache local
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <select value={dateRange} onChange={(e) => setDateRange(Number(e.target.value))}
                        className="px-4 py-2 border border-slate-200 bg-white rounded-xl text-sm font-medium text-slate-700 outline-none">
                        <option value={7}>Últimos 7 dias</option>
                        <option value={15}>Últimos 15 dias</option>
                        <option value={30}>Últimos 30 dias</option>
                        <option value={60}>Últimos 60 dias</option>
                        <option value={90}>Últimos 90 dias</option>
                        <option value={180}>Últimos 6 meses</option>
                        <option value={365}>Último ano (365 dias)</option>
                    </select>
                    {items.length > 0 && (
                        <button onClick={() => exportCSV(items, dateRange)} disabled={loading}
                            className="px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-bold hover:bg-green-100 transition-colors flex items-center gap-2">
                            <Download className="w-4 h-4" /> CSV
                        </button>
                    )}
                    <button onClick={() => {
                        const cache = loadCache();
                        cache.fetchedRanges = {}; // force full refresh on next load
                        saveCache(cache);
                        fetchFinance();
                    }} disabled={loading} title="Forçar atualização completa"
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Error */}
            {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{apiError}</p>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Vendas Brutas */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                            <DollarSign className="w-4 h-4 text-slate-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Vendas Brutas</h3>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{fmt(totalBruto)}</div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {items.length} pedido(s) {loading ? '…' : ''}
                    </div>
                </div>

                {/* Sem Frete — Base tributária */}
                <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-sm ring-1 ring-blue-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Truck className="w-4 h-4 text-blue-600" />
                        </div>
                        <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide">Sem Frete ★ Contábil</h3>
                    </div>
                    <div className="text-2xl font-black text-blue-700">{fmt(totalSemFrete)}</div>
                    <div className="text-xs text-blue-500 mt-1">
                        Frete excluído: {fmt(totalFrete)} — base para imposto
                    </div>
                </div>

                {/* Taxas Shopee */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                            <ArrowDownRight className="w-4 h-4 text-red-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Taxas Shopee</h3>
                    </div>
                    <div className="text-2xl font-black text-red-600">{fmt(totalFees)}</div>
                    <div className="text-xs text-slate-400 mt-1">Comissão + Serviço + Transação</div>
                </div>

                {/* Líquido */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                            <ArrowUpRight className="w-4 h-4 text-green-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Líquido Recebido</h3>
                    </div>
                    <div className="text-2xl font-black text-green-600">{fmt(totalLiquido)}</div>
                    <div className="text-xs text-green-600 bg-green-50 inline-block px-2 py-0.5 rounded-full mt-1 font-medium">
                        ✓ Na Carteira
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="py-3 px-5 font-bold text-slate-600">Pedido</th>
                                <th className="py-3 px-5 font-bold text-slate-600 text-right">Bruto</th>
                                <th className="py-3 px-5 font-bold text-slate-600 text-right">Frete</th>
                                <th className="py-3 px-5 font-bold text-blue-700 text-right">Sem Frete ★</th>
                                <th className="py-3 px-5 font-bold text-slate-600 text-right">Taxas</th>
                                <th className="py-3 px-5 font-bold text-slate-600 text-right">Líquido</th>
                                <th className="py-3 px-5 font-bold text-slate-600 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && items.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        {progress || 'Buscando dados...'}
                                    </td>
                                </tr>
                            ) : items.length === 0 && !apiError ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        Nenhum pedido concluído encontrado neste período.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {items.map(item => (
                                        <tr key={item.order_sn} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-5 font-bold text-slate-800">#{item.order_sn}</td>
                                            <td className="py-3 px-5 text-right text-slate-700">{fmt(item.buyer_total_amount)}</td>
                                            <td className="py-3 px-5 text-right text-slate-500">{fmt(item.shipping_fee)}</td>
                                            <td className="py-3 px-5 text-right font-bold text-blue-700">{fmt(item.product_value)}</td>
                                            <td className="py-3 px-5 text-right text-red-600 font-medium">-{fmt(item.fee)}</td>
                                            <td className="py-3 px-5 text-right font-bold text-green-600">{fmt(item.escrow_amount)}</td>
                                            <td className="py-3 px-5 text-center">
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Concluído
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {loading && (
                                        <tr>
                                            <td colSpan={7} className="py-3 text-center text-slate-400 text-xs">
                                                <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                                                {progress}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
