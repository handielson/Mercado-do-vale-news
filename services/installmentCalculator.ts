import { paymentFeesService } from './payment-fees';
import type { PaymentFee } from './payment-fees';

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

// payment-fee-method-v1 (23/11/2026): desde 21/11 cada taxa tem forma de pagamento (pix/debit/credit).
// "À vista no PIX" pegava a primeira taxa presencial 1x, que passou a ser a do crédito 1x (3,99%):
// o orçamento compartilhado mostrava o PIX 3,99% mais caro. Agora PIX usa a taxa pix e o cartão usa a de crédito.
function feeMethod(fee: PaymentFee | undefined): string {
    return String((fee as any)?.payment_method ?? (fee as any)?.method ?? '').toLowerCase();
}
function isCreditFee(fee: PaymentFee): boolean {
    const method = feeMethod(fee);
    return method === 'credit' || method === '';
}
export function findPixFee(fees: PaymentFee[], channel: PaymentFee['channel'] = 'presencial'): PaymentFee | undefined {
    const oneShot = fees.filter(f => f.channel === channel && f.installments === 1);
    return oneShot.find(f => feeMethod(f) === 'pix') ?? oneShot.find(f => feeMethod(f) === '');
}

function getAppliedFeePercent(fee: PaymentFee | undefined): number {
    return parseFloat(String((fee as any)?.applied_fee_pct ?? fee?.applied_fee ?? 0)) || 0;
}

export function calculateInstallmentFromFees(
    priceInCents: number,
    fees: PaymentFee[],
    installments: number = 12,
    channel: PaymentFee['channel'] = 'presencial'
): InstallmentPlan {
    const candidates = fees.filter(f => f.channel === channel && f.installments === installments && isCreditFee(f));
    const fee = candidates.find(f => feeMethod(f) === 'credit') ?? candidates[0];
    const appliedFeePercent = getAppliedFeePercent(fee);
    const total = Math.round(priceInCents * (1 + appliedFeePercent / 100));

    return {
        installments,
        value: Math.round(total / installments),
        total,
        label: `${installments}x`,
        highlighted: installments === 12
    };
}

export function calculatePixPrice(priceInCents: number, discountPercent: number = 0): number {
    const safeDiscountPercent = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    return Math.round(priceInCents * (1 - safeDiscountPercent / 100));
}

/**
 * Calculate installments using payment_fees table
 */
export async function calculateInstallments(
    priceInCents: number,
    maxInstallments: number = 12
): Promise<InstallmentPlan[]> {
    const plans: InstallmentPlan[] = [];

    // Get payment fees from database — falha silenciosa se a VPS estiver indisponível
    let fees: Awaited<ReturnType<typeof paymentFeesService.list>> = [];
    try {
        fees = await paymentFeesService.list();
    } catch {
        // VPS indisponível ou endpoint inexistente — retorna só à vista sem taxas
        plans.push({ installments: 1, value: priceInCents, total: priceInCents, label: 'À VISTA (PIX)', highlighted: true });
        return plans;
    }

    // PIX (à vista - canal presencial 1x)
    const pixFee = findPixFee(fees, 'presencial');
    const appliedPixFee = getAppliedFeePercent(pixFee);
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
        .filter(f => f.channel === 'presencial' && f.installments >= 1 && f.installments <= maxInstallments && isCreditFee(f))
        .sort((a, b) => a.installments - b.installments)
        .filter((fee, idx, arr) => idx === arr.findIndex(f => f.installments === fee.installments));

    for (const fee of presencialFees) {
        if (fee.installments === 1) continue; // PIX já adicionado acima

        const plan = calculateInstallmentFromFees(priceInCents, fees, fee.installments);

        plans.push({
            ...plan,
            highlighted: fee.installments === 12
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
