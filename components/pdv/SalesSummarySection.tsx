import React from 'react';
import { CheckCircle, TrendingUp, Users, DollarSign } from 'lucide-react';
import { SaleItem, PaymentMethod } from '../../types/sale';
import {
    calculateSaleTotals,
    calculateProfitMargin,
    isPaymentComplete,
    formatCurrency,
    getPaymentMethodLabel,
    getPaymentMethodIcon
} from '../../utils/saleCalculations';

import { DeliveryType } from '../../types/sale';

interface Customer {
    id: string;
    name: string;
}

interface SalesSummarySectionProps {
    items: SaleItem[];
    customer?: Customer;
    payments: PaymentMethod[];
    deliveryType?: DeliveryType;
    deliveryCostStore?: number; // em centavos
    deliveryCostCustomer?: number; // em centavos
    onFinalizeSale: () => Promise<void>;
}

export default function SalesSummarySection({
    items,
    customer,
    payments,
    deliveryType,
    deliveryCostStore = 0,
    deliveryCostCustomer = 0,
    onFinalizeSale
}: SalesSummarySectionProps) {
    const { subtotal, discount_total, total, cost_total, profit } = calculateSaleTotals(items);
    const profitMargin = calculateProfitMargin(profit, total);
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const paymentComplete = isPaymentComplete(total, payments);

    const canFinalize = items.length > 0 && customer && paymentComplete;

    const [isProcessing, setIsProcessing] = React.useState(false);

    const handleFinalize = async () => {
        if (!canFinalize) return;

        setIsProcessing(true);
        try {
            await onFinalizeSale();
        } catch (error) {
            console.error('Erro ao finalizar venda:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp size={20} />
                Resumo da Venda
            </h3>

            {/* Informações Básicas */}
            <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                    <Users size={16} className="text-slate-500" />
                    <span className="text-slate-600">Itens:</span>
                    <span className="font-medium">{items.length} {items.length === 1 ? 'produto' : 'produtos'}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                    <Users size={16} className="text-slate-500" />
                    <span className="text-slate-600">Cliente:</span>
                    <span className="font-medium">
                        {customer ? customer.name : (
                            <span className="text-red-600">Não selecionado ⚠️</span>
                        )}
                    </span>
                </div>
            </div>

            {/* Valores */}
            <div className="border-t border-slate-200 pt-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>

                {discount_total > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Desconto:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(discount_total)}</span>
                    </div>
                )}

                {/* Custo integral da entrega (quando há entrega) */}
                {(deliveryCostStore > 0 || deliveryCostCustomer > 0) && (
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Entrega:</span>
                        <span className="font-medium">+{formatCurrency(deliveryCostStore + deliveryCostCustomer)}</span>
                    </div>
                )}

                {/* Desconto da entrega (loja paga) */}
                {deliveryCostStore > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Desconto Entrega (Loja):</span>
                        <span className="font-medium text-red-600">-{formatCurrency(deliveryCostStore)}</span>
                    </div>
                )}

                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                    <span className="text-slate-800">Total:</span>
                    <span className="text-blue-700">{formatCurrency(total + deliveryCostCustomer)}</span>
                </div>
            </div>

            {/* Detalhamento de Pagamentos */}
            {payments.length > 0 && (
                <div className="border-t border-slate-200 pt-4 mb-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Pagamentos Recebidos:</h4>
                    <div className="space-y-2">
                        {payments.map((payment, index) => (
                            <div key={index} className="flex justify-between text-sm">
                                <span className="text-slate-600 flex items-center gap-1">
                                    <span className="text-base">{getPaymentMethodIcon(payment.method)}</span>
                                    {getPaymentMethodLabel(payment.method)}:
                                </span>
                                <span className="font-medium text-slate-800">
                                    {formatCurrency(payment.amount)}
                                </span>
                            </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-2">
                            <span className="text-slate-700">Total Pago:</span>
                            <span className="text-green-600">{formatCurrency(totalPaid)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Lucro */}
            <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg mb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-xs text-green-700 mb-1">Custo Total</p>
                        <p className="text-sm font-medium text-green-800">{formatCurrency(cost_total)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-green-700 mb-1">Lucro Estimado</p>
                        <p className="text-lg font-bold text-green-700">
                            {formatCurrency(profit)}
                            <span className="text-sm ml-2">({profitMargin.toFixed(1)}%)</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Status do Pagamento */}
            <div className="mb-4">
                <div className="flex items-center gap-2 text-sm">
                    <DollarSign size={16} className="text-slate-500" />
                    <span className="text-slate-600">Pagamento:</span>
                    {paymentComplete ? (
                        <span className="font-medium text-green-600 flex items-center gap-1">
                            <CheckCircle size={16} />
                            Completo
                        </span>
                    ) : (
                        <span className="font-medium text-red-600">Pendente ⚠️</span>
                    )}
                </div>
            </div>

            {/* Validações */}
            {!canFinalize && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 mb-2">Pendências:</p>
                    <ul className="text-xs text-yellow-700 space-y-1">
                        {items.length === 0 && <li>• Adicione produtos ao carrinho</li>}
                        {!customer && <li>• Selecione um cliente</li>}
                        {!paymentComplete && <li>• Complete o pagamento</li>}
                    </ul>
                </div>
            )}

            {/* Botão Finalizar */}
            <button
                onClick={handleFinalize}
                disabled={!canFinalize || isProcessing}
                className={`w-full py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 ${canFinalize && !isProcessing
                    ? 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
                    : 'bg-slate-300 cursor-not-allowed'
                    }`}
            >
                {isProcessing ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processando...
                    </>
                ) : (
                    <>
                        <CheckCircle size={20} />
                        Finalizar Venda
                    </>
                )}
            </button>
        </div>
    );
}
