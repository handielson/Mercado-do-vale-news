import React from 'react';
import { CreditCard } from 'lucide-react';
import { PaymentFee } from '../../types/payment-fees';
import { formatCurrency } from '../../utils/saleCalculations';

interface InstallmentCalculatorProps {
    remainingBalance: number; // Saldo restante em centavos
    paymentFees: PaymentFee[]; // Tabela de taxas
    onSelectInstallment: (installments: number, amount: number, feeAmount: number) => void;
}

export const InstallmentCalculator: React.FC<InstallmentCalculatorProps> = ({
    remainingBalance,
    paymentFees,
    onSelectInstallment
}) => {
    // Filtrar apenas taxas de crédito e ordenar por parcelas
    const creditFees = paymentFees
        .filter(f => f.payment_method === 'credit')
        .sort((a, b) => a.installments - b.installments);

    // Debug: verificar valores vindos do Supabase
    console.log('Payment Fees from Supabase:', creditFees);

    // Calcular opções de parcelamento
    const installmentOptions = creditFees.map(fee => {
        const feeAmount = Math.round(remainingBalance * (fee.applied_fee / 100));
        const totalWithFee = remainingBalance + feeAmount;
        const monthlyPayment = Math.round(totalWithFee / fee.installments);

        console.log(`${fee.installments}x: applied_fee=${fee.applied_fee}%, feeAmount=${feeAmount}, total=${totalWithFee}`);

        return {
            installments: fee.installments,
            feePercentage: fee.applied_fee,
            feeAmount,
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
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="text-left p-2 font-semibold">Parcelas</th>
                                <th className="text-right p-2 font-semibold">Valor/mês</th>
                                <th className="text-right p-2 font-semibold">Total</th>
                                <th className="text-center p-2 font-semibold">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {installmentOptions.map(option => (
                                <tr
                                    key={option.installments}
                                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                >
                                    <td className="p-2 font-medium">{option.installments}x</td>
                                    <td className="p-2 text-right">{formatCurrency(option.monthlyPayment)}</td>
                                    <td className="p-2 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-medium">{formatCurrency(option.totalWithFee)}</span>
                                            {option.feeAmount > 0 && (
                                                <span className="text-xs text-orange-600">
                                                    (+{formatCurrency(option.feeAmount)})
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-2 text-center">
                                        <button
                                            onClick={() => onSelectInstallment(
                                                option.installments,
                                                remainingBalance,
                                                option.feeAmount
                                            )}
                                            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                        >
                                            Usar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
