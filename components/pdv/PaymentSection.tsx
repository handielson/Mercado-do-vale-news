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

interface PaymentSectionProps {
    total: number; // em centavos
    payments: PaymentMethod[];
    onAddPayment: (payment: PaymentMethod) => void;
    onRemovePayment: (index: number) => void;
}

export default function PaymentSection({
    total,
    payments,
    onAddPayment,
    onRemovePayment
}: PaymentSectionProps) {
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('money');
    const [paymentAmount, setPaymentAmount] = useState('');

    const totalPaid = calculateTotalPaid(payments);
    const remaining = calculateRemaining(total, payments);
    const change = calculateChange(total, payments);
    const isComplete = totalPaid >= total;

    // Adicionar pagamento
    const handleAddPayment = () => {
        const amount = parseFloat(paymentAmount.replace(',', '.')) * 100; // converter para centavos

        if (!amount || amount <= 0) {
            toast.error('Digite um valor válido');
            return;
        }

        if (totalPaid + amount > total && selectedMethod !== 'money') {
            toast.error('Valor excede o total (apenas dinheiro pode ter troco)');
            return;
        }

        const payment: PaymentMethod = {
            method: selectedMethod,
            amount: Math.round(amount)
        };

        onAddPayment(payment);
        setPaymentAmount('');
        toast.success(`${getPaymentMethodLabel(selectedMethod)} adicionado`);
    };

    // Enter para adicionar
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddPayment();
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

            {/* Total a Pagar */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <p className="text-sm text-slate-600 mb-1">Total a Pagar:</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(total)}</p>
            </div>

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
                                        {getPaymentMethodLabel(payment.method)}
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        {formatCurrency(payment.amount)}
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
                <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">Adicionar Pagamento:</h4>

                    {/* Método de Pagamento */}
                    <div className="grid grid-cols-4 gap-2">
                        <button
                            onClick={() => setSelectedMethod('money')}
                            className={`p-3 border-2 rounded-lg transition-all ${selectedMethod === 'money'
                                    ? 'border-green-600 bg-green-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <DollarSign size={24} className="mx-auto mb-1" />
                            <p className="text-xs font-medium">Dinheiro</p>
                        </button>
                        <button
                            onClick={() => setSelectedMethod('credit')}
                            className={`p-3 border-2 rounded-lg transition-all ${selectedMethod === 'credit'
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <CreditCard size={24} className="mx-auto mb-1" />
                            <p className="text-xs font-medium">Crédito</p>
                        </button>
                        <button
                            onClick={() => setSelectedMethod('debit')}
                            className={`p-3 border-2 rounded-lg transition-all ${selectedMethod === 'debit'
                                    ? 'border-purple-600 bg-purple-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <CreditCard size={24} className="mx-auto mb-1" />
                            <p className="text-xs font-medium">Débito</p>
                        </button>
                        <button
                            onClick={() => setSelectedMethod('pix')}
                            className={`p-3 border-2 rounded-lg transition-all ${selectedMethod === 'pix'
                                    ? 'border-cyan-600 bg-cyan-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <Smartphone size={24} className="mx-auto mb-1" />
                            <p className="text-xs font-medium">PIX</p>
                        </button>
                    </div>

                    {/* Valor */}
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="0,00"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={fillRemaining}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
                        >
                            Restante
                        </button>
                        <button
                            onClick={handleAddPayment}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            Adicionar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
