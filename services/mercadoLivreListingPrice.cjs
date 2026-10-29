const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const cents = value => Math.round(Number(value) * 100);

function standardPrice(data) {
  const values = (data?.prices || []).filter(price => price.type === 'standard'
    && price.conditions?.min_purchase_unit == null
    && !price.conditions?.context_restrictions?.includes('user_type_business')
    && (!price.conditions?.context_restrictions?.length || price.conditions.context_restrictions.includes('channel_marketplace')));
  const amounts = [...new Set(values.map(price => cents(price.amount)))];
  if (amounts.length !== 1 || !Number.isFinite(amounts[0]) || amounts[0] <= 0
      || values.some(price => price.currency_id !== 'BRL')) throw fail('Não foi possível identificar um preço padrão único em reais para este anúncio.');
  return amounts[0];
}

function hasQuantityPricing(data) {
  return (data?.prices || []).some(price => price.type === 'standard'
    && ((Number.isSafeInteger(Number(price.conditions?.min_purchase_unit))
      && Number(price.conditions?.min_purchase_unit) > 0)
      || price.conditions?.context_restrictions?.includes('user_type_business')));
}

function createListingPriceHandlers({ pool, settings, request }) {
  async function read(req) {
    const itemId = String(req.params?.itemId || '').toUpperCase();
    const parentId = String(req.query?.parentId || req.body?.parentId || '');
    if (!/^MLB\d+$/.test(itemId) || !/^[0-9a-f-]{36}$/i.test(parentId)) throw fail('Anúncio ou família inválidos.', 400);
    const seller = String((await settings()).user_id || '');
    if (!/^\d+$/.test(seller)) throw fail('Conecte a conta do Mercado Livre.');
    const [linked] = await pool.query(`SELECT p.id,p.sku FROM mercado_livre_products ml
      JOIN products p ON p.id COLLATE utf8mb4_unicode_ci=ml.product_id COLLATE utf8mb4_unicode_ci
      WHERE ml.item_id=? AND (p.id=? OR p.parent_id=?)`, [itemId, parentId, parentId]);
    if (!linked.length) throw fail('Este anúncio não está vinculado à família selecionada.', 404);
    const item = await request(`/items/${itemId}?include_attributes=all`);
    if (String(item.seller_id) !== seller || item.id !== itemId) throw fail('Anúncio não pertence à conta conectada.');
    const [prices, salePrice, automation] = await Promise.all([
      request(`/items/${itemId}/prices`, { headers: { 'show-all-prices': 'true' } }),
      request(`/items/${itemId}/sale_price?context=channel_marketplace`),
      request(`/pricing-automation/items/${itemId}/automation`).catch(error => {
        if (error.remoteStatus === 404) return null;
        throw error;
      }),
    ]);
    const priceCents = standardPrice(prices);
    if (salePrice.currency_id !== 'BRL' || !Number.isFinite(cents(salePrice.amount)) || cents(salePrice.amount) <= 0)
      throw fail('Não foi possível consultar o preço de venda atual em reais.');
    if ((item.variations || []).some(variation => !Number.isSafeInteger(Number(variation.id))))
      throw fail('Não foi possível preservar com segurança os identificadores das variações.');
    return { itemId, parentId, sellerId: seller, title: item.title, status: item.status,
      categoryId: item.category_id, listingTypeId: item.listing_type_id,
      shippingMode: item.shipping?.mode, logisticType: item.shipping?.logistic_type,
      priceCents, salePriceCents: cents(salePrice.amount), currency: 'BRL', quantityPricing: hasQuantityPricing(prices),
      automation: Boolean(automation), promotion: salePrice.type === 'promotion' || Boolean(salePrice.metadata?.promotion_id) || cents(salePrice.amount) !== priceCents,
      variations: (item.variations || []).map(variation => ({ id: String(variation.id),
        label: (variation.attribute_combinations || []).map(attribute => attribute.value_name).join(' / ') })),
      affectedSkus: [...new Set(linked.map(product => product.sku))] };
  }

  async function update(req) {
    void req;
    throw fail('A sincronização de preço está bloqueada: o endpoint oficial para editar preço padrão ainda não está disponível, e PUT de preço em /items pode ser rejeitado ou ignorado. Nenhuma alteração foi enviada.', 409);
  }
  return { read, update };
}
module.exports = { createListingPriceHandlers, standardPrice, hasQuantityPricing };
