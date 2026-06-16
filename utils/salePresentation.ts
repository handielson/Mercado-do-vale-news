import { PaymentMethod, SaleItem, SaleWithItems } from '../types/sale';
import { formatMoneyCents, moneyToCents } from './money';

export type SaleProfitItem = {
    sale_item_id?: string | null;
    product_id?: string | null;
    product_name?: string | null;
    sku?: string | null;
    quantity?: number;
    unit_price?: number;
    unit_cost?: number;
    item_profit?: number;
};

export type SaleProfitData = {
    sale_id?: string;
    total_cents?: number;
    cost_total_cents?: number;
    payment_operator_fee_cents?: number;
    delivery_payout_cents?: number;
    profit_cents?: number;
    items?: SaleProfitItem[];
} | null;

export type ProductSpecsMap = Record<string, Record<string, string>>;

export function formatCurrencyCents(value: number | null | undefined): string {
    return formatMoneyCents(value);
}

export function getPaymentLabel(method: string): string {
    const labels: Record<string, string> = {
        money: 'Dinheiro',
        pix: 'PIX',
        credit: 'Cartao de Credito',
        debit: 'Cartao de Debito',
        a_prazo: 'A Prazo / Crediario',
        transfer: 'Transferencia Bancaria',
        check: 'Cheque'
    };

    return labels[method] || method || 'Pagamento';
}

export function getProfitItemForSaleItem(item: SaleItem, profitData?: SaleProfitData): SaleProfitItem | null {
    const items = profitData?.items || [];
    const itemId = String((item as any).id || '');
    const productId = String((item as any).product_id || '');

    return items.find(candidate => String(candidate.sale_item_id || '') === itemId)
        || items.find(candidate => String(candidate.product_id || '') === productId)
        || null;
}

export function buildSaleItemPresentation(
    item: SaleItem,
    productSpecs?: ProductSpecsMap,
    profitData?: SaleProfitData
) {
    const itemSpecs = productSpecs?.[(item as any).id] || {};
    const productLevelSpecs = productSpecs?.[(item as any).product_id] || {};
    const specs = { ...productLevelSpecs, ...itemSpecs };
    const profitItem = getProfitItemForSaleItem(item, profitData);

    const sku = String(
        profitItem?.sku
        || specs.sku
        || (item as any).product_sku
        || (item as any).sku
        || ''
    ).trim();

    const identifiers: string[] = [];
    if (sku) identifiers.push(`SKU: ${sku}`);
    if (specs.imei1) identifiers.push(`IMEI 1: ${specs.imei1}`);
    if (specs.imei2) identifiers.push(`IMEI 2: ${specs.imei2}`);
    if (specs.serial) identifiers.push(`Serial: ${specs.serial}`);

    const quantity = Number(item.quantity) || 1;
    const unitPrice = moneyToCents(item.unit_price);
    const itemSubtotal = moneyToCents((item as any).subtotal ?? unitPrice * quantity);
    const itemTotal = moneyToCents(item.total);
    const profitUnitCost = moneyToCents(profitItem?.unit_cost ?? 0);
    const itemUnitCost = moneyToCents(item.unit_cost ?? 0);
    const unitCost = profitUnitCost > 0 ? profitUnitCost : itemUnitCost;
    const itemCost = unitCost * quantity;
    const itemProfit = profitItem?.item_profit == null
        ? itemTotal - itemCost
        : moneyToCents(profitItem.item_profit);

    return {
        sku: sku || 'N/A',
        identifiers,
        identifierLine: identifiers.length > 0 ? identifiers.join(' | ') : 'SKU: N/A',
        unitPrice,
        itemSubtotal,
        itemTotal,
        unitCost,
        itemCost,
        itemProfit
    };
}

