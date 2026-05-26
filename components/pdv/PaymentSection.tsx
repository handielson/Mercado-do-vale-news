import React, { useState } from 'react';
import { CreditCard, DollarSign, Smartphone, Trash2 } from 'lucide-react';
import { PaymentMethod, PaymentMethodType } from '../../types/sale';
import {
    calculateTotalPaid,
    calculateRemaining,
    calculateChange,
    formatCurrency,
    getPaymentMethodLabel,
    getPaymentMethodIcon
} from '../../utils/saleCalculations';
import { toast } from 'sonner';
import InstallmentCalculator from './InstallmentCalculator';

interface PaymentSectionProps {
    total: number; // em centavos
    payments: PaymentMethod[];
    onAddPayment: (payment: PaymentMethod) => void;
    onRemovePayment: (index: number) => void;
    // Props opcionais para calculadora de parcelamento
    paymentFees?: any[];
    onSelectInstallment?: (installments: number, amount: number, feeAmount: number) => void;
    // Props opcionais para desconto promocional
    promotionalDiscount?: number;
    onPromotionalDiscountChange?: (discount: number) => void;
    // Props opcionais para desconto extra final (aplicado por ultimo)
    finalAdjustmentDiscount?: number;
    maxFinalAdjustmentDiscount?: number;
    onFinalAdjustmentDiscountChange?: (discount: number) => void;
    onApplyFinalPaymentAmount?: (amount: number) => void;
}

