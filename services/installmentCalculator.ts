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

    // PIX (à vista - 0% fee)
    const pixFee = fees.find(f => f.payment_method === 'pix' && f.installments === 1);
    const pixTotal = pixFee
        ? Math.round(priceInCents * (1 + pixFee.applied_fee / 100))
        : priceInCents;

    plans.push({
        installments: 1,
        value: pixTotal,
        total: pixTotal,
        label: 'À VISTA (PIX)',
        highlighted: true
    });

    // Credit card installments (1x-12x)
    for (let i = 1; i <= maxInstallments; i++) {
        const fee = fees.find(f => f.payment_method === 'credit' && f.installments === i);

        if (!fee) continue;

        // Calculate total with compound interest
        const appliedFeeDecimal = fee.applied_fee / 100;
        const total = Math.round(priceInCents * Math.pow(1 + appliedFeeDecimal, 1));
        const installmentValue = Math.round(total / i);

        plans.push({
            installments: i,
            value: installmentValue,
            total: total,
            label: i === 1 ? '1x' : `${i}x`,
            highlighted: i === 10 // Highlight 10x as default
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
