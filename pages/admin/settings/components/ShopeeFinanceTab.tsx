import React, { useState, useEffect } from 'react';
import { DollarSign, Search, Calendar, Loader2, ArrowUpRight, ArrowDownRight, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function ShopeeFinanceTab() {
    const [loading, setLoading] = useState(false);
    const [escrowList, setEscrowList] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState(30); // days
    const [searchTerm, setSearchTerm] = useState('');

    const fetchEscrow = async () => {
        setLoading(true);
        try {
            const timeTo = Math.floor(Date.now() / 1000);
            const timeFrom = timeTo - (dateRange * 24 * 60 * 60);

            const res = await fetch(`/api/shopee-actions?action=get_escrow_list&time_from=${timeFrom}&time_to=${timeTo}&page_size=100`);
            const data = await res.json();

            // Auto-refresh logic interceptor
            if (data.error === 'invalid_access_token' || data.error === 'error_auth') {
                toast.loading('Sessão expirada. Renovando token automaticamente...', { id: 'shopee-auth' });
                const rRefresh = await fetch('/api/shopee-actions?action=refresh_token');
                if (rRefresh.ok) {
                    toast.success('Sessão renovada! Carregando financeiro...', { id: 'shopee-auth' });
                    return fetchEscrow();
                } else {
                    toast.error('Token expirado há muito tempo. Por favor, conecte a loja novamente na aba Configurações.', { id: 'shopee-auth', duration: 10000 });
                    setLoading(false);
                    return;
                }
            }

            if (data.error) {
                toast.error(`Erro ao buscar financeiro: ${data.error}`);
            } else {
                setEscrowList(data.response?.escrow_list || []);
            }
        } catch (error) {
            toast.error('Erro de conexão ao buscar financeiro Shopee.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEscrow();
    }, [dateRange]);

    const filteredList = escrowList.filter(e => e.order_sn.toLowerCase().includes(searchTerm.toLowerCase()));

    const totalReleased = filteredList.reduce((acc, curr) => acc + (curr.escrow_amount || 0), 0);
    const totalFees = filteredList.reduce((acc, curr) => acc + (curr.commission_fee || 0) + (curr.service_fee || 0) + (curr.seller_transaction_fee || 0), 0);
    const totalGross = filteredList.reduce((acc, curr) => acc + (curr.original_price || 0), 0); // Not always accurate if discounts apply, but escrow_amount + fees is good enough

    const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <DollarSign className="w-6 h-6 text-green-600" />
                        Extrato Shopee
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Visualize os repasses financeiros e pagamentos liberados pela Shopee.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar pedido..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ee4d2d]/20 focus:border-[#ee4d2d] transition-all"
                        />
                    </div>
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
                        onClick={fetchEscrow}
                        disabled={loading}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <DollarSign className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-600">Vendas Brutas (Estimado)</h3>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{fmt(totalReleased + totalFees)}</div>
                    <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Nos últimos {dateRange} dias
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <ArrowDownRight className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                            <ArrowDownRight className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-600">Taxas Retidas Shopee</h3>
                    </div>
                    <div className="text-3xl font-black text-red-600">{fmt(totalFees)}</div>
                    <div className="text-xs text-slate-500 mt-2">
                        Comissões e taxas de serviço
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <ArrowUpRight className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                            <ArrowUpRight className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-600">Líquido Liberado</h3>
                    </div>
                    <div className="text-3xl font-black text-green-600">{fmt(totalReleased)}</div>
                    <div className="text-xs text-green-600 bg-green-50 inline-block px-2 py-0.5 rounded-full mt-2 font-medium">
                        Disponibilizado na Carteira
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-sm">
                                <th className="py-4 px-6 font-bold text-slate-600">ID do Pedido</th>
                                <th className="py-4 px-6 font-bold text-slate-600">Data de Liberação</th>
                                <th className="py-4 px-6 font-bold text-slate-600 text-right">Taxas (R$)</th>
                                <th className="py-4 px-6 font-bold text-slate-600 text-right">Líquido (R$)</th>
                                <th className="py-4 px-6 font-bold text-slate-600 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Buscando extrato financeiro...
                                    </td>
                                </tr>
                            ) : filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-500">
                                        Nenhum repasse encontrado neste período.
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map((item, index) => {
                                    const fee = (item.commission_fee || 0) + (item.service_fee || 0) + (item.seller_transaction_fee || 0);
                                    
                                    // Escrow list API returns release_time or we don't have it natively in typical view, verify shoppee docs
                                    // Normally we have escrow_amount, order_sn
                                    return (
                                        <tr key={item.order_sn + index} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-bold text-slate-800">#{item.order_sn}</div>
                                            </td>
                                            <td className="py-4 px-6 text-sm text-slate-600">
                                                -
                                            </td>
                                            <td className="py-4 px-6 text-right text-sm text-red-600 font-medium">
                                                {fmt(fee)}
                                            </td>
                                            <td className="py-4 px-6 text-right font-bold text-green-600">
                                                {fmt(item.escrow_amount)}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Liberado
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
