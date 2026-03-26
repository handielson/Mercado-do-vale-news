import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2, AlertCircle, Check, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface EscrowItem {
    order_sn: string;
    buyer_total_amount: number;
    escrow_amount: number;
    fee: number;
}

const fmt = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

async function safeRefreshToken() {
    const r = await fetch('/api/shopee-actions?action=refresh_token');
    return r.ok;
}

export default function ShopeeFinanceTab() {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<EscrowItem[]>([]);
    const [apiError, setApiError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState(30);

    const fetchFinance = async (retry = false) => {
        setLoading(true);
        setApiError(null);
        setItems([]);
        try {
            const timeTo = Math.floor(Date.now() / 1000);
            const timeFrom = timeTo - (dateRange * 24 * 60 * 60);

            // 1. Buscar pedidos COMPLETED no período
            const listRes = await fetch(`/api/shopee-actions?action=get_order_list&time_from=${timeFrom}&time_to=${timeTo}&page_size=50&order_status=COMPLETED`);
            const listData = await listRes.json();

            if (listData.error === 'invalid_access_token' || listData.error === 'error_auth') {
                if (!retry) {
                    const ok = await safeRefreshToken();
                    if (ok) return fetchFinance(true);
                }
                setApiError('Sessão expirada. Vá em Configurações e vincule a loja novamente.');
                return;
            }

            if (listData.error) {
                setApiError(listData.message || listData.error);
                return;
            }

            const orderList: { order_sn: string }[] = listData.response?.order_list || [];
            if (orderList.length === 0) {
                setItems([]);
                return;
            }

            // 2. Buscar escrow de cada pedido em paralelo (grupos de 5 pra não sobrecarregar)
            const results: EscrowItem[] = [];
            const chunks: typeof orderList[] = [];
            for (let i = 0; i < orderList.length; i += 5) {
                chunks.push(orderList.slice(i, i + 5));
            }

            for (const chunk of chunks) {
                const promises = chunk.map(async (o) => {
                    try {
                        const r = await fetch(`/api/shopee-actions?action=get_escrow_detail&order_sn=${o.order_sn}`);
                        const d = await r.json();
                        const income = d.response?.order_income;
                        if (!income) return null;

                        const buyer_total = income.buyer_total_amount || 0;
                        const escrow = income.escrow_amount || 0;
                        const fee = buyer_total - escrow;
                        return { order_sn: o.order_sn, buyer_total_amount: buyer_total, escrow_amount: escrow, fee };
                    } catch {
                        return null;
                    }
                });
                const resolved = await Promise.all(promises);
                resolved.forEach(r => { if (r) results.push(r); });
            }

            setItems(results);
        } catch {
            setApiError('Erro de conexão ao buscar financeiro Shopee.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFinance();
    }, [dateRange]);

    const totalBruto = items.reduce((acc, i) => acc + i.buyer_total_amount, 0);
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
                    <p className="text-sm text-slate-500 mt-1">
                        Receitas e taxas dos pedidos concluídos nos últimos {dateRange} dias.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(Number(e.target.value))}
                        className="px-4 py-2 border border-slate-200 bg-white rounded-xl text-sm font-medium text-slate-700 outline-none"
                    >
                        <option value={7}>Últimos 7 dias</option>
                        <option value={15}>Últimos 15 dias</option>
                        <option value={30}>Últimos 30 dias</option>
                        <option value={60}>Últimos 60 dias</option>
                    </select>
                    <button
                        onClick={() => fetchFinance()}
                        disabled={loading}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
                    >
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

            {/* Cards */}
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
                        <Calendar className="w-3 h-3" /> {items.length} pedido(s) concluído(s)
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

            {/* Table */}
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
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Buscando dados financeiros...
                                    </td>
                                </tr>
                            ) : items.length === 0 && !apiError ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                                        Nenhum pedido concluído encontrado neste período.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
