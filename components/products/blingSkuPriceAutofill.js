function toPositiveCents(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return null;
    return Math.round(numberValue * 100);
}

export function getBlingSkuPriceAutofill(product) {
    if (!product) return {};

    const priceCost = toPositiveCents(
        product.precoCusto ?? product.precoCompra ?? product.preco_compra ?? product.preco_custo
    );
    const priceRetail = toPositiveCents(product.preco ?? product.precoVenda ?? product.preco_venda);

    return {
        ...(priceCost ? { price_cost: priceCost } : {}),
        ...(priceRetail ? { price_retail: priceRetail } : {}),
    };
}