export function buildPaymentPresentation(payment: PaymentMethod) {
    const installments = Math.max(1, Number(payment.installments) || 1);
    const totalWithFee = moneyToCents((payment as any).total_with_fee ?? (payment as any).total_with_fee_cents ?? payment.amount ?? 0);
    const feeAmount = moneyToCents((payment as any).fee_amount ?? (payment as any).fee_cents ?? 0);
    const amount = getPaymentBaseAmount(payment, totalWithFee, feeAmount);
    const operatorFeeAmount = moneyToCents((payment as any).operator_fee_amount ?? (payment as any).operator_fee_cents ?? 0);
    const spreadAmount = Math.max(0, feeAmount - operatorFeeAmount);
    const installmentValue = installments > 1 ? Math.round(totalWithFee / installments) : 0;
    const isCredit = payment.method === 'credit';
    const isCard = payment.method === 'credit' || payment.method === 'debit';
    const details: string[] = [];

    if (isCredit) {
        details.push(
            installments > 1
                ? `${installments}x de ${formatCurrencyCents(installmentValue)}`
                : 'Parcelas: 1x'
        );
    }
    if (isCard || feeAmount > 0) details.push(`Acrescimo cobrado do cliente: ${formatCurrencyCents(feeAmount)}`);
    if (isCard || operatorFeeAmount > 0) details.push(`Custo da maquina: ${formatCurrencyCents(operatorFeeAmount)}`);
    if (spreadAmount > 0) details.push(`Sobra da taxa: ${formatCurrencyCents(spreadAmount)}`);
    if (payment.fee_percentage && Number(payment.fee_percentage) > 0) {
        details.push(`Percentual cobrado: ${Number(payment.fee_percentage).toFixed(2).replace('.', ',')}%`);
    } else if (isCard) {
        details.push('Percentual cobrado: 0,00%');
    }
    if ((payment as any).operator_fee_percentage && Number((payment as any).operator_fee_percentage) > 0) {
        details.push(`Percentual da maquina: ${Number((payment as any).operator_fee_percentage).toFixed(2).replace('.', ',')}%`);
    } else if (isCard) {
        details.push('Percentual da maquina: 0,00%');
    }
    if (payment.method === 'a_prazo' && payment.due_date) {
        details.push(`Vencimento: ${new Date(`${payment.due_date}T00:00:00`).toLocaleDateString('pt-BR')}`);
    }
    if (payment.pix_status) details.push(`Status PIX: ${payment.pix_status}`);
    if (payment.pix_payment_id) details.push(`PIX interno: ${payment.pix_payment_id}`);
    if (payment.mercado_pago_payment_id) details.push(`Mercado Pago: ${payment.mercado_pago_payment_id}`);
    if (feeAmount > 0 || totalWithFee !== amount) {
        details.unshift(`Valor base: ${formatCurrencyCents(amount)}`);
    }

    return {
        label: getPaymentLabel(payment.method),
        labelWithInstallments: installments > 1 ? `${getPaymentLabel(payment.method)} - ${installments}x` : getPaymentLabel(payment.method),
        amount,
        totalWithFee,
        installments,
        installmentValue,
        feeAmount,
        operatorFeeAmount,
        spreadAmount,
        details
    };
}

export function getPaymentBaseAmount(payment: PaymentMethod, knownTotalWithFee?: number, knownFeeAmount?: number): number {
    const rawAmount = moneyToCents(payment.amount);
    const totalWithFee = knownTotalWithFee ?? moneyToCents((payment as any).total_with_fee ?? (payment as any).total_with_fee_cents ?? payment.amount ?? 0);
    const feeAmount = knownFeeAmount ?? moneyToCents((payment as any).fee_amount ?? (payment as any).fee_cents ?? 0);
    const inferredBaseAmount = totalWithFee > 0 && feeAmount > 0 && rawAmount === totalWithFee
        ? Math.max(0, totalWithFee - feeAmount)
        : rawAmount;

    return inferredBaseAmount > 0 ? inferredBaseAmount : totalWithFee;
}

export function getSaleCostTotal(sale: SaleWithItems, profitData?: SaleProfitData): number {
    if (profitData && Number.isFinite(Number(profitData.cost_total_cents))) {
        return moneyToCents(profitData.cost_total_cents);
    }
    if (Number(sale.cost_total) > 0) return moneyToCents(sale.cost_total);
    return (sale.items || []).reduce((sum, item) => {
        const presented = buildSaleItemPresentation(item, undefined, profitData);
        return sum + presented.itemCost;
    }, 0);
}

export function getSaleCollectedTotal(sale: SaleWithItems, profitData?: SaleProfitData): number {
    if (profitData && Number.isFinite(Number(profitData.total_cents))) {
        return moneyToCents(profitData.total_cents);
    }

    const paymentTotal = (sale.payment_methods || []).reduce((sum, payment) => {
        return sum + getPaymentBaseAmount(payment);
    }, 0);

    return paymentTotal > 0 ? paymentTotal : moneyToCents(sale.total || 0);
}

