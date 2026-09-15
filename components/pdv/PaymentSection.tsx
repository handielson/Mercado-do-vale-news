import React, { useState } from 'react';
import { CreditCard, DollarSign, Share2, Smartphone, Trash2, Calendar, X, RefreshCw } from 'lucide-react';
import { PaymentMethod, PaymentMethodType, PaymentInstallmentScheduleItem } from '../../types/sale';
import type { PdvDisplay, PdvPixPayment } from '../../types/pdvDisplay';
import {
    calculateTotalPaid,
    calculatePaymentSummary,
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
import { CurrencyInput } from '../ui/CurrencyInput';
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
    onResetFinalPaymentAmount?: () => void;
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
    onResetFinalPaymentAmount,
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
    const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
    const [pixMode, setPixMode] = useState<'generate' | 'manual'>('generate');
    const [finalAdjustmentInput, setFinalAdjustmentInput] = useState(0);

    const totalPaid = calculateTotalPaid(payments);
    const remaining = calculateRemaining(total, payments);
    const change = calculateChange(total, payments);
    const summary = calculatePaymentSummary(total, payments);
    const isComplete = summary.isComplete;
    const enteredAmount = paymentAmount ?? remaining;
    const pixPending = Boolean(pdvPixPayment && ['creating', 'pending'].includes(pdvPixPayment.status));
    const creditPayment = [...payments].reverse().find(payment => payment.method === 'credit');
    const creditPaymentTotal = creditPayment ? (creditPayment.total_with_fee ?? creditPayment.amount ?? 0) : 0;
    const creditInstallmentValue = creditPayment?.installments
        ? Math.round(creditPaymentTotal / creditPayment.installments)
        : 0;
    const totalBeforeFinalAdjustment = total + (finalAdjustmentDiscount || 0)
        + payments.reduce((sum, payment) => sum + (payment.original_credit
            ? (payment.original_credit.fee_amount || 0) - (payment.fee_amount || 0) : 0), 0);

    // Estado e configuracao de Venda a Prazo (Crediario)
    const [isAPrazoModalOpen, setIsAPrazoModalOpen] = useState(false);
    const [aPrazoAmount, setAPrazoAmount] = useState(0);
    const [aPrazoInstallmentCount, setAPrazoInstallmentCount] = useState(1);
    const [aPrazoFirstDueDate, setAPrazoFirstDueDate] = useState('');
    const [aPrazoSchedule, setAPrazoSchedule] = useState<PaymentInstallmentScheduleItem[]>([]);

    const applyFinalPaymentAmount = () => {
        if (!onApplyFinalPaymentAmount) return;

        if (finalAdjustmentInput <= 0) {
            toast.error('Digite o total final da venda');
            return;
        }
        onApplyFinalPaymentAmount(finalAdjustmentInput);
    };

    const getTypedPaymentAmount = () => enteredAmount;

    const handleCreatePixPayment = () => {
        const amount = getTypedPaymentAmount();
        if (amount <= 0 || amount > remaining) {
            toast.error('Informe um valor entre zero e o saldo restante');
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

    const openAPrazoModal = () => {
        if (!selectedCustomer) {
            toast.error('Selecione um cliente para vender a prazo');
            return;
        }

        if (payments.some(p => p.method === 'a_prazo')) {
            toast.error('Já existe um pagamento a prazo nesta venda. Remova-o antes de adicionar outro.');
            return;
        }

        const targetAmount = remaining;
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
            toast.error(validation.reason || 'Cronograma de parcelamento inválido');
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
        setPaymentAmount(null);
        setIsAPrazoModalOpen(false);
        toast.success(`A Prazo (${aPrazoSchedule.length}x) adicionado`);
    };

    // Adicionar pagamento
    const handleAddPayment = (method: PaymentMethodType) => {
        if (method === 'a_prazo') {
            openAPrazoModal();
            return;
        }

        const amount = getTypedPaymentAmount();

        if (!amount || amount <= 0) {
            toast.error('Digite um valor válido');
            return;
        }

        if (method !== 'money' && amount > remaining) {
            toast.error('Esse valor excede o saldo restante. Troco é permitido apenas em dinheiro.');
            return;
        }
        if (method === 'pix' && pixPending) return;
        const payment: PaymentMethod = {
            method: method,
            amount: Math.round(amount),
            total_with_fee: Math.round(amount),
        };

        onAddPayment(payment);
        setPaymentAmount(null);
        toast.success(`${getPaymentMethodLabel(method)} adicionado`);
    };

    const addSelectedPayment = () => {
        if (selectedMethod === 'credit') return;
        if (selectedMethod === 'pix' && pixMode === 'generate') handleCreatePixPayment();
        else handleAddPayment(selectedMethod);
    };

    const fillRemaining = () => setPaymentAmount(remaining);

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <CreditCard size={20} />
                Pagamento
            </h3>

            <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-slate-600">Total da venda</p>
                <p className="text-3xl font-bold text-blue-800">{formatCurrency(total)}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
                    <div><span className="block text-slate-600">Recebido (líquido)</span><strong>{formatCurrency(summary.received)}</strong></div>
                    <div><span className="block text-slate-600">A receber no crediário</span><strong>{formatCurrency(summary.deferred)}</strong></div>
                    <div><span className="block text-slate-600">Falta definir</span><strong className="text-blue-800">{formatCurrency(remaining)}</strong></div>
                    <div><span className="block text-slate-600">Troco em dinheiro</span><strong className="text-green-700">{formatCurrency(change)}</strong></div>
                </div>
                {summary.nonCashExcess > 0 && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">Os pagamentos sem dinheiro excedem a venda em {formatCurrency(summary.nonCashExcess)}. Remova o lançamento e corrija o valor.</p>}
                {onPromotionalDiscountChange && (
                    <details className="mt-4 border-t border-blue-200 pt-3">
                        <summary className="cursor-pointer text-sm font-medium text-blue-900">
                            Desconto da venda{promotionalDiscount ? ` · ${formatCurrency(promotionalDiscount)}` : ''}
                        </summary>
                        <div className="mt-3 flex items-end gap-2">
                            <CurrencyInput label="Desconto promocional" value={promotionalDiscount || 0}
                                onChange={onPromotionalDiscountChange} />
                            <button type="button" onClick={() => onPromotionalDiscountChange(0)}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Limpar</button>
                        </div>
                    </details>
                )}
            </div>

            {/* Pagamentos Adicionados */}
            {payments.length > 0 && (
                <div className="mb-4 space-y-2">
                    <h4 className="text-sm font-medium text-slate-700">Pagamentos definidos:</h4>
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
                                    <p className="text-xs text-slate-500">{payment.method === 'a_prazo' ? 'A receber nos vencimentos' : payment.pix_status === 'approved' ? 'Pix aprovado automaticamente' : 'Recebimento informado pelo operador'}</p>
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
            {creditPayment && !payments.some(payment => payment.method === 'a_prazo') && onApplyFinalPaymentAmount && (
                <details className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-lg">
                    <summary className="cursor-pointer text-sm font-semibold text-rose-800">
                        Ajustar total final da venda
                    </summary>
                    <p className="text-xs text-rose-700 mb-3 mt-3">
                        Informe o total de toda a venda, incluindo Pix e dinheiro já definidos. O ajuste será aplicado ao último cartão, mantendo a quantidade de parcelas.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                        <CurrencyInput label="Total final da venda" value={finalAdjustmentInput}
                            onChange={setFinalAdjustmentInput}
                            placeholder={(total / 100).toFixed(2).replace('.', ',')}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') { event.preventDefault(); applyFinalPaymentAmount(); }
                            }} />
                        <button
                            onClick={applyFinalPaymentAmount}
                            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-medium"
                        >
                            Aplicar ajuste
                        </button>
                        <button
                            onClick={() => {
                                setFinalAdjustmentInput(0);
                                onResetFinalPaymentAmount?.();
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
                            <span className="block text-rose-700">Redução total</span>
                            <strong className="text-red-600">-{formatCurrency(Math.max(0, totalBeforeFinalAdjustment - total))}</strong>
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
                            Outros pagamentos definidos: {formatCurrency(totalPaid - creditPaymentTotal)}
                        </p>
                    )}
                </details>
            )}

            {!isComplete && (
                <section className="mb-5 space-y-4" aria-label="Adicionar pagamento">
                    <h4 className="text-sm font-semibold text-slate-800">1. Escolha a forma de pagamento</h4>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {(['money', 'pix', 'debit', 'credit', 'a_prazo'] as PaymentMethodType[]).map(method => (
                            <button key={method} type="button" aria-pressed={selectedMethod === method}
                                onClick={() => { setSelectedMethod(method); setPaymentAmount(null); }}
                                disabled={method === 'a_prazo' && payments.some(payment => payment.method === 'a_prazo')}
                                className={`rounded-lg border-2 px-2 py-3 text-xs font-semibold disabled:opacity-50 ${selectedMethod === method ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                                <span aria-hidden="true" className="mb-1 block text-xl">{getPaymentMethodIcon(method)}</span>
                                {{money: 'Dinheiro', pix: 'Pix', debit: 'Débito', credit: 'Crédito', a_prazo: 'Crediário'}[method]}
                            </button>
                        ))}
                    </div>
                    {selectedMethod === 'a_prazo' ? (
                        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">O saldo de {formatCurrency(remaining)} será lançado no crediário. Adicione a entrada antes de definir as parcelas.</p>
                    ) : (
                        <div className="flex items-end gap-2">
                            <CurrencyInput label={selectedMethod === 'money' ? '2. Dinheiro entregue pelo cliente' : '2. Valor nesta forma de pagamento'}
                                value={enteredAmount} onChange={setPaymentAmount}
                                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); addSelectedPayment(); } }} />
                            <button type="button" onClick={fillRemaining} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">Usar restante</button>
                        </div>
                    )}
                    {selectedMethod === 'pix' && (
                        <div className="space-y-2 text-sm">
                            <label className="flex items-center gap-2"><input type="radio" name="pdv-pix-mode" checked={pixMode === 'generate'} onChange={() => setPixMode('generate')} />Gerar cobrança e aguardar aprovação</label>
                            <label className="flex items-center gap-2"><input type="radio" name="pdv-pix-mode" checked={pixMode === 'manual'} onChange={() => setPixMode('manual')} />Registrar Pix já recebido (conferência manual)</label>
                        </div>
                    )}
                    {selectedMethod === 'credit' ? (
                        enteredAmount > 0 && enteredAmount <= remaining && paymentFees && onSelectInstallment ? (
                            <InstallmentCalculator remainingBalance={enteredAmount} paymentFees={paymentFees}
                                onSelectInstallment={(...args) => { onSelectInstallment(...args); setPaymentAmount(null); }} />
                        ) : <p role="alert" className="text-sm text-amber-700">Informe um valor maior que zero e até {formatCurrency(remaining)} para consultar as parcelas.</p>
                    ) : (
                        <button type="button" onClick={addSelectedPayment}
                            disabled={selectedMethod === 'pix' && (pixPending || pdvPixLoading || (pixMode === 'generate' && Boolean(pdvPixPayment)))}
                            className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                            {selectedMethod === 'a_prazo' ? 'Definir parcelas do crediário' : selectedMethod === 'pix' && pixMode === 'generate' ? 'Gerar Pix Mercado Pago' : 'Adicionar pagamento'}
                        </button>
                    )}
                </section>
            )}

            {/* Totem / Display / Pix Mercado Pago */}
            {((selectedMethod === 'pix' && pixMode === 'generate' && !isComplete) || pdvPixPayment) && <div className="mb-4 rounded-lg border border-cyan-100 bg-cyan-50/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                        <h4 className="text-sm font-semibold text-cyan-900">Cobrança Pix</h4>
                        <p className="text-xs text-cyan-700">
                            A cobrança só entra nos pagamentos após a aprovação. O display é opcional.
                        </p>
                    </div>
                    <span className="rounded bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                        Totem visual
                    </span>
                </div>

                <details className="mb-3"><summary className="cursor-pointer text-sm font-medium text-cyan-900">Configurar display e caixa</summary>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                                    {display.name || display.slug}
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
                                    {display.name || display.slug} ({display.cashier_key || 'sem chave'})
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                </details>

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

                {pdvPixPayment && <div className="grid grid-cols-2 gap-2">
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
                    {onSharePdvPixReceipt && <button
                        onClick={onSharePdvPixReceipt}
                        disabled={!pdvPixPayment || pdvPixPayment.status !== 'approved' || pdvPixLoading}
                        className="inline-flex items-center justify-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <Share2 size={14} />
                        Compartilhar comprovante
                    </button>}
                    {onClearPdvTotemVisual && <button
                        onClick={onClearPdvTotemVisual}
                        disabled={!pdvPixDisplayId || pdvPixLoading}
                        className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                    >
                        Limpar totem
                    </button>}
                </div>}
            </div>}

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
