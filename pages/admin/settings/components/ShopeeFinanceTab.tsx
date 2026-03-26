import React, { useState, useEffect, useRef } from 'react';
import {
    DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw,
    Loader2, AlertCircle, Check, Calendar, Download, Truck, Database
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EscrowItem {
    order_sn: string;
    create_time: number;         // Unix timestamp da criação do pedido
    order_status: string;        // COMPLETED, CANCELLED, REFUNDED, etc.
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

const CACHE_KEY = 'shopee_finance_v4';  // v4: added create_time field
const TAX_CONFIG_KEY = 'shopee_tax_config';
const FRESH_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days in ms
const CHUNK_DAYS = 14;
const fmt = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const fmtPct = (val: number) =>
    `${(val * 100).toFixed(2)}%`;

// ─── Simples Nacional Engine ──────────────────────────────────────────────────

interface SimplesAnexo { name: string; faixas: { limite: number; aliquota: number; deducao: number }[]; }

const SIMPLES_ANEXOS: Record<string, SimplesAnexo> = {
    I: {
        name: 'Anexo I — Comércio',
        faixas: [
            { limite: 180000,   aliquota: 0.04,  deducao: 0       },
            { limite: 360000,   aliquota: 0.073, deducao: 5940    },
            { limite: 720000,   aliquota: 0.095, deducao: 13860   },
            { limite: 1440000,  aliquota: 0.107, deducao: 22500   },
            { limite: 1800000,  aliquota: 0.143, deducao: 87300   },
            { limite: 3600000,  aliquota: 0.19,  deducao: 378000  },
        ],
    },
    II: {
        name: 'Anexo II — Indústria',
        faixas: [
            { limite: 180000,   aliquota: 0.045, deducao: 0       },
            { limite: 360000,   aliquota: 0.078, deducao: 5940    },
            { limite: 720000,   aliquota: 0.10,  deducao: 13860   },
            { limite: 1440000,  aliquota: 0.112, deducao: 22500   },
            { limite: 1800000,  aliquota: 0.147, deducao: 85500   },
            { limite: 3600000,  aliquota: 0.30,  deducao: 720000  },
        ],
    },
    III: {
        name: 'Anexo III — Serviços (locação, creche, etc.)',
        faixas: [
            { limite: 180000,   aliquota: 0.06,  deducao: 0       },
            { limite: 360000,   aliquota: 0.112, deducao: 9360    },
            { limite: 720000,   aliquota: 0.135, deducao: 17640   },
            { limite: 1440000,  aliquota: 0.16,  deducao: 35640   },
            { limite: 1800000,  aliquota: 0.21,  deducao: 125640  },
            { limite: 3600000,  aliquota: 0.33,  deducao: 648000  },
        ],
    },
    IV: {
        name: 'Anexo IV — Serviços (construção, vigilância, etc.)',
        faixas: [
            { limite: 180000,   aliquota: 0.045, deducao: 0       },
            { limite: 360000,   aliquota: 0.09,  deducao: 8100    },
            { limite: 720000,   aliquota: 0.102, deducao: 12420   },
            { limite: 1440000,  aliquota: 0.14,  deducao: 39780   },
            { limite: 1800000,  aliquota: 0.22,  deducao: 183780  },
            { limite: 3600000,  aliquota: 0.33,  deducao: 828000  },
        ],
    },
    V: {
        name: 'Anexo V — Serviços (TI, publicidade, etc.)',
        faixas: [
            { limite: 180000,   aliquota: 0.155, deducao: 0       },
            { limite: 360000,   aliquota: 0.18,  deducao: 4500    },
            { limite: 720000,   aliquota: 0.195, deducao: 9900    },
            { limite: 1440000,  aliquota: 0.205, deducao: 17100   },
            { limite: 1800000,  aliquota: 0.23,  deducao: 62100   },
            { limite: 3600000,  aliquota: 0.305, deducao: 540000  },
        ],
    },
};

interface TaxResult { faixa: number; aliquotaNominal: number; deducao: number; aliquotaEfetiva: number; }

function calcSimples(rbt12: number, anexo: string): TaxResult | null {
    if (!rbt12 || rbt12 <= 0) return null;
    const tabela = SIMPLES_ANEXOS[anexo];
    if (!tabela) return null;
    const idx = tabela.faixas.findIndex(f => rbt12 <= f.limite);
    const faixaIdx = idx === -1 ? tabela.faixas.length - 1 : idx;
    const { aliquota, deducao } = tabela.faixas[faixaIdx];
    const aliquotaEfetiva = (rbt12 * aliquota - deducao) / rbt12;
    return { faixa: faixaIdx + 1, aliquotaNominal: aliquota, deducao, aliquotaEfetiva: Math.max(0, aliquotaEfetiva) };
}

interface TaxConfig { rbt12: number; anexo: string; baseCalculo: 'bruto' | 'semFrete'; }

function loadTaxConfig(): TaxConfig {
    try {
        const raw = localStorage.getItem(TAX_CONFIG_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* */ }
    return { rbt12: 0, anexo: 'I', baseCalculo: 'semFrete' };
}

function saveTaxConfig(cfg: TaxConfig) {
    try { localStorage.setItem(TAX_CONFIG_KEY, JSON.stringify(cfg)); } catch { /* */ }
}


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

// Statuses válidos na API Shopee para o financeiro
const FINANCE_STATUSES = ['COMPLETED', 'CANCELLED', 'IN_CANCEL', 'IN_RETURN', 'REFUNDED'];

async function fetchOrdersChunk(from: number, to: number): Promise<{ order_sn: string; create_time: number; order_status: string }[]> {
    const allOrders: { order_sn: string; create_time: number; order_status: string }[] = [];
    await Promise.all(FINANCE_STATUSES.map(async (status) => {
        try {
            const res = await fetch(`/api/shopee-actions?action=get_order_list&time_from=${from}&time_to=${to}&page_size=50&order_status=${status}`);
            const data = await res.json();
            if (data.error) return; // skip this status silently
            const list = data.response?.order_list || [];
            list.forEach((o: any) => allOrders.push({ order_sn: o.order_sn, create_time: o.create_time || 0, order_status: status }));
        } catch { /* skip this status on network error */ }
    }));
    return allOrders;
}

async function fetchEscrowDetail(order: { order_sn: string; create_time: number; order_status: string }): Promise<EscrowItem> {
    try {
        const r = await fetch(`/api/shopee-actions?action=get_escrow_detail&order_sn=${order.order_sn}`);
        const d = await r.json();
        const income = d.response?.order_income;
        if (!income) {
            // Cancelled / returned orders — no financial transfer
            return { order_sn: order.order_sn, create_time: order.create_time, order_status: order.order_status, buyer_total_amount: 0, shipping_fee: 0, product_value: 0, escrow_amount: 0, fee: 0 };
        }
        const buyer_total = income.buyer_total_amount || 0;
        const shipping_fee = income.buyer_paid_shipping_fee || 0;
        const product_value = buyer_total - shipping_fee;
        const escrow = income.escrow_amount || 0;
        return { order_sn: order.order_sn, create_time: order.create_time, order_status: order.order_status, buyer_total_amount: buyer_total, shipping_fee, product_value, escrow_amount: escrow, fee: buyer_total - escrow };
    } catch {
        return { order_sn: order.order_sn, create_time: order.create_time, order_status: order.order_status, buyer_total_amount: 0, shipping_fee: 0, product_value: 0, escrow_amount: 0, fee: 0 };
    }
}

function exportCSV(items: EscrowItem[], dateRange: number) {
    const fmtDate = (ts: number) => ts ? new Date(ts * 1000).toLocaleDateString('pt-BR') : '-';
    const header = 'Pedido,Data,Status,Vendas Brutas (R$),Frete (R$),Base Tributária s/ Frete (R$),Taxas Shopee (R$),Líquido Recebido (R$)\n';
    const rows = items.map(i =>
        `${i.order_sn},${fmtDate(i.create_time)},${i.order_status},${i.buyer_total_amount.toFixed(2)},${i.shipping_fee.toFixed(2)},${i.product_value.toFixed(2)},${i.fee.toFixed(2)},${i.escrow_amount.toFixed(2)}`
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
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [progress, setProgress] = useState('');
    const [fromCache, setFromCache] = useState(false);
    const abortRef = useRef(false);
    const [taxConfig, setTaxConfig] = useState<TaxConfig>(() => loadTaxConfig());
    const [rbt12Input, setRbt12Input] = useState(() => loadTaxConfig().rbt12 > 0 ? loadTaxConfig().rbt12.toString() : '');
    const [showTaxConfig, setShowTaxConfig] = useState(false);

    const taxResult = calcSimples(taxConfig.rbt12, taxConfig.anexo);

    const saveTax = (cfg: TaxConfig) => { setTaxConfig(cfg); saveTaxConfig(cfg); };

    const calcOrderTax = (item: EscrowItem) => {
        if (!taxResult) return 0;
        const base = taxConfig.baseCalculo === 'bruto' ? item.buyer_total_amount : item.product_value;
        return base * taxResult.aliquotaEfetiva;
    };

    const fetchFinance = async (retry = false) => {
        // Resolve time range
        let timeTo: number;
        let timeFrom: number;
        if (dateRange === 0) {
            if (!customFrom || !customTo) return;
            timeFrom = Math.floor(new Date(customFrom).getTime() / 1000);
            timeTo = Math.floor(new Date(customTo + 'T23:59:59').getTime() / 1000);
        } else {
            timeTo = Math.floor(Date.now() / 1000);
            timeFrom = timeTo - (dateRange * 24 * 60 * 60);
        }

        setLoading(true);
        setApiError(null);
        abortRef.current = false;

        const cache = loadCache();
        const now = Date.now();
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
                const resolved = await Promise.all(batch.map(o => fetchEscrowDetail(o)));
                resolved.forEach(r => { cache.items[r.order_sn] = r; });
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

    // Trigger custom range fetch when both dates are filled
    useEffect(() => {
        if (dateRange === 0 && customFrom && customTo && customFrom <= customTo) {
            fetchFinance();
        }
    }, [customFrom, customTo]);

    const totalBruto = items.reduce((acc, i) => acc + i.buyer_total_amount, 0);
    const totalFrete = items.reduce((acc, i) => acc + i.shipping_fee, 0);
    const totalSemFrete = items.reduce((acc, i) => acc + i.product_value, 0);
    const totalFees = items.reduce((acc, i) => acc + i.fee, 0);
    const totalLiquido = items.reduce((acc, i) => acc + i.escrow_amount, 0);
    const totalImposto = items.reduce((acc, i) => acc + calcOrderTax(i), 0);

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
                        <option value={0}>📅 Período personalizado</option>
                    </select>
                    {dateRange === 0 && (
                        <div className="flex items-center gap-2">
                            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} max={customTo || undefined}
                                className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm text-slate-700 outline-none" />
                            <span className="text-slate-400 text-sm">até</span>
                            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} min={customFrom || undefined}
                                className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm text-slate-700 outline-none" />
                        </div>
                    )}
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

            {/* Simples Nacional Config Panel */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl overflow-hidden">
                <button onClick={() => setShowTaxConfig(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">🇧🇷</span>
                        <div>
                            <p className="text-sm font-bold text-indigo-800">Simples Nacional — Configuração de Imposto</p>
                            {taxResult ? (
                                <p className="text-xs text-indigo-600">
                                    {SIMPLES_ANEXOS[taxConfig.anexo]?.name} · Faixa {taxResult.faixa}ª ·
                                    Alíquota efetiva: <strong>{fmtPct(taxResult.aliquotaEfetiva)}</strong> ·
                                    Base: {taxConfig.baseCalculo === 'bruto' ? 'Bruto total (com frete)' : 'Sem frete'}
                                </p>
                            ) : (
                                <p className="text-xs text-indigo-500">Clique para configurar e ver o imposto estimado por pedido.</p>
                            )}
                        </div>
                    </div>
                    <span className="text-indigo-400 text-sm">{showTaxConfig ? '▲' : '▼'}</span>
                </button>

                {showTaxConfig && (
                    <div className="px-5 pb-5 space-y-4 border-t border-indigo-200 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* RBT12 */}
                            <div>
                                <label className="block text-xs font-bold text-indigo-700 mb-1">
                                    Receita Bruta 12 meses (RBT12)
                                </label>
                                <input type="number" placeholder="Ex: 360000"
                                    value={rbt12Input}
                                    onChange={e => setRbt12Input(e.target.value)}
                                    onBlur={() => {
                                        const val = parseFloat(rbt12Input.replace(',', '.')) || 0;
                                        saveTax({ ...taxConfig, rbt12: val });
                                    }}
                                    className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                                <p className="text-xs text-indigo-400 mt-1">Faturamento total dos últimos 12 meses (R$)</p>
                            </div>

                            {/* Anexo */}
                            <div>
                                <label className="block text-xs font-bold text-indigo-700 mb-1">Anexo do Simples Nacional</label>
                                <select value={taxConfig.anexo}
                                    onChange={e => saveTax({ ...taxConfig, anexo: e.target.value })}
                                    className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300">
                                    {Object.entries(SIMPLES_ANEXOS).map(([k, v]) => (
                                        <option key={k} value={k}>{v.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Base de cálculo */}
                            <div>
                                <label className="block text-xs font-bold text-indigo-700 mb-1">Base de cálculo do imposto</label>
                                <select value={taxConfig.baseCalculo}
                                    onChange={e => saveTax({ ...taxConfig, baseCalculo: e.target.value as 'bruto' | 'semFrete' })}
                                    className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300">
                                    <option value="semFrete">Sem frete ✓ (padrão Shopee)</option>
                                    <option value="bruto">Bruto total (com frete)</option>
                                </select>
                                <p className="text-xs text-indigo-400 mt-1">
                                    Na Shopee o frete vai direto à transportadora, não entra na base tributária.
                                </p>
                            </div>
                        </div>

                        {taxResult && (
                            <div className="bg-white/70 rounded-xl px-4 py-3 border border-indigo-100 text-sm text-indigo-800">
                                <span className="font-bold">📊 Resultado:</span> RBT12 de {fmt(taxConfig.rbt12)} →
                                <strong> {SIMPLES_ANEXOS[taxConfig.anexo]?.name}</strong>,
                                Faixa <strong>{taxResult.faixa}ª</strong>,
                                Alíquota nominal <strong>{fmtPct(taxResult.aliquotaNominal)}</strong>,
                                Dedução <strong>{fmt(taxResult.deducao)}</strong>,
                                <span className="text-indigo-900"> → Alíquota efetiva: <strong className="text-lg">{fmtPct(taxResult.aliquotaEfetiva)}</strong></span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${taxResult ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>

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

                {/* Total Imposto Estimado */}
                {taxResult && (
                    <div className="bg-white rounded-2xl p-5 border-2 border-orange-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                                <span className="text-base">🧾</span>
                            </div>
                            <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wide">Imposto Estimado</h3>
                        </div>
                        <div className="text-2xl font-black text-orange-600">{fmt(totalImposto)}</div>
                        <div className="text-xs text-orange-500 mt-1">
                            {fmtPct(taxResult.aliquotaEfetiva)} · Simples Anexo {taxConfig.anexo}
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="py-3 px-4 font-bold text-slate-600">Data</th>
                                <th className="py-3 px-4 font-bold text-slate-600">Pedido</th>
                                <th className="py-3 px-4 font-bold text-slate-600 text-right">Bruto</th>
                                <th className="py-3 px-4 font-bold text-slate-600 text-right">Frete</th>
                                <th className="py-3 px-4 font-bold text-blue-700 text-right">Sem Frete ★</th>
                                <th className="py-3 px-4 font-bold text-slate-600 text-right">Taxas</th>
                                <th className="py-3 px-4 font-bold text-slate-600 text-right">Líquido</th>
                                {taxResult && <th className="py-3 px-4 font-bold text-orange-600 text-right">Imposto 🧾</th>}
                                <th className="py-3 px-4 font-bold text-slate-600 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        {progress || 'Buscando dados...'}
                                    </td>
                                </tr>
                            ) : items.length === 0 && !apiError ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        Nenhum pedido encontrado neste período.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {items
                                        .slice()
                                        .sort((a, b) => (b.create_time || 0) - (a.create_time || 0))
                                        .map(item => {
                                            const dateStr = item.create_time
                                                ? new Date(item.create_time * 1000).toLocaleDateString('pt-BR')
                                                : '—';
                                            const shopeeUrl = `https://seller.shopee.com.br/portal/sale/detail?ordersn=${item.order_sn}`;

                                            const statusBadge = () => {
                                                switch (item.order_status) {
                                                    case 'COMPLETED':
                                                        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold inline-flex items-center gap-1"><Check className="w-3 h-3" /> Concluído</span>;
                                                    case 'CANCELLED':
                                                    case 'IN_CANCEL':
                                                        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">Cancelado</span>;
                                                    case 'REFUNDED':
                                                    case 'IN_REFUND':
                                                        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Devolvido</span>;
                                                    default:
                                                        return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{item.order_status}</span>;
                                                }
                                            };

                                            return (
                                                <tr key={item.order_sn} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">{dateStr}</td>
                                                    <td className="py-3 px-4">
                                                        <a href={shopeeUrl} target="_blank" rel="noopener noreferrer"
                                                            className="font-bold text-orange-600 hover:text-orange-800 hover:underline transition-colors">
                                                            #{item.order_sn}
                                                        </a>
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-slate-700">{fmt(item.buyer_total_amount)}</td>
                                                    <td className="py-3 px-4 text-right text-slate-500">{fmt(item.shipping_fee)}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-blue-700">{fmt(item.product_value)}</td>
                                                    <td className="py-3 px-4 text-right text-red-600 font-medium">{item.fee > 0 ? `-${fmt(item.fee)}` : '—'}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-green-600">{item.escrow_amount > 0 ? fmt(item.escrow_amount) : '—'}</td>
                                                    {taxResult && (
                                                        <td className="py-3 px-4 text-right font-bold text-orange-600">
                                                            {item.buyer_total_amount > 0 ? fmt(calcOrderTax(item)) : '—'}
                                                        </td>
                                                    )}
                                                    <td className="py-3 px-4 text-center">{statusBadge()}</td>
                                                </tr>
                                            );
                                        })}
                                    {loading && (
                                        <tr>
                                            <td colSpan={taxResult ? 9 : 8} className="py-3 text-center text-slate-400 text-xs">
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
