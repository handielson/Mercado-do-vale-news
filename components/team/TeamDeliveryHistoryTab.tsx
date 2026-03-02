import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Clock, CheckCircle, XCircle, DollarSign, Loader2, Search, Filter, Printer, Calendar } from 'lucide-react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface DeliveryRecord {
    id: string;
    sale_id: string;
    amount: number;
    delivery_type: string;
    status: 'pending' | 'paid' | 'cancelled';
    created_at: string;
    paid_at?: string;
    customer_name?: string;
}

export interface TeamDeliveryHistoryTabProps {
    memberId: string;
    memberName: string;
}

const STATUS_CONFIG = {
    pending: { label: 'Pendente', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    paid: { label: 'Pago', icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' },
    cancelled: { label: 'Cancelado', icon: XCircle, color: 'text-slate-500 bg-slate-50 border-slate-200' },
};

const DELIVERY_TYPE_LABELS: Record<string, string> = {
    store_delivery: 'Entrega Loja',
    hybrid_delivery: 'Entrega Híbrida',
    delivery: 'Entrega',
    hybrid: 'Híbrida',
};

const fmt = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const toISO = (d: Date) => d.toISOString().split('T')[0];

export default function TeamDeliveryHistoryTab({ memberId, memberName }: TeamDeliveryHistoryTabProps) {
    const [records, setRecords] = useState<DeliveryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [payingId, setPayingId] = useState<string | null>(null);

    // Filtros
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const loadHistory = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('delivery_credits')
            .select(`*, sales ( customers ( name ) )`)
            .eq('delivery_person_id', memberId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setRecords(data.map((r: any) => ({
                id: r.id,
                sale_id: r.sale_id,
                amount: r.amount,
                delivery_type: r.delivery_type,
                status: r.status,
                created_at: r.created_at,
                paid_at: r.paid_at,
                customer_name: r.sales?.customers?.name ?? '—',
            })));
        }
        setLoading(false);
    }, [memberId]);

    useEffect(() => { if (memberId) loadHistory(); }, [memberId, loadHistory]);

    const handleMarkPaid = async (record: DeliveryRecord) => {
        setPayingId(record.id);
        try {
            const { error } = await supabase
                .from('delivery_credits')
                .update({ status: 'paid', paid_at: new Date().toISOString() })
                .eq('id', record.id);
            if (error) throw error;
            toast.success(`Entrega de ${record.customer_name} marcada como paga!`);
            await loadHistory();
        } catch (e: any) {
            toast.error('Erro ao registrar pagamento');
        } finally {
            setPayingId(null);
        }
    };

    // Atalhos de data
    const applyPeriod = (unit: 'day' | 'week' | 'month') => {
        const d = new Date();
        if (unit === 'day') { setDateFrom(toISO(d)); }
        else if (unit === 'week') { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); setDateFrom(toISO(s)); }
        else if (unit === 'month') { const s = new Date(d.getFullYear(), d.getMonth(), 1); setDateFrom(toISO(s)); }
        setDateTo(toISO(d));
    };

    // Filtragem
    const filtered = useMemo(() => records.filter(r => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (search) {
            const s = search.toLowerCase();
            if (!r.customer_name?.toLowerCase().includes(s)) return false;
        }
        if (dateFrom && new Date(r.created_at) < new Date(dateFrom + 'T00:00:00')) return false;
        if (dateTo && new Date(r.created_at) > new Date(dateTo + 'T23:59:59')) return false;
        return true;
    }), [records, statusFilter, search, dateFrom, dateTo]);

    // Totais (dos registros filtrados)
    const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);
    const pendingAmount = filtered.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
    const paidAmount = filtered.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);

    // Impressão do histórico
    const handlePrint = () => {
        const rows = filtered.map(r => `
            <tr>
                <td>${fmtDate(r.created_at)}</td>
                <td>${r.customer_name}</td>
                <td>${DELIVERY_TYPE_LABELS[r.delivery_type] || r.delivery_type}</td>
                <td style="text-align:right;font-family:monospace">${fmt(r.amount)}</td>
                <td style="text-align:center">${STATUS_CONFIG[r.status].label}</td>
                <td style="text-align:center">${r.paid_at ? fmtDate(r.paid_at) : '—'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Histórico de Entregas — ${memberName}</title>
<style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin-bottom:4px}
    p.sub{font-size:12px;color:#666;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f1f5f9;border:1px solid #e2e8f0;padding:8px;text-align:left}
    td{border:1px solid #e2e8f0;padding:7px}
    .summary{display:flex;gap:24px;margin-bottom:20px;font-size:13px}
    .summary span{font-weight:700}
    @media print{@page{size:A4 landscape;margin:16mm}}
</style></head><body>
<h1>Histórico de Entregas</h1>
<p class="sub">Entregador: <strong>${memberName}</strong> — Gerado em ${new Date().toLocaleString('pt-BR')}</p>
<div class="summary">
    <div>Total: <span>${fmt(totalAmount)}</span></div>
    <div>A Pagar: <span style="color:#b45309">${fmt(pendingAmount)}</span></div>
    <div>Pago: <span style="color:#15803d">${fmt(paidAmount)}</span></div>
    <div>Entregas: <span>${filtered.length}</span></div>
</div>
<table>
    <thead><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th>Valor</th><th>Status</th><th>Pago em</th></tr></thead>
    <tbody>${rows}</tbody>
</table>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;

        const pw = window.open('', '_blank');
        if (!pw) { toast.error('Permita popups para imprimir'); return; }
        pw.document.write(html);
        pw.document.close();
    };

    if (loading) {
        return (
            <div className="py-12 text-center">
                <div className="inline-block w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="mt-3 text-sm text-slate-500">Carregando histórico...</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Resumo financeiro */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Total Gerado</p>
                    <p className="text-lg font-bold text-slate-800">{fmt(totalAmount)}</p>
                    <p className="text-xs text-slate-400">{filtered.length} entregas</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-amber-600 mb-1">A Pagar</p>
                    <p className="text-lg font-bold text-amber-700">{fmt(pendingAmount)}</p>
                    <p className="text-xs text-amber-500">{filtered.filter(r => r.status === 'pending').length} pendentes</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-green-600 mb-1">Já Pago</p>
                    <p className="text-lg font-bold text-green-700">{fmt(paidAmount)}</p>
                    <p className="text-xs text-green-500">{filtered.filter(r => r.status === 'paid').length} pagamentos</p>
                </div>
            </div>

            {/* Barra de filtros */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Busca */}
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            placeholder="Buscar por cliente..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    {/* Status */}
                    <div className="flex items-center gap-2">
                        <Filter className="text-slate-400" size={15} />
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="all">Todos</option>
                            <option value="pending">Pendentes</option>
                            <option value="paid">Pagos</option>
                            <option value="cancelled">Cancelados</option>
                        </select>
                    </div>
                    {/* Botão imprimir */}
                    <button
                        onClick={handlePrint}
                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                    >
                        <Printer size={15} />
                        Imprimir Histórico
                    </button>
                </div>

                {/* Filtros de data */}
                <div className="flex flex-wrap gap-3 items-center">
                    <Calendar className="text-slate-400" size={15} />
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">De:</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Até:</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button onClick={() => applyPeriod('day')} className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors">Hoje</button>
                    <button onClick={() => applyPeriod('week')} className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors">Semana</button>
                    <button onClick={() => applyPeriod('month')} className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors">Mês</button>
                    {(dateFrom || dateTo || search || statusFilter !== 'all') && (
                        <button onClick={() => { setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo(''); }}
                            className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 border border-red-200 rounded text-red-600 transition-colors">
                            Limpar
                        </button>
                    )}
                    {filtered.length !== records.length && (
                        <span className="ml-auto text-xs text-slate-400">{filtered.length} de {records.length} entregas</span>
                    )}
                </div>
            </div>

            {/* Tabela */}
            {filtered.length === 0 ? (
                <div className="py-12 text-center bg-white border border-slate-200 rounded-lg">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Nenhuma entrega encontrada</p>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Data</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">Valor</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(record => {
                                const cfg = STATUS_CONFIG[record.status];
                                const Icon = cfg.icon;
                                const isPaying = payingId === record.id;
                                return (
                                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(record.created_at)}</td>
                                        <td className="px-4 py-3 text-slate-800 font-medium">{record.customer_name}</td>
                                        <td className="px-4 py-3 text-slate-600">{DELIVERY_TYPE_LABELS[record.delivery_type] || record.delivery_type}</td>
                                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">{fmt(record.amount)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                                                <Icon className="w-3 h-3" />{cfg.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {record.status === 'pending' ? (
                                                <button
                                                    onClick={() => handleMarkPaid(record)}
                                                    disabled={isPaying}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                                                >
                                                    {isPaying ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                                                    Pagar
                                                </button>
                                            ) : record.status === 'paid' && record.paid_at ? (
                                                <span className="text-xs text-slate-400">{fmtDate(record.paid_at)}</span>
                                            ) : <span className="text-slate-300">—</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