export function getSaleRealProfit(sale: SaleWithItems, profitData?: SaleProfitData): number {
    if (profitData && Number.isFinite(Number(profitData.profit_cents))) {
        return moneyToCents(profitData.profit_cents);
    }
    const payments = sale.payment_methods || [];
    const hasDetailedPaymentCosts = payments.some(payment => (
        Number((payment as any).operator_fee_amount || 0) > 0
        || Number((payment as any).operator_fee_cents || 0) > 0
    ));
    if (hasDetailedPaymentCosts) {
        const operatorFeeTotal = payments.reduce((sum, payment) => {
            return sum + moneyToCents((payment as any).operator_fee_amount ?? (payment as any).operator_fee_cents ?? 0);
        }, 0);
        return getSaleCollectedTotal(sale, profitData)
            - getSaleCostTotal(sale, profitData)
            - operatorFeeTotal
            - moneyToCents((sale as any).delivery_total || 0);
    }
    if (Number(sale.profit) !== 0) return moneyToCents(sale.profit);
    return getSaleCollectedTotal(sale, profitData) - getSaleCostTotal(sale, profitData);
}

export function buildSaleDiscountRows(sale: SaleWithItems) {
    const rows: Array<{ label: string; cents: number }> = [];
    const anySale = sale as any;
    const finalAdjustment = Number(sale.final_adjustment_discount || 0);
    const promotionalDiscount = Math.max(0, Number(sale.promotional_discount || 0) - finalAdjustment);
    const storeDeliveryDiscount = Number(sale.delivery_cost_store || 0);
    const itemDiscount = Math.max(0, Number(sale.discount_total || 0) - Number(sale.promotional_discount || 0) - storeDeliveryDiscount);

    if (itemDiscount) rows.push({ label: 'Desconto de itens/brindes', cents: itemDiscount });
    if (promotionalDiscount) rows.push({ label: anySale.coupon_code ? `Cupom ${anySale.coupon_code}` : 'Desconto promocional/cupom', cents: promotionalDiscount });
    if (finalAdjustment) rows.push({ label: 'Ajuste final', cents: finalAdjustment });
    if (storeDeliveryDiscount) rows.push({ label: 'Entrega subsidiada pela loja', cents: storeDeliveryDiscount });

    return rows;
}

export function buildSaleReceiptDynamicRows(sale: SaleWithItems, benefits?: { coinsEarnedThisSale?: number } | null) {
    const rows: Array<{ label: string; value: string }> = [];
    const discountRows = buildSaleDiscountRows(sale);

    if (sale.subtotal) rows.push({ label: 'Subtotal produtos', value: formatCurrencyCents(sale.subtotal) });
    if (discountRows.length > 0) {
        rows.push({ label: 'Descontos:', value: '' });
        discountRows.forEach((discount) => {
            rows.push({ label: `  ${discount.label}`, value: `-${formatCurrencyCents(discount.cents)}` });
        });
        rows.push({
            label: 'Total em descontos',
            value: `-${formatCurrencyCents(discountRows.reduce((sum, discount) => sum + discount.cents, 0))}`
        });
    }
    if (sale.delivery_type) rows.push({ label: 'Forma de entrega', value: getDeliveryLabel(sale.delivery_type) });
    if (sale.delivery_cost_customer) rows.push({ label: 'Entrega cobrada do cliente', value: formatCurrencyCents(sale.delivery_cost_customer) });
    if (sale.referral_code) rows.push({ label: 'Codigo de indicacao', value: sale.referral_code });
    if (benefits?.coinsEarnedThisSale) rows.push({ label: 'Moedas nesta venda', value: String(benefits.coinsEarnedThisSale) });

    return rows;
}

function getDeliveryLabel(type: string): string {
    const labels: Record<string, string> = {
        pickup: 'Retirada na Loja',
        store_pickup: 'Retirada na Loja',
        delivery: 'Entrega pela Loja',
        store_delivery: 'Entrega pela Loja',
        hybrid: 'Entrega Hibrida',
        hybrid_delivery: 'Entrega Hibrida',
    };
    return labels[type] || type;
}
