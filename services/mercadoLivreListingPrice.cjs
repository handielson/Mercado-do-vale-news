const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const cents = value => Math.round(Number(value) * 100);

function standardPrice(data) {
  const values = (data?.prices || []).filter(price => price.type === 'standard'
    && (!price.conditions?.context_restrictions?.length || price.conditions.context_restrictions.includes('channel_marketplace')));
  const amounts = [...new Set(values.map(price => cents(price.amount)))];
  if (amounts.length !== 1 || !Number.isFinite(amounts[0]) || amounts[0] <= 0
      || values.some(price => price.currency_id !== 'BRL')) throw fail('Não foi possível identificar um preço padrão único em reais para este anúncio.');
  return amounts[0];
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
      request(`/items/${itemId}/prices`),
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
      priceCents, salePriceCents: cents(salePrice.amount), currency: 'BRL',
      automation: Boolean(automation), promotion: salePrice.type === 'promotion' || Boolean(salePrice.metadata?.promotion_id) || cents(salePrice.amount) !== priceCents,
      variations: (item.variations || []).map(variation => ({ id: String(variation.id),
        label: (variation.attribute_combinations || []).map(attribute => attribute.value_name).join(' / ') })),
      affectedSkus: [...new Set(linked.map(product => product.sku))] };
  }

  async function update(req) {
    const input = req.body || {};
    if (!Number.isSafeInteger(input.priceCents) || input.priceCents <= 0
        || !Number.isSafeInteger(input.expectedPriceCents)) throw fail('Informe um preço válido em reais.', 400);
    const current = await read(req);
    if (!['active', 'paused'].includes(current.status)) throw fail('Este anúncio não está ativo ou pausado para edição.');
    if (current.automation) throw fail('Este anúncio usa automatização de preços no Mercado Livre. Gerencie a regra de preço na plataforma.');
    if (input.expectedPriceCents !== current.priceCents) throw fail('O preço mudou desde a consulta. Consulte novamente antes de atualizar.');
    if (current.variations.length > 1 && input.confirmAllVariations !== true) throw fail('Confirme a alteração do preço de todas as opções deste anúncio.');
    if (current.promotion && input.confirmPromotionEffect !== true) throw fail('Confirme que a alteração do preço padrão pode afetar a promoção do anúncio.');
    if (String((await settings()).user_id) !== current.sellerId) throw fail('A conta conectada mudou. Consulte o anúncio novamente.');
    const price = input.priceCents / 100;
    const payload = current.variations.length
      ? { variations: current.variations.map(variation => ({ id: Number(variation.id), price })) }
      : { price };
    await request(`/items/${current.itemId}`, { method: 'PUT', body: JSON.stringify(payload) });
    // A successful HTTP response can still ignore price under a remote pricing rule.
    const actual = standardPrice(await request(`/items/${current.itemId}/prices`));
    if (actual !== input.priceCents) throw fail('O Mercado Livre não confirmou o preço solicitado. Consulte o anúncio antes de tentar novamente.');
    return { ok: true, itemId: current.itemId, priceCents: actual, affectedSkus: current.affectedSkus };
  }
  return { read, update };
}
module.exports = { createListingPriceHandlers, standardPrice };
