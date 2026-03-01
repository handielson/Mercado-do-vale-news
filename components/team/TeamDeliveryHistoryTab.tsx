import React, { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface DeliveryRecord {
    id: string;
    sale_id: string;
    amount: number;
    delivery_type: string;
    status: 'pending' | 'paid' | 'cancelled';
    created_at: string;
    paid_at?: string;
}

interface TeamDeliveryHistoryTabProps {
    memberId: string;
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

const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function TeamDeliveryHistoryTab({ memberId }: TeamDeliveryHistoryTabProps) {
    const [records, setRecords] = useState<DeliveryRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('delivery_credits')
                .select('*')
                .eq('delivery_person_id', memberId)
                .order('created_at', { ascending: false });

            if (!error && data) setRecords(data);
            setLoading(false);
        };

        if (memberId) loadHistory();
    }, [memberId]);

    // Totais
    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
    const pendingAmount = records.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);
    const paidAmount = records.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);

    if (loading) {
        return (
            <div className="py-12 text-center">
                <div className="inline-block w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="mt-3 text-sm text-slate-500">Carregando histórico...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Resumo financeiro */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Total Gerado</p>
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(totalAmount)}</p>
                    <p className="text-xs text-slate-400">{records.length} entregas</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-amber-600 mb-1">A Receber</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(pendingAmount)}</p>
                    <p className="text-xs text-amber-500">{records.filter(r => r.status === 'pending').length} pendentes</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-green-600 mb-1">Já Pago</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(paidAmount)}</p>
                    <p className="text-xs text-green-500">{records.filter(r => r.status === 'paid').length} pagamentos</p>
                </div>
            </div>

            {/* Lista de entregas */}
            {records.length === 0 ? (
                <div className="py-12 text-center bg-white border border-slate-200 rounded-lg">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Nenhuma entrega registrada</p>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Data</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">Valor</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {records.map((record) => {
                                const cfg = STATUS_CONFIG[record.status];
                                const Icon = cfg.icon;
                                return (
                                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-600">{formatDate(record.created_at)}</td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {DELIVERY_TYPE_LABELS[record.delivery_type] || record.delivery_type}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                                            {formatCurrency(record.amount)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                                                <Icon className="w-3 h-3" />
                                                {cfg.label}
                                            </span>
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
