import { useState, useMemo } from 'react';
import { CreditCard, Smartphone, Check } from 'lucide-react';
import type { InstallmentPlan } from '@/services/installmentCalculator';
import { formatPrice } from '@/services/installmentCalculator';
import { paymentFeesService } from '@/services/payment-fees';
import { useEffect } from 'react';

interface MixedPaymentSimulatorProps {
    totalPrice: number; // em centavos
}

interface CardOption {
    installments: number;
    monthlyValue: number; // centavos
    totalWithFee: number; // centavos
    feePercent: number;
}

function formatCents(cents: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(cents / 100);
}

export function MixedPaymentSimulator({ totalPrice }: MixedPaymentSimulatorProps) {
    const [cashInput, setCashInput] = useState('');
    const [selectedInstallment, setSelectedInstallment] = useState<number | null>(null);
    const [paymentFees, setPaymentFees] = useState<any[]>([]);

    // Carregar taxas do banco uma vez
    useEffect(() => {
        paymentFeesService.list()
            .then(setPaymentFees)
            .catch(() => setPaymentFees([]));
    }, []);

    // Valor em dinheiro/Pix em centavos
    const cashCents = useMemo(() => {
        const raw = cashInput.replace(',', '.').replace(/[^0-9.]/g, '');
        const val = Math.round(parseFloat(raw) * 100);
        if (isNaN(val) || val < 0) return 0;
        return Math.min(val, totalPrice);
    }, [cashInput, totalPrice]);

    // Restante no cartão
    const cardCents = totalPrice - cashCents;

    // Opções de parcelamento calculadas sobre o valor restante no cartão
    const cardOptions: CardOption[] = useMemo(() => {
        if (cardCents <= 0) return [];

        const creditFees = paymentFees
            .filter(f => f.payment_method === 'credit' && f.installments <= 12)
            .sort((a, b) => a.installments - b.installments);

        return creditFees.map(fee => {
            const feeAmount = Math.round(cardCents * (fee.applied_fee / 100));
            const totalWithFee = cardCents + feeAmount;
            const monthlyValue = Math.round(totalWithFee / fee.installments);
            return {
                installments: fee.installments,
                monthlyValue,
                totalWithFee,
                feePercent: fee.applied_fee,
            };
        });
    }, [cardCents, paymentFees]);

    // Reset seleção se restante zerar
    useEffect(() => {
        if (cardCents <= 0) setSelectedInstallment(null);
    }, [cardCents]);

    const selectedOption = cardOptions.find(o => o.installments === selectedInstallment);

    return (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-blue-100 rounded-xl p-4 space-y-4">
            {/* Título */}
            <div className="flex items-center gap-2">
                <span className="text-lg">💡</span>
                <h4 className="font-semibold text-slate-800 text-sm">Simular Pagamento Combinado</h4>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center text-sm bg-white rounded-lg p-3 border border-slate-200">
                <span className="text-slate-600">Total do pedido:</span>
                <span className="font-bold text-slate-900">{formatCents(totalPrice)}</span>
            </div>

            {/* Botão Rápido: Pagar tudo no PIX */}
            <button
                onClick={() => {
                    setCashInput((totalPrice / 100).toFixed(2).replace('.', ','));
                    setSelectedInstallment(null);
                }}
                className={`w-full p-3 rounded-xl border-2 text-left transition-all duration-150 ${cashCents === totalPrice
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-green-300 hover:bg-slate-50'
                    }`}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <span className={`font-bold text-sm ${cashCents === totalPrice ? 'text-green-700' : 'text-slate-800'}`}>
                            À VISTA (PIX)
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Total: {formatCents(totalPrice)}
                        </p>
                    </div>
                    {cashCents === totalPrice && (
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                </div>
            </button>

            {/* Input: valor em dinheiro/Pix */}
            {cashCents !== totalPrice && (
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        <Smartphone className="w-3.5 h-3.5 text-cyan-600" />
                        Ou digite outro valor em Dinheiro / Pix:
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">R$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={cashInput}
                            onChange={e => {
                                // Permite apenas números e vírgula/ponto
                                const val = e.target.value.replace(/[^0-9.,]/g, '');
                                setCashInput(val);
                                setSelectedInstallment(null);
                            }}
                            placeholder="0,00"
                            className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm font-medium transition-colors"
                        />
                    </div>
                    {cashCents > 0 && (
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>Pix/Dinheiro: <strong className="text-cyan-700">{formatCents(cashCents)}</strong></span>
                            <span>Restante cartão: <strong className="text-blue-700">{formatCents(Math.max(0, cardCents))}</strong></span>
                        </div>
                    )}
                </div>
            )}

            {/* Opções de parcelamento - aparece em tempo real conforme digita */}
            {cardCents > 0 && cardOptions.length > 0 && (
                <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                        Restante no Cartão — Escolha as parcelas
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {cardOptions.map(option => {
                            const isSelected = selectedInstallment === option.installments;
                            return (
                                <button
                                    key={option.installments}
                                    onClick={() => setSelectedInstallment(isSelected ? null : option.installments)}
                                    className={`w-full p-2.5 rounded-lg border-2 text-center flex flex-col items-center justify-center transition-all duration-150 ${isSelected
                                        ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-500'
                                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <span className={`font-bold text-xs md:text-sm ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                                        {option.installments === 1
                                            ? '1x no cartão'
                                            : `${option.installments}x ${formatCents(option.monthlyValue)}`}
                                    </span>
                                    {option.installments > 1 && (
                                        <p className="text-[10px] md:text-xs text-slate-500 mt-1">
                                            Total: {formatCents(option.totalWithFee)}
                                        </p>
                                    )}
                                    {isSelected && (
                                        <div className="absolute top-1 right-1">
                                            <Check className="w-3.5 h-3.5 text-blue-600" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Caso só tenha Pix (cardCents = 0) */}
            {cashCents > 0 && cardCents === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 font-medium text-center">
                    ✅ Pagamento completo no Pix/Dinheiro
                </div>
            )}

            {/* Resumo do simulador */}
            {selectedOption && cashCents > 0 && (
                <div className="bg-white border-2 border-blue-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">📊 Resumo da Simulação</p>
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-1 text-cyan-700">
                                <Smartphone className="w-3.5 h-3.5" /> Pix / Dinheiro
                            </span>
                            <span className="font-bold text-cyan-800">{formatCents(cashCents)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-1 text-blue-700">
                                <CreditCard className="w-3.5 h-3.5" />
                                {selectedOption.installments === 1
                                    ? '1x no cartão'
                                    : `${selectedOption.installments}x de ${formatCents(selectedOption.monthlyValue)}`}
                            </span>
                            <span className="font-bold text-blue-800">{formatCents(selectedOption.totalWithFee)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-200 text-slate-900">
                            <span>Total Geral</span>
                            <span>{formatCents(cashCents + selectedOption.totalWithFee)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Resumo só com cartão (sem Pix) */}
            {selectedOption && cashCents === 0 && (
                <div className="bg-white border-2 border-blue-200 rounded-xl p-4 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">📊 Resumo da Simulação</p>
                    <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1 text-blue-700">
                            <CreditCard className="w-3.5 h-3.5" />
                            {selectedOption.installments === 1
                                ? '1x no cartão'
                                : `${selectedOption.installments}x de ${formatCents(selectedOption.monthlyValue)}`}
                        </span>
                        <span className="font-bold text-blue-800">{formatCents(selectedOption.totalWithFee)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
