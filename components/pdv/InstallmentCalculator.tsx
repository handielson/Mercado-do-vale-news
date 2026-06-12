import React from 'react';
import { CreditCard } from 'lucide-react';
import { PaymentFee } from '../../types/payment-fees';
import { formatCurrency } from '../../utils/saleCalculations';

interface InstallmentCalculatorProps {
    remainingBalance: number; // Saldo restante em centavos
    paymentFees: PaymentFee[]; // Tabela de taxas
    onSelectInstallment: (
        installments: number,
        amount: number,
        feeAmount: number,
        operatorFeeAmount: number,
        operatorFeePercentage: number,
        appliedFeePercentage: number
    ) => void;
}

export const InstallmentCalculator: React.FC<InstallmentCalculatorProps> = ({
    remainingBalance,
    paymentFees,
    onSelectInstallment
}) => {
    // Filtrar apenas taxas de crédito (se payment_method não for explícito 'credit', mas for da maquineta presencial)
    const creditFees = paymentFees
        .filter(f => f.payment_method === 'credit' || (f.channel === 'presencial' && f.installments >= 1))
        .filter(f => f.installments >= 1 && f.installments <= 12)
        .filter((fee, idx, arr) => idx === arr.findIndex(f => f.installments === fee.installments))
        .sort((a, b) => a.installments - b.installments);

    // Debug: verificar valores vindos do VPS
    console.log('Payment Fees from VPS:', creditFees);

    // Calcular opções de parcelamento
    const installmentOptions = creditFees.map(fee => {
        const feeAmount = Math.round(remainingBalance * (fee.applied_fee / 100));
        const operatorFeeAmount = Math.round(remainingBalance * (fee.operator_fee / 100));
        const totalWithFee = remainingBalance + feeAmount;
        const monthlyPayment = Math.round(totalWithFee / fee.installments);

        console.log(`${fee.installments}x: applied_fee=${fee.applied_fee}%, feeAmount=${feeAmount}, total=${totalWithFee}`);

        return {
            installments: fee.installments,
            feePercentage: fee.applied_fee,
            feeAmount,
            operatorFeePercentage: fee.operator_fee,
            operatorFeeAmount,
            totalWithFee,
            monthlyPayment
        };
    });

    if (remainingBalance <= 0) {
        return (
            <div className="installment-calculator bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-green-700 font-medium flex items-center gap-2">
                    ✅ Pagamento completo!
                </p>
            </div>
        );
    }

    return (
        <div className="installment-calculator bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                Opções de Parcelamento
            </h3>

            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-gray-700">Saldo restante:</div>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(remainingBalance)}</div>
            </div>

            {installmentOptions.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                    {installmentOptions.map(option => (
                        <button
                            key={option.installments}
                            onClick={() => onSelectInstallment(
                                option.installments,
                                remainingBalance,
                                option.feeAmount,
                                option.operatorFeeAmount,
                                option.operatorFeePercentage,
                                option.feePercentage
                            )}
                            className="flex flex-col items-center p-3 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <span className="text-sm font-bold text-gray-800">
                                {option.installments}x
                            </span>
                            <span className="text-base font-bold text-blue-600 mt-1">
                                {formatCurrency(option.monthlyPayment)}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-1 font-medium">
                                Total: {formatCurrency(option.totalWithFee)}
                            </span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                        ⚠️ Nenhuma taxa de parcelamento configurada. Configure as taxas em Configurações → Taxas de Pagamento.
                    </p>
                </div>
            )}

            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600">
                    <strong>Nota:</strong> Os valores mostrados incluem o acréscimo da máquina de cartão.
                    O cliente paga o total mostrado na coluna "Total".
                </p>
            </div>
        </div>
    );
};

export default InstallmentCalculator;
