import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2, AlertCircle, Check, Calendar, Download } from 'lucide-react';
import { toast } from 'sonner';

interface EscrowItem {
    order_sn: string;
    buyer_total_amount: number;
    escrow_amount: number;
    fee: number;
}

const fmt = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const CHUNK_DAYS = 14; // Shopee max is 15 days per request

async function safeRefreshToken() {
    const r = await fetch('/api/shopee-actions?action=refresh_token');
    return r.ok;
}

async function fetchOrdersChunk(timeFrom: number, timeTo: number): Promise<{ order_sn: string }[]> {
    const res = await fetch(`/api/shopee-actions?action=get_order_list&time_from=${timeFrom}&time_to=${timeTo}&page_size=50&order_status=COMPLETED`);
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
        const escrow = income.escrow_amount || 0;
        return { order_sn: orderSn, buyer_total_amount: buyer_total, escrow_amount: escrow, fee: buyer_total - escrow };
    } catch { return null; }
}

function exportCSV(items: EscrowItem[], dateRange: number) {
    const header = 'Pedido,Vendas Brutas (R$),Taxas Shopee (R$),Líquido Recebido (R$)\n';
    const rows = items.map(i =>
        `${i.order_sn},${i.buyer_total_amount.toFixed(2)},${i.fee.toFixed(2)},${i.escrow_amount.toFixed(2)}`
    ).join('\n');

    const total = `TOTAL,${items.reduce((a, i) => a + i.buyer_total_amount, 0).toFixed(2)},${items.reduce((a, i) => a + i.fee, 0).toFixed(2)},${items.reduce((a, i) => a + i.escrow_amount, 0).toFixed(2)}`;

    const csv = header + rows + '\n' + total;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `shopee-financeiro-${dateRange}d-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function ShopeeFinanceTab() {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<EscrowItem[]>([]);
    const [apiError, setApiError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState(30);
    const [progress, setProgress] = useState('');
    const abortRef = useRef(false);

    const fetchFinance = async (retry = false) => {
        setLoading(true);
        setApiError(null);
        setItems([]);
        setProgress('');
        abortRef.current = false;

        try {
            const timeTo = Math.floor(Date.now() / 1000);
            const timeFrom = timeTo - (dateRange * 24 * 60 * 60);
            const chunkSecs = CHUNK_DAYS * 24 * 60 * 60;

            const chunks: { from: number; to: number }[] = [];
            let cursor = timeFrom;
            while (cursor < timeTo) {
                const end = Math.min(cursor + chunkSecs, timeTo);
                chunks.push({ from: cursor, to: end });
                cursor = end;
            }

            let allOrders: { order_sn: string }[] = [];
            for (let i = 0; i < chunks.length; i++) {
                if (abortRef.current) return;
                setProgress(`Buscando pedidos... (período ${i + 1}/${chunks.length})`);
                try {
                    const chunk = await fetchOrdersChunk(chunks[i].from, chunks[i].to);
                    allOrders = [...allOrders, ...chunk];
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

            const unique = Array.from(new Map(allOrders.map(o => [o.order_sn, o])).values());

            if (unique.length === 0) {
                setItems([]);
                return;
            }

            // Batch size 10 for speed (365 days can have many orders)
            const results: EscrowItem[] = [];
            const BATCH = 10;
            for (let i = 0; i < unique.length; i += BATCH) {
                if (abortRef.current) return;
                const batch = unique.slice(i, i + BATCH);
                setProgress(`Calculando financeiro... (${Math.min(i + BATCH, unique.length)} de ${unique.length} pedidos)`);
                const resolved = await Promise.all(batch.map(o => fetchEscrowDetail(o.order_sn)));
                resolved.forEach(r => { if (r) results.push(r); });
                // Update incrementally so user sees data appearing
                setItems([...results]);
            }

        } catch (e: any) {
            setApiError(e.message || 'Erro de conexão ao buscar financeiro Shopee.');
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
    const totalFees = items.reduce((acc, i) => acc + i.fee, 0);
    const totalLiquido = items.reduce((acc, i) => acc + i.escrow_amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <DollarSign className="w-6 h-6 text-green-600" />
                        Financeiro Shopee
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Receitas e taxas dos pedidos concluídos — histórico contábil.
                    </p>
                </div>
                <div className="flex items-center gap-3">
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
                            <Download className="w-4 h-4" />
                            CSV
                        </button>
                    )}
                    <button onClick={() => fetchFinance()} disabled={loading}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {dateRange >= 365 && !loading && items.length === 0 && !apiError && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-800">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm">O relatório de 365 dias pode levar alguns minutos. Os dados aparecem progressivamente enquanto carregam.</p>
                </div>
            )}

            {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{apiError}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-slate-600" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-600">Vendas Brutas</h3>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{fmt(totalBruto)}</div>
                    <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {items.length} pedido(s) {loading ? '(carregando...)' : 'concluído(s)'}
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                            <ArrowDownRight className="w-5 h-5 text-red-600" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-600">Taxas Shopee</h3>
                    </div>
                    <div className="text-3xl font-black text-red-600">{fmt(totalFees)}</div>
                    <div className="text-xs text-slate-400 mt-2">Comissão + Serviço + Transação</div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                            <ArrowUpRight className="w-5 h-5 text-green-600" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-600">Líquido Recebido</h3>
                    </div>
                    <div className="text-3xl font-black text-green-600">{fmt(totalLiquido)}</div>
                    <div className="text-xs text-green-600 bg-green-50 inline-block px-2 py-0.5 rounded-full mt-2 font-medium">
                        ✓ Disponível na Carteira
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-sm">
                                <th className="py-4 px-6 font-bold text-slate-600">Pedido</th>
                                <th className="py-4 px-6 font-bold text-slate-600 text-right">Bruto</th>
                                <th className="py-4 px-6 font-bold text-slate-600 text-right">Taxas</th>
                                <th className="py-4 px-6 font-bold text-slate-600 text-right">Líquido</th>
                                <th className="py-4 px-6 font-bold text-slate-600 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        {progress || 'Buscando dados financeiros...'}
                                    </td>
                                </tr>
                            ) : items.length === 0 && !apiError ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                                        Nenhum pedido concluído encontrado neste período.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {items.map(item => (
                                        <tr key={item.order_sn} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-4 px-6 font-bold text-slate-800">#{item.order_sn}</td>
                                            <td className="py-4 px-6 text-right text-sm text-slate-700">{fmt(item.buyer_total_amount)}</td>
                                            <td className="py-4 px-6 text-right text-sm text-red-600 font-medium">-{fmt(item.fee)}</td>
                                            <td className="py-4 px-6 text-right font-bold text-green-600">{fmt(item.escrow_amount)}</td>
                                            <td className="py-4 px-6 text-center">
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Concluído
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {loading && (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-center text-slate-400 text-sm">
                                                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
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