export default function PaymentSection({
    total,
    payments,
    onAddPayment,
    onRemovePayment,
    paymentFees,
    onSelectInstallment,
    promotionalDiscount,
    onPromotionalDiscountChange,
    finalAdjustmentDiscount,
    maxFinalAdjustmentDiscount,
    onFinalAdjustmentDiscountChange,
    onApplyFinalPaymentAmount
}: PaymentSectionProps) {
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('money');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [discountInput, setDiscountInput] = useState('');
    const [finalAdjustmentInput, setFinalAdjustmentInput] = useState('');

    const totalPaid = calculateTotalPaid(payments);
    const remaining = calculateRemaining(total, payments);
    const change = calculateChange(total, payments);
    const isComplete = totalPaid >= total;
    const creditPayment = [...payments].reverse().find(payment => payment.method === 'credit');
    const creditPaymentTotal = creditPayment ? (creditPayment.total_with_fee ?? creditPayment.amount ?? 0) : 0;
    const creditInstallmentValue = creditPayment?.installments
        ? Math.round(creditPaymentTotal / creditPayment.installments)
        : 0;
    const totalBeforeFinalAdjustment = total + (finalAdjustmentDiscount || 0);

    const applyFinalPaymentAmount = () => {
        if (!onApplyFinalPaymentAmount) return;

        const cleanValue = finalAdjustmentInput.replace(',', '.');
        const parsedValue = parseFloat(cleanValue) * 100;

        if (isNaN(parsedValue) || parsedValue <= 0) {
            toast.error('Digite um valor final valido');
            return;
        }

        onApplyFinalPaymentAmount(Math.round(parsedValue));
    };

    // Calcular preview de 12x para o Total a Pagar
    let twelveInstallmentTotal = 0;
    let twelveInstallmentValue = 0;
    if (paymentFees && paymentFees.length > 0) {
        const creditFees = paymentFees
            .filter(f => f.payment_method === 'credit' || (f.channel === 'presencial' && f.installments >= 1))
            .filter((fee, idx, arr) => idx === arr.findIndex(f => f.installments === fee.installments));

        const twelveFee = creditFees.find(f => f.installments === 12);
        if (twelveFee) {
             const feeAmount = Math.round(total * (twelveFee.applied_fee / 100));
             twelveInstallmentTotal = total + feeAmount;
             twelveInstallmentValue = Math.round(twelveInstallmentTotal / 12);
        }
    }

    // Adicionar pagamento
    const handleAddPayment = (method: PaymentMethodType) => {
        const amount = parseFloat(paymentAmount.replace(',', '.')) * 100; // converter para centavos

        if (!amount || amount <= 0) {
            toast.error('Digite um valor válido');
            return;
        }

        // Permite que qualquer forma de pagamento exceda o total (útil para "troco no cartão" ou acréscimos intencionais)


        const payment: PaymentMethod = {
            method: method,
            amount: Math.round(amount),
            total_with_fee: Math.round(amount) // Sem taxa por enquanto
        };

        onAddPayment(payment);
        setPaymentAmount('');
        toast.success(`${getPaymentMethodLabel(selectedMethod)} adicionado`);
    };

    // Enter para adicionar - Padrão é dinheiro
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddPayment('money');
        }
    };

    // Preencher com valor restante
    const fillRemaining = () => {
        const remainingValue = (remaining / 100).toFixed(2);
        setPaymentAmount(remainingValue);
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <CreditCard size={20} />
                Pagamento
            </h3>

            {/* Desconto Promocional - logo após o título Pagamento */}
            {!isComplete && onPromotionalDiscountChange && (
                <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                        <span className="text-lg">💰</span>
                        Desconto Promocional
                    </h4>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={discountInput}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/[^\d,.]/g, '');
                                    setDiscountInput(rawValue);
                                }}
                                onBlur={() => {
                                    const cleanValue = discountInput.replace(',', '.');
                                    const value = parseFloat(cleanValue) * 100;
                                    onPromotionalDiscountChange(isNaN(value) || value < 0 ? 0 : Math.round(value));
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const cleanValue = discountInput.replace(',', '.');
                                        const value = parseFloat(cleanValue) * 100;
                                        onPromotionalDiscountChange(isNaN(value) || value < 0 ? 0 : Math.round(value));
                                        e.currentTarget.blur(); // Remove o foco do input
                                    }
                                }}
                                placeholder="0,00"
                                className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={() => {
                                setDiscountInput('');
                                onPromotionalDiscountChange(0);
                            }}
                            className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
                        >
                            Limpar
                        </button>
                    </div>
                    {promotionalDiscount > 0 && (
                        <p className="text-xs text-amber-700 mt-2">
                            Desconto aplicado: {formatCurrency(promotionalDiscount)}
                        </p>
                    )}
                </div>
            )}

            {/* Total a Pagar */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <p className="text-sm text-slate-600 mb-1">Total a Pagar à vista:</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(total)}</p>
                {twelveInstallmentTotal > 0 && (
                    <p className="text-sm font-medium text-slate-600 mt-1">
                        ou no cartão em até 12x de <span className="font-bold text-blue-700">{formatCurrency(twelveInstallmentValue)}</span> ({formatCurrency(twelveInstallmentTotal)})
                    </p>
                )}
            </div>

            {/* Desconto de Ajuste Final - aplicado por ultimo */}
            {false && onFinalAdjustmentDiscountChange && (
                <div className="mb-4 p-4 bg-rose-50 border-2 border-rose-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-rose-800 mb-2 flex items-center gap-2">
                        <span className="text-lg">🧾</span>
                        Desconto de Ajuste Final
                    </h4>
                    <p className="text-xs text-rose-700 mb-3">
                        Aplicado por ultimo, apos todos os calculos (frete, juros e descontos anteriores).
                    </p>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={finalAdjustmentInput}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/[^\d,.]/g, '');
                                    setFinalAdjustmentInput(rawValue);
                                }}
                                onBlur={() => {
                                    const cleanValue = finalAdjustmentInput.replace(',', '.');
                                    const parsedValue = parseFloat(cleanValue) * 100;
                                    const safeValue = isNaN(parsedValue) || parsedValue < 0 ? 0 : Math.round(parsedValue);
                                    const maxValue = Math.max(0, maxFinalAdjustmentDiscount ?? Number.MAX_SAFE_INTEGER);
                                    onFinalAdjustmentDiscountChange(Math.min(safeValue, maxValue));
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const cleanValue = finalAdjustmentInput.replace(',', '.');
                                        const parsedValue = parseFloat(cleanValue) * 100;
                                        const safeValue = isNaN(parsedValue) || parsedValue < 0 ? 0 : Math.round(parsedValue);
                                        const maxValue = Math.max(0, maxFinalAdjustmentDiscount ?? Number.MAX_SAFE_INTEGER);
                                        onFinalAdjustmentDiscountChange(Math.min(safeValue, maxValue));
                                        e.currentTarget.blur();
                                    }
                                }}
                                placeholder="0,00"
                                className="w-full px-4 py-2 border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={() => {
                                setFinalAdjustmentInput('');
                                onFinalAdjustmentDiscountChange(0);
                            }}
                            className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors text-sm font-medium"
                        >
                            Limpar
                        </button>
                    </div>
                    {maxFinalAdjustmentDiscount !== undefined && (
                        <p className="text-xs text-rose-700 mt-2">
                            Maximo permitido: {formatCurrency(Math.max(0, maxFinalAdjustmentDiscount))}
                        </p>
                    )}
                    {(finalAdjustmentDiscount || 0) > 0 && (
                        <p className="text-xs text-rose-700 mt-1">
                            Ajuste final aplicado: {formatCurrency(finalAdjustmentDiscount || 0)}
                        </p>
                    )}
                </div>
            )}

            {/* Pagamentos Adicionados */}
            {payments.length > 0 && (
                <div className="mb-4 space-y-2">
                    <h4 className="text-sm font-medium text-slate-700">Formas de Pagamento:</h4>
                    {payments.map((payment, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{getPaymentMethodIcon(payment.method)}</span>
                                <div>
                                    <p className="font-medium text-slate-800">
                                        {getPaymentMethodLabel(payment.method, payment.installments)}
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        {formatCurrency(payment.total_with_fee ?? payment.amount)}
                                        {payment.method === 'credit' && payment.installments && payment.installments > 1 && (
                                            <span className="ml-1">
                                                ({payment.installments}x de {formatCurrency(Math.round((payment.total_with_fee ?? payment.amount) / payment.installments))})
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => onRemovePayment(index)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Remover pagamento"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Ajuste final depois da escolha do cartao */}
            {creditPayment && onApplyFinalPaymentAmount && (
                <div className="mb-4 p-4 bg-rose-50 border-2 border-rose-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-rose-800 mb-2">
                        Valor final cobrado
                    </h4>
                    <p className="text-xs text-rose-700 mb-3">
                        Use depois de escolher o parcelamento. O sistema mantem a quantidade de parcelas e recalcula o valor de cada parcela.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                        <input
                            type="text"
                            value={finalAdjustmentInput}
                            onChange={(e) => setFinalAdjustmentInput(e.target.value.replace(/[^\d,.]/g, ''))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    applyFinalPaymentAmount();
                                    e.currentTarget.blur();
                                }
                            }}
                            placeholder={(creditPaymentTotal / 100).toFixed(2).replace('.', ',')}
                            className="w-full px-4 py-2 border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        />
                        <button
                            onClick={applyFinalPaymentAmount}
                            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-medium"
                        >
                            Aplicar ajuste
                        </button>
                        <button
                            onClick={() => {
                                setFinalAdjustmentInput('');
                                onFinalAdjustmentDiscountChange?.(0);
                                onApplyFinalPaymentAmount(totalBeforeFinalAdjustment);
                            }}
                            className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors text-sm font-medium"
                        >
                            Limpar
                        </button>
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg bg-white/70 border border-rose-100 p-2">
                            <span className="block text-rose-700">Total original</span>
                            <strong className="text-slate-800">{formatCurrency(totalBeforeFinalAdjustment)}</strong>
                        </div>
                        <div className="rounded-lg bg-white/70 border border-rose-100 p-2">
                            <span className="block text-rose-700">Ajuste aplicado</span>
                            <strong className="text-red-600">-{formatCurrency(finalAdjustmentDiscount || 0)}</strong>
                        </div>
                        <div className="rounded-lg bg-white/70 border border-rose-100 p-2">
                            <span className="block text-rose-700">Parcelas atuais</span>
                            <strong className="text-slate-800">
                                {creditPayment.installments && creditPayment.installments > 1
                                    ? `${creditPayment.installments}x de ${formatCurrency(creditInstallmentValue)}`
                                    : formatCurrency(creditPaymentTotal)}
                            </strong>
                        </div>
                    </div>
                    {maxFinalAdjustmentDiscount !== undefined && (
                        <p className="text-xs text-rose-700 mt-2">
                            Valor minimo permitido: {formatCurrency(Math.max(0, totalBeforeFinalAdjustment - maxFinalAdjustmentDiscount))}
                        </p>
                    )}
                </div>
            )}

            {/* Status do Pagamento */}
            <div className="mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total Pago:</span>
                    <span className={`font-bold ${isComplete ? 'text-green-600' : 'text-slate-800'}`}>
                        {formatCurrency(totalPaid)}
                        {isComplete && ' ✅'}
                    </span>
                </div>
                {remaining > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Falta:</span>
                        <span className="font-bold text-red-600">{formatCurrency(remaining)}</span>
                    </div>
                )}
                {change > 0 && (
                    <div className="flex justify-between text-sm p-2 bg-green-50 border border-green-200 rounded">
                        <span className="text-green-700 font-medium">Troco:</span>
                        <span className="font-bold text-green-700">{formatCurrency(change)}</span>
                    </div>
                )}
            </div>

            {/* Adicionar Novo Pagamento */}
            {!isComplete && (
                <div className="space-y-3 mb-4">
                    <h4 className="text-sm font-medium text-slate-700">Informe o valor e a forma de pagamento:</h4>

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="0,00"
                                className="w-full px-4 py-3 text-lg border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-bold"
                            />
                        </div>
                        <button
                            onClick={fillRemaining}
                            className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Restante
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => handleAddPayment('pix')}
                            className="flex flex-col items-center justify-center p-3 border-2 border-cyan-200 bg-cyan-50 rounded-lg hover:bg-cyan-100 hover:border-cyan-300 transition-colors"
                        >
                            <Smartphone size={20} className="mb-1 text-cyan-700" />
                            <span className="text-xs font-semibold text-cyan-800">Add PIX</span>
                        </button>
                        <button
                            onClick={() => handleAddPayment('money')}
                            className="flex flex-col items-center justify-center p-3 border-2 border-green-200 bg-green-50 rounded-lg hover:bg-green-100 hover:border-green-300 transition-colors"
                        >
                            <DollarSign size={20} className="mb-1 text-green-700" />
                            <span className="text-xs font-semibold text-green-800">Add Dinheiro</span>
                        </button>
                        <button
                            onClick={() => handleAddPayment('debit')}
                            className="flex flex-col items-center justify-center p-3 border-2 border-purple-200 bg-purple-50 rounded-lg hover:bg-purple-100 hover:border-purple-300 transition-colors"
                        >
                            <CreditCard size={20} className="mb-1 text-purple-700" />
                            <span className="text-xs font-semibold text-purple-800">Add Débito</span>
                        </button>
                    </div>

                    {/* Tabela de Parcelamento (Cartão de Crédito) baseada no Saldo Restante */}
                    {remaining > 0 && paymentFees && onSelectInstallment && (
                        <div className="mt-6 border-t border-slate-200 pt-4">
                            <InstallmentCalculator
                                remainingBalance={remaining}
                                paymentFees={paymentFees}
                                onSelectInstallment={onSelectInstallment}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
