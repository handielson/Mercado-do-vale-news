import { paymentFeesService } from './payment-fees';

/**
 * Installment plan details
 */
export interface InstallmentPlan {
    installments: number;
    value: number;           // Valor da parcela (centavos)
    total: number;           // Total a pagar (centavos)
    label: string;           // "À VISTA (PIX)", "10x", etc.
    highlighted?: boolean;   // Destacar visualmente
}

/**
 * Calculate installments using payment_fees table
 */
export async function calculateInstallments(
    priceInCents: number,
    maxInstallments: number = 12
): Promise<InstallmentPlan[]> {
    const plans: InstallmentPlan[] = [];

    // Get payment fees from database
    const fees = await paymentFeesService.list();

    // PIX (à vista - canal presencial 1x)
    const pixFee = fees.find(f => f.channel === 'presencial' && f.installments === 1);
    const appliedPixFee = parseFloat(String(pixFee?.applied_fee_pct ?? (pixFee as any)?.applied_fee ?? 0));
    const pixTotal = Math.round(priceInCents * (1 + appliedPixFee / 100));

    plans.push({
        installments: 1,
        value: pixTotal,
        total: pixTotal,
        label: 'À VISTA (PIX)',
        highlighted: true
    });

    // Credit card installments (1x-12x) - method é null no banco, filtra por channel
    const presencialFees = fees
        .filter(f => f.channel === 'presencial' && f.installments >= 1 && f.installments <= maxInstallments)
        .sort((a, b) => a.installments - b.installments)
        .filter((fee, idx, arr) => idx === arr.findIndex(f => f.installments === fee.installments));

    for (const fee of presencialFees) {
        if (fee.installments === 1) continue; // PIX já adicionado acima

        const appliedFeeDecimal = parseFloat(String(fee.applied_fee_pct ?? (fee as any).applied_fee ?? 0)) / 100;
        const total = Math.round(priceInCents * (1 + appliedFeeDecimal));
        const installmentValue = Math.round(total / fee.installments);

        plans.push({
            installments: fee.installments,
            value: installmentValue,
            total: total,
            label: `${fee.installments}x`,
            highlighted: fee.installments === 10
        });
    }

    return plans;
}

/**
 * Format price in cents to BRL currency string
 */
export function formatPrice(cents: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(cents / 100);
}
