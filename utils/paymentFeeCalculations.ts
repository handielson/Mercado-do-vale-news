import type { PaymentFee } from '../types/payment-fees';

export type CreditInstallmentOption = {
    installments: number;
    feePercentage: number;
    feeAmount: number;
    operatorFeePercentage: number;
    operatorFeeAmount: number;
    totalWithFee: number;
    monthlyPayment: number;
};

function scorePaymentFeeForCredit(fee: PaymentFee): number {
    const appliedFee = Number(fee.applied_fee || 0);
    const operatorFee = Number(fee.operator_fee || 0);
    return (appliedFee > 0 ? 2 : 0) + (operatorFee > 0 ? 1 : 0);
}

function isCreditPaymentFeeCandidate(fee: PaymentFee): boolean {
    const method = String(fee.payment_method || '').trim();
    const channel = String(fee.channel || '').trim();
    const installments = Number(fee.installments || 0);

    return method === 'credit'
        || (!method && channel === 'presencial' && installments >= 1);
}

export function getBestCreditFeeByInstallment(paymentFees: PaymentFee[] = [], installments: number): PaymentFee | null {
    const targetInstallments = Number(installments || 0);
    if (!Number.isInteger(targetInstallments) || targetInstallments < 1) return null;

    const candidates = paymentFees
        .filter(isCreditPaymentFeeCandidate)
        .filter((fee) => Number(fee.installments || 0) === targetInstallments)
        .sort((a, b) => {
            const scoreDelta = scorePaymentFeeForCredit(b) - scorePaymentFeeForCredit(a);
            if (scoreDelta !== 0) return scoreDelta;
            return Number(b.applied_fee || 0) - Number(a.applied_fee || 0);
        });

    return candidates[0] || null;
}

export function getCreditInstallmentOptions(
    remainingBalance: number,
    paymentFees: PaymentFee[] = []
): CreditInstallmentOption[] {
    const installments = Array.from(new Set(
        paymentFees
            .filter(isCreditPaymentFeeCandidate)
            .map((fee) => Number(fee.installments || 0))
            .filter((value) => Number.isInteger(value) && value >= 1 && value <= 12)
    )).sort((a, b) => a - b);

    return installments.map((installmentCount) => {
        const fee = getBestCreditFeeByInstallment(paymentFees, installmentCount);
        const feePercentage = Number(fee?.applied_fee || 0);
        const operatorFeePercentage = Number(fee?.operator_fee || 0);
        const feeAmount = Math.round(remainingBalance * (feePercentage / 100));
        const operatorFeeAmount = Math.round(remainingBalance * (operatorFeePercentage / 100));
        const totalWithFee = remainingBalance + feeAmount;

        return {
            installments: installmentCount,
            feePercentage,
            feeAmount,
            operatorFeePercentage,
            operatorFeeAmount,
            totalWithFee,
            monthlyPayment: Math.round(totalWithFee / installmentCount),
        };
    });
}
