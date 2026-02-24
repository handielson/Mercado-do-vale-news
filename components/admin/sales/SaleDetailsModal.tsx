import React, { useState } from 'react';
import { ShoppingBag, X, Calendar, User, UserCheck, Package, DollarSign, CreditCard, Banknote, Truck, AlertCircle, RefreshCw } from 'lucide-react';
import { SaleWithItems } from '../../../types/sale';
import { cancelSale, refundSale } from '../../../services/saleService';
import toast from 'react-hot-toast';

interface SaleDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: SaleWithItems | null;
    onStatusChange: () => void; // Triggered after cancel or refund to reload lists
}

export default function SaleDetailsModal({ isOpen, onClose, sale, onStatusChange }: SaleDetailsModalProps) {
    const [isCancelling, setIsCancelling] = useState(false);
    const [isRefunding, setIsRefunding] = useState(false);

    if (!isOpen || !sale) return null;

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

    const handleCancel = async () => {
        if (!window.confirm('Tem certeza que deseja cancelar esta venda? Esta ação não pode ser desfeita e os cupons/entregas vinculados serão estornados.')) return;

        setIsCancelling(true);
        try {
            await cancelSale(sale.id);
            toast.success('Venda cancelada com sucesso!');
            onStatusChange();
            onClose();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Erro ao cancelar a venda');
        } finally {
            setIsCancelling(false);
        }
    };

    const handleRefund = async () => {
        if (!window.confirm('Tem certeza que deseja estornar esta venda? Use isso para devoluções parciais ou totais onde os valores foram devolvidos ao cliente.')) return;

        setIsRefunding(true);
        try {
            await refundSale(sale.id);
            toast.success('Venda estornada com sucesso!');
            onStatusChange();
            onClose();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Erro ao estornar a venda');
        } finally {
            setIsRefunding(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            case 'refunded': return 'bg-orange-100 text-orange-800';
            default: return 'bg-slate-100 text-slate-800';
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

    const getPaymentIcon = (method: string) => {
        switch (method) {
            case 'pix': return <Package size={16} className="text-teal-500" />;
            case 'money': return <Banknote size={16} className="text-emerald-500" />;
            case 'credit': return <CreditCard size={16} className="text-purple-500" />;
            case 'debit': return <CreditCard size={16} className="text-blue-500" />;
            default: return <DollarSign size={16} />;
        }
    };

    const getPaymentLabel = (method: string) => {
        switch (method) {
            case 'pix': return 'PIX';
            case 'money': return 'Dinheiro';
            case 'credit': return 'Crédito';
            case 'debit': return 'Débito';
            default: return method;
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-50 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white rounded-t-2xl shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-slate-800">
                                    Pedido #{sale.id.split('-')[0]}
                                </h2>
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusStyle(sale.status)}`}>
                                    {getStatusLabel(sale.status)}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {formatDate(sale.created_at)}
                                </span>
                                {sale.seller && (
                                    <span className="flex items-center gap-1">
                                        <UserCheck size={14} />
                                        Vendedor: {sale.seller.name.split(' ')[0]}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Customer Info */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <User size={16} className="text-slate-400" />
                            Dados do Cliente
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-medium">Nome</p>
                                <p className="text-sm font-medium text-slate-800">{sale.customer?.name || 'Cliente Avulso'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-medium">CPF/CNPJ</p>
                                <p className="text-sm text-slate-600">{sale.customer?.cpf_cnpj || 'Não informado'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Package size={16} className="text-slate-400" />
                            Itens do Pedido ({sale.items.length})
                        </h3>
                        <div className="space-y-3">
                            {sale.items.map((item, index) => (
                                <div key={index} className="flex justify-between items-start py-3 border-b border-slate-100 last:border-0 last:pb-0">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-slate-800">{item.product_name}</p>
                                            {item.is_gift && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded">
                                                    BRINDE
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            SKU: {item.product_sku || 'N/A'} • Qtd: {item.quantity}
                                            {item.discount > 0 ? ` • Desc: ${formatCurrency(item.discount)}/un` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        {item.discount > 0 && (
                                            <p className="text-xs text-slate-400 line-through">
                                                {formatCurrency(item.unit_price * item.quantity)}
                                            </p>
                                        )}
                                        <p className="text-sm font-bold text-slate-800">
                                            {formatCurrency(item.total)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Financial Summary & Payments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Summary */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <DollarSign size={16} className="text-slate-400" />
                                Resumo Financeiro
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal Produtos</span>
                                    <span>{formatCurrency(sale.subtotal)}</span>
                                </div>

                                {sale.promotional_discount ? (
                                    <div className="flex justify-between text-green-600">
                                        <span>Desconto Adicional (Cupom/Manual)</span>
                                        <span>-{formatCurrency(sale.promotional_discount)}</span>
                                    </div>
                                ) : null}

                                {sale.delivery_cost_customer ? (
                                    <div className="flex justify-between text-blue-600">
                                        <span>Taxa de Entrega (Cliente)</span>
                                        <span>+{formatCurrency(sale.delivery_cost_customer)}</span>
                                    </div>
                                ) : null}

                                <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between font-bold text-lg text-slate-800">
                                    <span>Total Pago</span>
                                    <span>{formatCurrency(sale.total)}</span>
                                </div>

                                <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between text-sm font-medium">
                                    <span className="text-emerald-600">Lucro Estimado</span>
                                    <span className="text-emerald-700">{formatCurrency(sale.profit)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Methods */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <CreditCard size={16} className="text-slate-400" />
                                Formas de Pagamento
                            </h3>
                            <div className="space-y-3">
                                {sale.payment_methods.map((payment, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            {getPaymentIcon(payment.method)}
                                            <div>
                                                <p className="text-sm font-medium text-slate-800">
                                                    {getPaymentLabel(payment.method)}
                                                    {payment.installments ? ` (${payment.installments}x)` : ''}
                                                </p>
                                                {payment.fee_amount ? (
                                                    <p className="text-xs text-slate-500">
                                                        Inclui {formatCurrency(payment.fee_amount)} de juros maq.
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                        <p className="text-sm font-bold text-slate-800">
                                            {formatCurrency(payment.total_with_fee)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Delivery Section (If Applicable) */}
                    {sale.delivery_type && sale.delivery_type !== 'store_pickup' && sale.delivery_type !== 'pickup' && (
                        <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                            <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                <Truck size={16} />
                                Dados de Logística
                            </h3>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-xs text-blue-600 uppercase font-medium">Tipo</p>
                                    <p className="font-medium text-slate-700 mt-1">
                                        {sale.delivery_type === 'store_delivery' || sale.delivery_type === 'delivery' ? 'Entrega Local' : 'Híbrida'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-blue-600 uppercase font-medium">Custo Pago ao Mktplace</p>
                                    <p className="font-medium text-slate-700 mt-1">
                                        {formatCurrency(sale.delivery_cost_store || 0)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-blue-600 uppercase font-medium">Total do Entregador</p>
                                    <p className="font-medium text-slate-700 mt-1">
                                        {formatCurrency(sale.delivery_total || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-between items-center shrink-0">
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <AlertCircle size={14} />
                        Cancelamentos e estornos revertem os descontos em cupons e logística automaticamente. O estoque deverá ser recolocado manualmente na aba de Produtos.
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Fechar
                        </button>

                        {sale.status === 'completed' && (
                            <>
                                <button
                                    onClick={handleRefund}
                                    disabled={isRefunding || isCancelling}
                                    className="px-4 py-2 bg-orange-100 text-orange-700 font-medium rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isRefunding && <RefreshCw size={16} className="animate-spin" />}
                                    Estornar Venda
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={isRefunding || isCancelling}
                                    className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
                                >
                                    {isCancelling && <RefreshCw size={16} className="animate-spin" />}
                                    Cancelar Venda
                                </button>
                            </>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
