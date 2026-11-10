// marketplace-sale-financials-ml-tiktok-v1: estimativa do "Financeiro da venda" pelas taxas configuradas
// por canal (mesma tabela e mesmo cálculo da Página do Produto: calculateChannelProfit).
// Usada quando o Mercado Livre ou o TikTok não informam os valores reais (ex.: TikTok sem escopo de
// Finanças, código 105005). Tudo em centavos.
import { calculateChannelProfit, isChannelFeeConfigured } from './channelProfit.js';

export const ESTIMATE_CHANNEL_LABELS = { mercado_livre: 'Mercado Livre', tiktok: 'TikTok Shop' };

/**
 * financial: resumo devolvido pela VPS (state 'unavailable' + estimate_basis).
 * fee: taxa normalizada do canal (loadChannelFees()[estimate_basis.channel_fee_id]).
 * Devolve o próprio resumo quando não há o que estimar.
 */
export function buildEstimatedMarketplaceFinancial(financial, fee) {
    const basis = financial?.estimate_basis;
    if (!financial || financial.state !== 'unavailable' || !basis || !Array.isArray(basis.items) || !basis.items.length) return financial;
    const channelLabel = ESTIMATE_CHANNEL_LABELS[basis.channel_fee_id] || basis.channel_fee_id;
    const reason = String(basis.reason || financial.note || '').trim();
    if (!isChannelFeeConfigured(fee)) {
        return {
            ...financial,
            note: `${reason ? `${reason} ` : ''}Para ver uma estimativa, cadastre as taxas do ${channelLabel} em "Taxas por canal" (Página do Produto).`,
        };
    }

    // Comissão, tarifa fixa por faixa, imposto e outras % são por unidade (como na Página do Produto);
    // frete e embalagem configurados entram uma vez por pedido (um envio).
    const perUnitFee = { ...fee, packagingCents: 0, shippingCents: 0 };
    let revenueCents = 0;
    let commissionCents = 0;
    let taxesOtherCents = 0;
    for (const item of basis.items) {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const unit = calculateChannelProfit({ priceCents: item.unit_price_cents, costCents: item.unit_cost_cents, fee: perUnitFee });
        revenueCents += unit.priceCents * quantity;
        commissionCents += (unit.commissionCents + unit.fixedCents) * quantity;
        taxesOtherCents += (unit.taxCents + unit.otherCents) * quantity;
    }
    const shippingCents = Math.max(0, Math.round(Number(fee.shippingCents) || 0));
    taxesOtherCents += Math.max(0, Math.round(Number(fee.packagingCents) || 0));

    const feeLines = [];
    if (commissionCents) feeLines.push({ key: 'estimated_commission', label: 'Comissão/tarifa (estimada)', amount_cents: -commissionCents });
    if (shippingCents) feeLines.push({ key: 'estimated_shipping', label: 'Frete pago pelo vendedor (estimado)', amount_cents: -shippingCents });
    if (taxesOtherCents) feeLines.push({ key: 'estimated_taxes_other', label: 'Impostos, embalagem e outras taxas (estimado)', amount_cents: -taxesOtherCents });

    const deductionsCents = commissionCents + shippingCents + taxesOtherCents;
    const payoutCents = revenueCents - deductionsCents;
    const costCents = Number(financial.cost?.total_cents) || 0;
    const profitCents = payoutCents - costCents;
    return {
        ...financial,
        origin: 'configured_fees',
        state: 'estimated',
        note: `Estimado pelas taxas configuradas do ${channelLabel} (não é o valor real do marketplace).${reason ? ` Motivo: ${reason}` : ''}`,
        product_revenue_cents: revenueCents,
        revenue_lines: [{ key: 'items', label: 'Preço dos produtos', amount_cents: revenueCents }],
        fee_lines: feeLines,
        marketplace_deductions_cents: deductionsCents,
        marketplace_deductions_pct: revenueCents > 0 ? (deductionsCents / revenueCents) * 100 : null,
        payout_cents: payoutCents,
        profit_cents: profitCents,
        margin_pct: revenueCents > 0 ? (profitCents / revenueCents) * 100 : null,
        raw_fields: [],
    };
}
