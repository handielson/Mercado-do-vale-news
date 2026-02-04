import React from 'react';
import { Receipt, User, Package, Truck, CreditCard, DollarSign, Smartphone } from 'lucide-react';
import { SaleItem, PaymentMethod, DeliveryType } from '../../types/sale';
import { calculateSaleTotals } from '../../utils/saleCalculations';


interface Customer {
    id: string;
    name: string;
    cpf_cnpj?: string;
    email?: string;
    phone?: string;
}

interface ReceiptPreviewProps {
    customer: Customer | undefined;
    items: SaleItem[];
    deliveryType: DeliveryType | undefined;
    deliveryCostStore: number;
    deliveryCostCustomer: number;
    payments: PaymentMethod[];
    promotionalDiscount?: number;
    onFinalizeSale: () => void;
}

export default function ReceiptPreview({
    customer,
    items,
    deliveryType,
    deliveryCostStore,
    deliveryCostCustomer,
    payments,
    promotionalDiscount,
    onFinalizeSale
}: ReceiptPreviewProps) {
    const { subtotal, discount_total, total: itemsTotal } = calculateSaleTotals(items);

    // Calcular desconto de brindes (valor integral dos produtos marcados como brinde)
    const giftDiscount = items.reduce((sum, item) => {
        if (item.is_gift) {
            return sum + (item.unit_price * item.quantity);
        }
        return sum;
    }, 0);

    console.log('Gift items:', items.filter(i => i.is_gift));
    console.log('Gift discount:', giftDiscount);

    // Calcular total de juros/taxas dos pagamentos
    const totalFees = payments.reduce((sum, p) => {
        const fee = (p.fee_amount || 0);
        return sum + fee;
    }, 0);

    // Total = Subtotal - Brindes - Promoção + Entrega + Juros
    const total = itemsTotal - giftDiscount - (promotionalDiscount || 0) + deliveryCostCustomer + totalFees;

    // Total pago (já inclui os juros no amount de cada pagamento)
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    // Troco ou falta
    const change = totalPaid - total;
    const isComplete = customer && items.length > 0 && totalPaid >= total;

    // Função para mascarar CPF (mostra apenas os últimos 3 dígitos)
    const maskCPF = (cpf: string) => {
        // Remove formatação
        const numbers = cpf.replace(/\D/g, '');
        if (numbers.length === 11) {
            // CPF: xxx.xxx.xxx-XX
            return `xxx.xxx.xx${numbers.slice(-3, -2)}-${numbers.slice(-2)}`;
        } else if (numbers.length === 14) {
            // CNPJ: xx.xxx.xxx/xxxx-XX
            return `xx.xxx.xxx/xxxx-${numbers.slice(-2)}`;
        }
        return cpf; // Retorna original se não for CPF/CNPJ válido
    };

    const formatCurrency = (value: number) => {
        return `R$ ${(value / 100).toFixed(2).replace('.', ',')}`;
    };

    const getDeliveryTypeLabel = () => {
        if (!deliveryType) return '-';
        switch (deliveryType) {
            case 'pickup':
            case 'store_pickup': return 'Retirada na Loja';
            case 'delivery':
            case 'store_delivery': return 'Entrega pela Loja';
            case 'hybrid':
            case 'hybrid_delivery': return 'Entrega Híbrida';
            default: return '-';
        }
    };

    const getPaymentMethodLabel = (method: string) => {
        switch (method) {
            case 'pix': return 'PIX';
            case 'money': return 'Dinheiro';
            case 'credit': return 'Crédito';
            case 'debit': return 'Débito';
            default: return method;
        }
    };

    const getPaymentIcon = (method: string) => {
        switch (method) {
            case 'pix': return <Smartphone size={14} className="text-cyan-600" />;
            case 'money': return <DollarSign size={14} className="text-green-600" />;
            case 'credit': return <CreditCard size={14} className="text-blue-600" />;
            case 'debit': return <CreditCard size={14} className="text-purple-600" />;
            default: return <CreditCard size={14} />;
        }
    };

    return (
        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-lg sticky top-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl">
                <div className="flex items-center gap-3 mb-2">
                    <Receipt size={28} />
                    <div>
                        <h2 className="text-xl font-bold">MERCADO DO VALE</h2>
                        <p className="text-sm text-blue-100">Comprovante de Venda</p>
                    </div>
                </div>
                <div className="text-xs text-blue-100 mt-2">
                    {new Date().toLocaleString('pt-BR')}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                {/* Cliente */}
                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <User size={16} className="text-slate-600" />
                        <h3 className="font-semibold text-slate-800">Cliente</h3>
                    </div>
                    {customer ? (
                        <div className="text-sm text-slate-600 space-y-1 ml-6">
                            <p className="font-medium text-slate-800">{customer.name}</p>
                            {customer.cpf_cnpj && <p>CPF/CNPJ: {maskCPF(customer.cpf_cnpj)}</p>}
                            {customer.phone && <p>Tel: {customer.phone}</p>}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 ml-6">Nenhum cliente selecionado</p>
                    )}
                </div>

                {/* Produtos - A */}
                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Package size={16} className="text-slate-600" />
                        <h3 className="font-semibold text-slate-800">Produtos</h3>
                    </div>
                    {items.length > 0 ? (
                        <div className="space-y-2">
                            {items.map((item, index) => (
                                <div key={index} className="flex justify-between text-sm">
                                    <div className="flex-1">
                                        <span className="text-slate-600">{item.quantity}x </span>
                                        <span className="text-slate-800">{item.product_name}</span>
                                        {item.is_gift && (
                                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                BRINDE
                                            </span>
                                        )}
                                        {item.quantity > 1 && (
                                            <span className="text-xs text-slate-500 ml-2">
                                                (Uni {formatCurrency(item.unit_price)})
                                            </span>
                                        )}
                                    </div>
                                    <span className="font-mono text-slate-800 ml-2">
                                        {/* Mostrar preço integral, mesmo para brindes */}
                                        {formatCurrency(item.unit_price * item.quantity)}
                                    </span>
                                </div>
                            ))}
                            <div className="pt-2 mt-2 border-t border-slate-300 text-sm text-right">
                                <span className="text-xs text-slate-500">Subtotal (A): </span>
                                <span className="font-mono font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 ml-6">Nenhum produto adicionado</p>
                    )}
                </div>

                {/* Entrega - B */}
                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Truck size={16} className="text-slate-600" />
                        <h3 className="font-semibold text-slate-800">Entrega</h3>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1 ml-6">
                        <p>Tipo: <span className="text-slate-800">{getDeliveryTypeLabel()}</span></p>
                        {(deliveryType === 'hybrid' || deliveryType === 'hybrid_delivery') && (
                            <>
                                <p>Loja: <span className="text-slate-800 font-medium">{formatCurrency(deliveryCostStore)}</span></p>
                                <p>Cliente: <span className="text-slate-800 font-medium">{formatCurrency(deliveryCostCustomer)}</span></p>
                            </>
                        )}
                        {deliveryType && deliveryType !== 'pickup' && deliveryType !== 'store_pickup' && (deliveryCostCustomer > 0 || deliveryCostStore > 0) && (
                            <div className="pt-2 mt-2 border-t border-slate-300 text-sm text-right">
                                <span className="text-xs text-slate-500">Subtotal (B): </span>
                                <span className="font-mono font-semibold text-slate-800">{formatCurrency(deliveryCostCustomer + deliveryCostStore)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Descontos - C */}
                {(giftDiscount > 0 || (promotionalDiscount && promotionalDiscount > 0) || deliveryCostStore > 0) && (
                    <div className="border-b border-slate-200 pb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <DollarSign size={16} className="text-slate-600" />
                            <h3 className="font-semibold text-slate-800">Descontos</h3>
                        </div>
                        <div className="text-sm text-slate-600 space-y-1 ml-6">
                            {promotionalDiscount && promotionalDiscount > 0 ? (
                                <div className="flex justify-between">
                                    <span>Desconto Promocional:</span>
                                    <span className="font-mono text-red-600">-{formatCurrency(promotionalDiscount)}</span>
                                </div>
                            ) : null}
                            {giftDiscount > 0 && (
                                <div className="flex justify-between">
                                    <span>Desconto Brinde:</span>
                                    <span className="font-mono text-red-600">-{formatCurrency(giftDiscount)}</span>
                                </div>
                            )}
                            {deliveryCostStore > 0 && (
                                <div className="flex justify-between">
                                    <span>Subsídio Frete (Loja):</span>
                                    <span className="font-mono text-red-600">-{formatCurrency(deliveryCostStore)}</span>
                                </div>
                            )}
                            <div className="pt-2 mt-2 border-t border-slate-300 text-sm text-right">
                                <span className="text-xs text-slate-500">Subtotal (C): </span>
                                <span className="font-mono font-semibold text-red-600">-{formatCurrency((promotionalDiscount || 0) + giftDiscount + deliveryCostStore)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pagamentos */}
                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <CreditCard size={16} className="text-slate-600" />
                        <h3 className="font-semibold text-slate-800">Pagamentos</h3>
                    </div>
                    {payments.length > 0 ? (
                        <div className="space-y-2">
                            {payments.map((payment, index) => (
                                <div key={index} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        {getPaymentIcon(payment.method)}
                                        <span className="text-slate-600">
                                            {getPaymentMethodLabel(payment.method)}
                                            {payment.installments && payment.installments > 1 && (
                                                <span className="ml-1">({payment.installments}x)</span>
                                            )}
                                        </span>
                                    </div>
                                    <span className="font-mono text-slate-800">
                                        {formatCurrency(payment.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 ml-6">Nenhum pagamento adicionado</p>
                    )}
                </div>


                {/* TOTAL A PAGAR */}
                <div className="border-t-2 border-slate-300 pt-4 mt-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>(Subtotal A + Subtotal B) - (Subtotal C)</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg">
                            <span className="text-slate-800">TOTAL A PAGAR:</span>
                            <span className="font-mono text-blue-600">
                                {formatCurrency((itemsTotal + deliveryCostCustomer + deliveryCostStore) - (giftDiscount + (promotionalDiscount || 0) + deliveryCostStore))}
                            </span>
                        </div>
                    </div>

                    {/* JUROS (se houver) */}
                    {totalFees > 0 && (
                        <div className="space-y-2 text-sm pt-2 border-t border-slate-200">
                            <div className="flex justify-between text-orange-600">
                                <span>Acréscimos:</span>
                                <span className="font-mono">+{formatCurrency(totalFees)}</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                                <span className="text-slate-800">TOTAL COM JUROS:</span>
                                <span className="font-mono text-blue-600">{formatCurrency(total)}</span>
                            </div>
                        </div>
                    )}

                    {/* PAGAMENTOS */}
                    {payments.length > 0 && (
                        <div className="space-y-2 text-sm pt-3 border-t-2 border-slate-300">
                            <div className="flex justify-between text-green-600 font-medium">
                                <span>Pago:</span>
                                <span className="font-mono">{formatCurrency(totalPaid)}</span>
                            </div>
                            {change > 0 && (
                                <div className="flex justify-between text-amber-600 font-medium">
                                    <span>Troco:</span>
                                    <span className="font-mono">{formatCurrency(change)}</span>
                                </div>
                            )}
                            {change < 0 && (
                                <div className="flex justify-between text-red-600 font-medium">
                                    <span>Falta:</span>
                                    <span className="font-mono">{formatCurrency(Math.abs(change))}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >

            {/* Footer com botão */}
            < div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-xl" >
                <button
                    onClick={onFinalizeSale}
                    disabled={!isComplete}
                    className={`w-full py-3 rounded-lg font-semibold transition-all ${isComplete
                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    {isComplete ? 'Finalizar Venda' : 'Complete os dados para finalizar'}
                </button>
            </div >
        </div >
    );
}
