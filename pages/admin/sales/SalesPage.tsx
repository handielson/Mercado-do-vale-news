import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Search, Filter, ArrowUpRight, ArrowDownRight, MoreVertical, Calendar, DollarSign, RefreshCw, XCircle, RotateCcw, TrendingUp } from 'lucide-react';
import { SaleWithItems, SaleSummary, SaleFilters } from '../../../types/sale';
import { getSales, getSalesSummary, cancelSale, refundSale } from '../../../services/saleService';
import SaleDetailsModal from '../../../components/admin/sales/SaleDetailsModal';
import toast from 'react-hot-toast';

export default function SalesPage() {
    const [sales, setSales] = useState<SaleWithItems[]>([]);
    const [summary, setSummary] = useState<SaleSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState<SaleFilters>({});

    // Filtros UI
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled' | 'refunded'>('all');

    // Modal Controle
    const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filtros de data
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activePeriod, setActivePeriod] = useState<'day' | 'week' | 'month' | 'year' | 'custom' | null>(null);

    const toISO = (d: Date) => d.toISOString().split('T')[0];
    const startOf = (unit: 'day' | 'week' | 'month' | 'year') => {
        const d = new Date();
        if (unit === 'day') { d.setHours(0, 0, 0, 0); }
        else if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); }
        else if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); }
        else if (unit === 'year') { d.setMonth(0, 1); d.setHours(0, 0, 0, 0); }
        return d;
    };

    const applyPeriod = (p: 'day' | 'week' | 'month' | 'year') => {
        setActivePeriod(p);
        setDateFrom(toISO(startOf(p)));
        setDateTo(toISO(new Date()));
    };

    const clearPeriod = () => {
        setActivePeriod(null);
        setDateFrom('');
        setDateTo('');
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const activeFilters: SaleFilters = { ...filters };
            if (statusFilter !== 'all') {
                activeFilters.status = statusFilter;
            }

            const [salesData, summaryData] = await Promise.all([
                getSales(activeFilters),
                getSalesSummary(activeFilters)
            ]);

            setSales(salesData);
            setSummary(summaryData);
        } catch (error) {
            console.error('Error loading sales data:', error);
            toast.error('Erro ao carregar dados de vendas');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filters, statusFilter]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value / 100);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800 border-green-200';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
            case 'refunded': return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return 'Concluída';
            case 'cancelled': return 'Cancelada';
            case 'refunded': return 'Estornada';
            default: return status;
        }
    };

    // Filtro local por busca textual e data
    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                if (!sale.customer?.name.toLowerCase().includes(s) && !sale.id.toLowerCase().includes(s)) return false;
            }
            if (dateFrom) {
                if (new Date(sale.created_at) < new Date(dateFrom + 'T00:00:00')) return false;
            }
            if (dateTo) {
                if (new Date(sale.created_at) > new Date(dateTo + 'T23:59:59')) return false;
            }
            return true;
        });
    }, [sales, searchTerm, dateFrom, dateTo]);

    // Totais por período (calculados das vendas já carregadas)
    const periodStats = useMemo(() => {
        const calc = (from: Date) => {
            const s = sales.filter(v => v.status === 'completed' && new Date(v.created_at) >= from);
            return { count: s.length, total: s.reduce((acc, v) => acc + v.total, 0) };
        };
        return {
            day: calc(startOf('day')),
            week: calc(startOf('week')),
            month: calc(startOf('month')),
            year: calc(startOf('year')),
        };
    }, [sales]);

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                        <ShoppingBag className="text-blue-600" size={32} />
                        Gestão de Vendas
                    </h2>
                    <p className="text-slate-500 mt-1">Acompanhe e gerencie todas as vendas do PDV</p>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <DollarSign size={20} />
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-600 rounded-full">
                            Total
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Faturamento Bruto</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {summary ? formatCurrency(summary.total_revenue) : 'R$ 0,00'}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <ArrowUpRight size={20} />
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">
                            Líquido
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Lucro Real</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {summary ? formatCurrency(summary.total_profit) : 'R$ 0,00'}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <ShoppingBag size={20} />
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 bg-purple-50 text-purple-600 rounded-full">
                            Volume
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Ticket Médio</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {summary ? formatCurrency(summary.average_ticket) : 'R$ 0,00'}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                            <ArrowDownRight size={20} />
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 bg-orange-50 text-orange-600 rounded-full">
                            Métrica
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Margem de Lucro</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {summary ? summary.profit_margin.toFixed(1) : '0'}%
                        </h3>
                    </div>
                </div>
            </div>

            {/* Cards de Período */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {([
                    { key: 'day', label: 'Hoje', color: 'blue', icon: '📅' },
                    { key: 'week', label: 'Esta Semana', color: 'violet', icon: '📆' },
                    { key: 'month', label: 'Este Mês', color: 'emerald', icon: '🗓️' },
                    { key: 'year', label: 'Este Ano', color: 'amber', icon: '📊' },
                ] as const).map(({ key, label, icon }) => {
                    const s = periodStats[key];
                    const isActive = activePeriod === key;
                    return (
                        <button
                            key={key}
                            onClick={() => isActive ? clearPeriod() : applyPeriod(key)}
                            className={`text-left p-4 rounded-xl border-2 transition-all ${isActive
                                    ? 'border-blue-500 bg-blue-50 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-base">{icon}</span>
                                {isActive && <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">ATIVO</span>}
                            </div>
                            <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
                            <p className="text-lg font-bold text-slate-800">{formatCurrency(s.total)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{s.count} {s.count === 1 ? 'venda' : 'vendas'}</p>
                        </button>
                    );
                })}
            </div>

            {/* Filtros de Data + Busca + Status */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-3">
                    {/* Linha 1: busca + status */}
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por cliente ou ID da venda..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Filter className="text-slate-400" size={18} />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="all">Todos os Status</option>
                                <option value="completed">Apenas Concluídas</option>
                                <option value="cancelled">Canceladas</option>
                                <option value="refunded">Estornadas</option>
                            </select>
                        </div>
                    </div>
                    {/* Linha 2: filtros de data */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <Calendar className="text-slate-400" size={18} />
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-500 whitespace-nowrap">De:</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => { setDateFrom(e.target.value); setActivePeriod('custom'); }}
                                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-500 whitespace-nowrap">Até:</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => { setDateTo(e.target.value); setActivePeriod('custom'); }}
                                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        {(dateFrom || dateTo) && (
                            <button
                                onClick={clearPeriod}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            >
                                <XCircle size={14} />
                                Limpar filtro
                            </button>
                        )}
                        {filteredSales.length !== sales.length && (
                            <span className="text-xs text-slate-500 ml-auto">
                                Exibindo <strong>{filteredSales.length}</strong> de <strong>{sales.length}</strong> vendas
                            </span>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                                <th className="p-4 font-medium">Data / Hora</th>
                                <th className="p-4 font-medium">Pedido</th>
                                <th className="p-4 font-medium">Cliente</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium text-right">Total</th>
                                <th className="p-4 font-medium text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <RefreshCw className="animate-spin mb-2 text-blue-500" size={24} />
                                            <span>Carregando vendas...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        <div className="bg-slate-50 rounded-lg p-8 inline-block mt-4">
                                            <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
                                            <p className="font-medium text-slate-700">Nenhuma venda encontrada</p>
                                            <p className="text-sm">Tente ajustar seus filtros de busca ou status.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4">
                                            <div className="text-sm font-medium text-slate-800">
                                                {formatDate(sale.created_at).split(' ')[0]}
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                <Calendar size={12} />
                                                {formatDate(sale.created_at).split(' ')[1]}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm font-mono text-slate-600">
                                                {sale.id.split('-')[0]}
                                            </div>
                                            {sale.seller?.name && (
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    Vend: {sale.seller.name.split(' ')[0]}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm font-medium text-slate-800 line-clamp-1">
                                                {sale.customer?.name || 'Cliente Avulso'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(sale.status)}`}>
                                                {getStatusLabel(sale.status)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="text-sm font-bold text-slate-800">
                                                {formatCurrency(sale.total)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => {
                                                    setSelectedSale(sale);
                                                    setIsModalOpen(true);
                                                }}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-xs"
                                            >
                                                Ver Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Detalhes da Venda */}
            <SaleDetailsModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setTimeout(() => setSelectedSale(null), 300); // delay pro transition não bugar a interface
                }}
                sale={selectedSale}
                onStatusChange={loadData}
            />
        </div>
    );
}
