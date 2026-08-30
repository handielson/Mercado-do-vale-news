import React, { useState } from 'react';
import { CreditCard, DollarSign, Share2, Smartphone, Trash2, Calendar, X, RefreshCw } from 'lucide-react';
import { PaymentMethod, PaymentMethodType, PaymentInstallmentScheduleItem } from '../../types/sale';
import type { PdvDisplay, PdvPixPayment } from '../../types/pdvDisplay';
import {
    calculateTotalPaid,
    calculateRemaining,
    calculateChange,
    formatCurrency,
    getPaymentMethodLabel,
    getPaymentMethodIcon
} from '../../utils/saleCalculations';
import {
    generatePaymentInstallmentSchedule,
    validatePaymentInstallmentSchedule
} from '../../utils/installmentCalculations';
import { toast } from 'sonner';
import InstallmentCalculator from './InstallmentCalculator';
import { getBestCreditFeeByInstallment } from '../../utils/paymentFeeCalculations';

interface PaymentSectionProps {
    total: number; // em centavos
    payments: PaymentMethod[];
    onAddPayment: (payment: PaymentMethod) => void;
    onRemovePayment: (index: number) => void;
    // Props opcionais para calculadora de parcelamento
    paymentFees?: any[];
    onSelectInstallment?: (
        installments: number,
        amount: number,
        feeAmount: number,
        operatorFeeAmount: number,
        operatorFeePercentage: number,
        appliedFeePercentage: number
    ) => void;
    // Props opcionais para desconto promocional
    promotionalDiscount?: number;
    onPromotionalDiscountChange?: (discount: number) => void;
    // Props opcionais para desconto extra final (aplicado por ultimo)
    finalAdjustmentDiscount?: number;
    maxFinalAdjustmentDiscount?: number;
    onFinalAdjustmentDiscountChange?: (discount: number) => void;
    onApplyFinalPaymentAmount?: (amount: number) => void;
    selectedCustomer?: any;
    onUpdatePayment?: (index: number, updated: PaymentMethod) => void;
    pdvPixPayment?: PdvPixPayment | null;
    pdvPixLoading?: boolean;
    pdvPixDisplayId?: string;
    pdvPixDisplays?: PdvDisplay[];
    pdvPixCashierKey?: string;
    onPdvPixDisplayIdChange?: (displayId: string) => void;
    onPdvPixCashierKeyChange?: (cashierKey: string) => void;
    onCreatePdvPixPayment?: (amount: number) => void;
    onRefreshPdvPixPayment?: () => void;
    onShowPdvPixOnDisplay?: () => void;
    onPrintPdvPixQr?: () => void;
    onCancelPdvPixPayment?: () => void;
    onSharePdvPixReceipt?: () => void;
    onClearPdvTotemVisual?: () => void;
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
    onApplyFinalPaymentAmount,
    selectedCustomer,
    onUpdatePayment,
    pdvPixPayment,
    pdvPixLoading = false,
    pdvPixDisplayId = '',
    pdvPixDisplays = [],
    pdvPixCashierKey = '',
    onPdvPixDisplayIdChange,
    onPdvPixCashierKeyChange,
    onCreatePdvPixPayment,
    onRefreshPdvPixPayment,
    onShowPdvPixOnDisplay,
    onPrintPdvPixQr,
    onCancelPdvPixPayment,
    onSharePdvPixReceipt,
    onClearPdvTotemVisual
}: PaymentSectionProps) {
    const getDueDateDefault = () => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
    };
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

    // Estado e configuracao de Venda a Prazo (Crediario)
    const [isAPrazoModalOpen, setIsAPrazoModalOpen] = useState(false);
    const [aPrazoAmount, setAPrazoAmount] = useState(0);
    const [aPrazoInstallmentCount, setAPrazoInstallmentCount] = useState(1);
    const [aPrazoFirstDueDate, setAPrazoFirstDueDate] = useState('');
    const [aPrazoSchedule, setAPrazoSchedule] = useState<PaymentInstallmentScheduleItem[]>([]);

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

    const getTypedPaymentAmount = () => {
        const amount = parseFloat(paymentAmount.replace(',', '.')) * 100;
        return Number.isFinite(amount) ? Math.round(amount) : 0;
    };

    const handleCreatePixPayment = () => {
        const amount = getTypedPaymentAmount();
        if (!amount || amount <= 0) {
            toast.error('Digite um valor valido para gerar o Pix');
            return;
        }
        onCreatePdvPixPayment?.(amount);
    };

    const getPdvPixStatusLabel = (status?: string) => {
        if (status === 'creating') return 'Criando cobranca';
        if (status === 'pending') return 'Aguardando pagamento';
        if (status === 'approved') return 'Pagamento aprovado';
        if (status === 'rejected') return 'Pagamento rejeitado';
        if (status === 'expired') return 'Pagamento expirado';
        if (status === 'error') return 'Erro no Pix';
        return 'Pix Mercado Pago';
    };

    // Calcular preview de 12x para o Total a Pagar
    let twelveInstallmentTotal = 0;
    let twelveInstallmentValue = 0;
    if (paymentFees && paymentFees.length > 0) {
        const twelveFee = getBestCreditFeeByInstallment(paymentFees, 12);
        if (twelveFee) {
             const feeAmount = Math.round(total * (twelveFee.applied_fee / 100));
             twelveInstallmentTotal = total + feeAmount;
             twelveInstallmentValue = Math.round(twelveInstallmentTotal / 12);
        }
    }

    const openAPrazoModal = () => {
        if (!selectedCustomer) {
            toast.error('Selecione um cliente para vender a prazo');
            return;
        }

        if (payments.some(p => p.method === 'a_prazo')) {
            toast.error('Já existe um pagamento a prazo nesta venda. Remova-o antes de adicionar outro.');
            return;
        }

        const typedAmount = getTypedPaymentAmount();
        const targetAmount = typedAmount > 0 ? typedAmount : (remaining > 0 ? remaining : total);
        if (!targetAmount || targetAmount <= 0) {
            toast.error('Digite um valor válido');
            return;
        }

        const firstDueDate = getDueDateDefault();
        const fee = getBestCreditFeeByInstallment(paymentFees || [], 1);
        const feeAmount = Math.round(targetAmount * (Math.max(0, Number(fee?.applied_fee || 0)) / 100));
        setAPrazoAmount(targetAmount);
        setAPrazoInstallmentCount(1);
        setAPrazoFirstDueDate(firstDueDate);
        setAPrazoSchedule(generatePaymentInstallmentSchedule(targetAmount + feeAmount, 1, firstDueDate));
        setIsAPrazoModalOpen(true);
    };

    const handleAPrazoCountChange = (count: number) => {
        const safeCount = Math.max(1, Math.min(12, count));
        const fee = getBestCreditFeeByInstallment(paymentFees || [], safeCount);
        const feePercentage = Math.max(0, Number(fee?.applied_fee || 0));
        const feeAmount = Math.round(aPrazoAmount * (feePercentage / 100));
        setAPrazoInstallmentCount(safeCount);
        setAPrazoSchedule(generatePaymentInstallmentSchedule(aPrazoAmount + feeAmount, safeCount, aPrazoFirstDueDate));
    };

    const handleAPrazoFirstDueDateChange = (date: string) => {
        setAPrazoFirstDueDate(date);
        const fee = getBestCreditFeeByInstallment(paymentFees || [], aPrazoInstallmentCount);
        const feeAmount = Math.round(aPrazoAmount * (Math.max(0, Number(fee?.applied_fee || 0)) / 100));
        setAPrazoSchedule(generatePaymentInstallmentSchedule(aPrazoAmount + feeAmount, aPrazoInstallmentCount, date));
    };

    const handleAPrazoResetSchedule = () => {
        const fee = getBestCreditFeeByInstallment(paymentFees || [], aPrazoInstallmentCount);
        const feeAmount = Math.round(aPrazoAmount * (Math.max(0, Number(fee?.applied_fee || 0)) / 100));
        setAPrazoSchedule(generatePaymentInstallmentSchedule(aPrazoAmount + feeAmount, aPrazoInstallmentCount, aPrazoFirstDueDate));
        toast.success('Cronograma recalculado com sugestão civil');
    };

    const handleAPrazoItemDueDateChange = (index: number, date: string) => {
        const next = [...aPrazoSchedule];
        next[index] = { ...next[index], due_date: date };
        setAPrazoSchedule(next);
    };

    const handleConfirmAPrazo = () => {
        const fee = getBestCreditFeeByInstallment(paymentFees || [], aPrazoInstallmentCount);
        const feePercentage = Math.max(0, Number(fee?.applied_fee || 0));
        const operatorFeePercentage = Math.max(0, Number(fee?.operator_fee || 0));
        const feeAmount = Math.round(aPrazoAmount * (feePercentage / 100));
        const operatorFeeAmount = Math.round(aPrazoAmount * (operatorFeePercentage / 100));
        const totalWithFee = aPrazoAmount + feeAmount;
        const validation = validatePaymentInstallmentSchedule(totalWithFee, aPrazoSchedule);
        if (!validation.valid) {
            toast.error(validation.error || 'Cronograma de parcelamento inválido');
            return;
        }

        const payment: PaymentMethod = {
            method: 'a_prazo',
            amount: aPrazoAmount,
            installments: aPrazoInstallmentCount,
            fee_percentage: feePercentage,
            fee_amount: feeAmount,
            operator_fee_percentage: operatorFeePercentage,
            operator_fee_amount: operatorFeeAmount,
            total_with_fee: totalWithFee,
            due_date: aPrazoSchedule[0]?.due_date || aPrazoFirstDueDate,
            installment_schedule: aPrazoSchedule,
        };

        onAddPayment(payment);
        setPaymentAmount('');
        setIsAPrazoModalOpen(false);
        toast.success(`A Prazo (${aPrazoSchedule.length}x) adicionado`);
    };

    // Adicionar pagamento
    const handleAddPayment = (method: PaymentMethodType) => {
        if (method === 'a_prazo') {
            openAPrazoModal();
            return;
        }

        const amount = parseFloat(paymentAmount.replace(',', '.')) * 100; // converter para centavos

        if (!amount || amount <= 0) {
            toast.error('Digite um valor válido');
            return;
        }

        const payment: PaymentMethod = {
            method: method,
            amount: Math.round(amount),
            total_with_fee: Math.round(amount),
        };

        onAddPayment(payment);
        setPaymentAmount('');
        toast.success(`${getPaymentMethodLabel(method)} adicionado`);
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



            {/* Pagamentos Adicionados */}
            {payments.length > 0 && (
                <div className="mb-4 space-y-2">
                    <h4 className="text-sm font-medium text-slate-700">Formas de Pagamento:</h4>
                    {payments.map((payment, index) => (
                        <div
                            key={index}
                            className="flex flex-col gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{getPaymentMethodIcon(payment.method)}</span>
                                <div>
                                    <p className="font-medium text-slate-800">
                                        {payment.method === 'a_prazo' && payment.installment_schedule && payment.installment_schedule.length > 1
                                            ? `A Prazo (${payment.installment_schedule.length}x)`
                                            : getPaymentMethodLabel(payment.method, payment.installments)}
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        {formatCurrency(payment.total_with_fee ?? payment.amount)}
                                        {payment.method === 'credit' && payment.installments && payment.installments > 1 && (
                                            <span className="ml-1">
                                                ({payment.installments}x de {formatCurrency(Math.round((payment.total_with_fee ?? payment.amount) / payment.installments))})
                                            </span>
                                        )}
                                        {payment.method === 'a_prazo' && payment.installment_schedule && payment.installment_schedule.length > 1 && (
                                            <span className="ml-1 text-xs text-blue-700 font-medium">
                                                ({payment.installment_schedule.length}x de ~{formatCurrency(payment.installment_schedule[0].amount)})
                                            </span>
                                        )}
                                    </p>
                                    {payment.method === 'a_prazo' && payment.installment_schedule && payment.installment_schedule.length > 1 && (
                                        <div className="mt-2 space-y-1 rounded-lg border border-blue-100 bg-white p-2.5 text-xs">
                                            <p className="font-semibold text-blue-900 mb-1">Parcelas do Crediário:</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                {payment.installment_schedule.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                        <span className="text-slate-700">Parcela {item.installment_number}/{item.installment_count} ({item.due_date})</span>
                                                        <span className="font-semibold text-blue-700">{formatCurrency(item.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {payment.method === 'a_prazo' && (!payment.installment_schedule || payment.installment_schedule.length <= 1) && (
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                        <span>Vencimento</span>
                                        <input
                                            type="date"
                                            value={payment.due_date || getDueDateDefault()}
                                            onChange={(event) => onUpdatePayment?.(index, { ...payment, due_date: event.target.value })}
                                            className="h-9 rounded border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                )}
                                <button
                                    onClick={() => onRemovePayment(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Remover pagamento"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
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

            {/* Totais do Pagamento */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total Pago:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Restante:</span>
                    <span className={`font-semibold ${remaining > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {formatCurrency(remaining)}
                    </span>
                </div>
                {change > 0 && (
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                        <span className="text-green-600 font-medium">Troco:</span>
                        <span className="font-bold text-green-600 text-lg">{formatCurrency(change)}</span>
                    </div>
                )}
            </div>

            {/* Totem / Display / Pix Mercado Pago */}
            <div className="mb-4 rounded-lg border border-cyan-100 bg-cyan-50/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                        <h4 className="text-sm font-semibold text-cyan-900">Pix Mercado Pago e Totem</h4>
                        <p className="text-xs text-cyan-700">
                            Gere o Pix dinâmico e envie o QR Code para o display do cliente no PDV.
                        </p>
                    </div>
                    <span className="rounded bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                        Totem visual
                    </span>
                </div>

                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="text-xs text-slate-700">
                        <span className="mb-1 block font-medium">Display do caixa</span>
                        <select
                            value={pdvPixDisplayId}
                            onChange={(e) => onPdvPixDisplayIdChange?.(e.target.value)}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-cyan-500 focus:outline-none"
                        >
                            <option value="">Selecione o display pareado</option>
                            {pdvPixDisplays.map((display) => (
                                <option key={display.id} value={display.id}>
                                    {display.name || display.code} ({display.is_online ? 'Online' : 'Offline'})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="text-xs text-slate-700">
                        <span className="mb-1 block font-medium">Identificador do caixa</span>
                        <select
                            value={pdvPixCashierKey}
                            onChange={(e) => onPdvPixCashierKeyChange?.(e.target.value)}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-cyan-500 focus:outline-none"
                        >
                            <option value="caixa-01">Caixa 01</option>
                            <option value="caixa-02">Caixa 02</option>
                            <option value="caixa-03">Caixa 03</option>
                            <option value="pdv-principal">PDV Principal</option>
                            {pdvPixDisplays.map((display) => (
                                <option key={`opt-${display.id}`} value={display.cashier_key || display.id}>
                                    {display.name || display.code} ({display.cashier_key || 'sem chave'})
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {pdvPixPayment && (
                    <div className="mb-3 rounded border border-cyan-200 bg-white p-3 text-xs text-slate-700">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="text-cyan-900">
                                {getPdvPixStatusLabel(pdvPixPayment.status)}
                            </strong>
                            <span>{formatCurrency(pdvPixPayment.amount)}</span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">ID: {pdvPixPayment.mercado_pago_payment_id || pdvPixPayment.id}</p>
                        {pdvPixPayment.ticket_url && (
                            <a href={pdvPixPayment.ticket_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-cyan-700 underline">
                                Abrir ticket Mercado Pago
                            </a>
                        )}
                        {pdvPixPayment.status !== 'approved' && pdvPixPayment.qr_code_base64 && (
                            <div className="mt-3 flex justify-center rounded border border-slate-200 bg-slate-50 p-3">
                                <img
                                    src={`data:image/png;base64,${pdvPixPayment.qr_code_base64}`}
                                    alt="QR Code Pix"
                                    className="h-44 w-44 object-contain"
                                />
                            </div>
                        )}
                        {pdvPixPayment.status !== 'approved' && pdvPixPayment.qr_code ? (
                            <p className="mt-2 break-all font-mono text-[10px] text-slate-500">
                                {pdvPixPayment.qr_code}
                            </p>
                        ) : null}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleCreatePixPayment}
                        disabled={Boolean(pdvPixPayment) || pdvPixLoading}
                        className="rounded bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-700 disabled:opacity-50"
                    >
                        {pdvPixLoading && !pdvPixPayment ? 'Criando...' : 'Gerar Pix Mercado Pago'}
                    </button>
                    <button
                        onClick={onShowPdvPixOnDisplay}
                        disabled={!pdvPixPayment || !pdvPixDisplayId || pdvPixLoading}
                        className="rounded bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-800 transition-colors hover:bg-cyan-200 disabled:opacity-50"
                    >
                        Exibir no display
                    </button>
                    <button
                        onClick={onRefreshPdvPixPayment}
                        disabled={!pdvPixPayment || pdvPixLoading}
                        className="rounded bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-cyan-200 transition-colors hover:bg-cyan-50 disabled:opacity-50"
                    >
                        Atualizar pagamento
                    </button>
                    <button
                        onClick={onPrintPdvPixQr}
                        disabled={!pdvPixPayment || pdvPixLoading}
                        className="rounded bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-cyan-200 transition-colors hover:bg-cyan-50 disabled:opacity-50"
                    >
                        Imprimir QR
                    </button>
                    <button
                        onClick={onCancelPdvPixPayment}
                        disabled={!pdvPixPayment || pdvPixPayment.status === 'approved' || pdvPixLoading}
                        className="rounded bg-white px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                        Cancelar Pix
                    </button>
                    <button
                        onClick={onSharePdvPixReceipt}
                        disabled={!pdvPixPayment || pdvPixPayment.status !== 'approved' || pdvPixLoading}
                        className="inline-flex items-center justify-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <Share2 size={14} />
                        Compartilhar comprovante
                    </button>
                    <button
                        onClick={onClearPdvTotemVisual}
                        disabled={!pdvPixDisplayId || pdvPixLoading}
                        className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                    >
                        Limpar totem
                    </button>
                </div>
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

                    <div className="grid grid-cols-4 gap-2">
                        <button
                            onClick={() => handleAddPayment('pix')}
                            disabled={Boolean(pdvPixPayment && pdvPixPayment.status !== 'approved')}
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
                        <button
                            type="button"
                            disabled={payments.some(p => p.method === 'a_prazo')}
                            onClick={() => openAPrazoModal()}
                            title={payments.some(p => p.method === 'a_prazo') ? 'Já existe um pagamento a prazo nesta venda' : undefined}
                            className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-colors ${
                                payments.some(p => p.method === 'a_prazo')
                                    ? 'border-slate-200 bg-slate-100 opacity-50 cursor-not-allowed text-slate-400'
                                    : 'border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 text-blue-800'
                            }`}
                        >
                            <Calendar size={20} className={`mb-1 ${payments.some(p => p.method === 'a_prazo') ? 'text-slate-400' : 'text-blue-700'}`} />
                            <span className={`text-xs font-semibold ${payments.some(p => p.method === 'a_prazo') ? 'text-slate-500' : 'text-blue-800'}`}>
                                {payments.some(p => p.method === 'a_prazo') ? 'A Prazo (Já add)' : 'Add A Prazo'}
                            </span>
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

            {/* Modal de Configuracao de Venda a Prazo (Crediario) */}
            {isAPrazoModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2 text-blue-800">
                                <Calendar size={22} />
                                <h3 className="text-lg font-bold text-slate-900">Venda a Prazo (Crediário)</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAPrazoModalOpen(false)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {(() => {
                            const fee = getBestCreditFeeByInstallment(paymentFees || [], aPrazoInstallmentCount);
                            const feePct = Math.max(0, Number(fee?.applied_fee || 0));
                            const feeAmt = Math.round(aPrazoAmount * (feePct / 100));
                            const totalWithFee = aPrazoAmount + feeAmt;
                            return (
                                <div className="rounded-xl bg-blue-50/80 p-3.5 border border-blue-100 text-sm space-y-1.5">
                                    <div className="flex justify-between text-slate-700">
                                        <span>Cliente:</span>
                                        <strong className="text-slate-900">{selectedCustomer?.name || 'Cliente selecionado'}</strong>
                                    </div>
                                    <div className="flex justify-between text-slate-700">
                                        <span>Valor base à vista:</span>
                                        <strong className="text-slate-800 font-semibold">{formatCurrency(aPrazoAmount)}</strong>
                                    </div>
                                    {feeAmt > 0 && (
                                        <div className="flex justify-between text-amber-700 text-xs">
                                            <span>Taxa do crediário ({feePct}%):</span>
                                            <strong className="font-semibold">+ {formatCurrency(feeAmt)}</strong>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-slate-700 border-t border-blue-200/60 pt-1.5">
                                        <span>Total a prazo:</span>
                                        <strong className="text-blue-800 text-base font-bold">{formatCurrency(totalWithFee)}</strong>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                                    Quantidade de parcelas
                                </label>
                                <select
                                    value={aPrazoInstallmentCount}
                                    onChange={(e) => handleAPrazoCountChange(Number(e.target.value))}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                                        const fee = getBestCreditFeeByInstallment(paymentFees || [], num);
                                        const feePct = Math.max(0, Number(fee?.applied_fee || 0));
                                        const feeAmt = Math.round(aPrazoAmount * (feePct / 100));
                                        const totalWithFee = aPrazoAmount + feeAmt;
                                        const monthly = Math.round(totalWithFee / num);
                                        return (
                                            <option key={num} value={num}>
                                                {num}x {num === 1 && feePct === 0 ? '(à vista a prazo)' : `de ${formatCurrency(monthly)} (Total: ${formatCurrency(totalWithFee)})`}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                                    1º Vencimento (D+30)
                                </label>
                                <input
                                    type="date"
                                    value={aPrazoFirstDueDate}
                                    onChange={(e) => handleAPrazoFirstDueDateChange(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                            <span className="text-xs font-bold uppercase text-slate-500">Cronograma de Vencimentos:</span>
                            <button
                                type="button"
                                onClick={handleAPrazoResetSchedule}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                            >
                                <RefreshCw size={12} />
                                Recalcular Sugestão (Mensal Civil)
                            </button>
                        </div>

                        {/* Tabela de parcelas com datas editáveis e valores exatos */}
                        <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                            {aPrazoSchedule.map((item, index) => (
                                <div key={index} className="flex items-center justify-between p-2.5 bg-white hover:bg-slate-50/80 text-xs sm:text-sm">
                                    <span className="font-semibold text-slate-800 w-24">
                                        Parcela {item.installment_number}/{item.installment_count}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 text-xs">Venc:</span>
                                        <input
                                            type="date"
                                            value={item.due_date}
                                            onChange={(e) => handleAPrazoItemDueDateChange(index, e.target.value)}
                                            className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                                        />
                                    </div>
                                    <span className="font-bold text-blue-700 w-24 text-right">
                                        {formatCurrency(item.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
                            <span>Soma das parcelas: <strong className="text-slate-800">{formatCurrency(aPrazoSchedule.reduce((acc, it) => acc + it.amount, 0))}</strong></span>
                            <span className="text-[11px] text-emerald-700 font-medium">✓ Resto em centavos distribuído</span>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsAPrazoModalOpen(false)}
                                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmAPrazo}
                                className="flex-1 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 shadow-md transition-all"
                            >
                                Confirmar Venda a Prazo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
