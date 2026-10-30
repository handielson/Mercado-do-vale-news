const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const cents = value => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const result = Math.round(amount * 100);
  return Number.isSafeInteger(result) ? result : null;
};
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function isAutomationNotFound(error) {
  if (error?.remoteStatus !== 404 || typeof error.message !== 'string') return false;
  const separator = error.message.indexOf(':');
  if (separator < 0) return false;
  try {
    const body = JSON.parse(error.message.slice(separator + 1).trim());
    return body?.error === 'automation_not_found';
  } catch {
    return false;
  }
}

function standardPrice(data) {
  if (!Array.isArray(data?.prices) || data.prices.length > 100) {
    throw fail('A resposta de preços está ausente ou fora do limite esperado.');
  }
  const values = data.prices.filter(price => {
    if (!price || price.type !== 'standard') return false;
    const conditions = price.conditions;
    if (conditions != null && (typeof conditions !== 'object' || Array.isArray(conditions))) return false;
    if (conditions?.min_purchase_unit != null) return false;
    const restrictions = conditions?.context_restrictions;
    if (restrictions != null && (!Array.isArray(restrictions) ||
        restrictions.some(value => typeof value !== 'string'))) return false;
    return restrictions == null || restrictions.length === 0 ||
      (restrictions.length === 1 && restrictions[0] === 'channel_marketplace');
  });
  const amounts = [...new Set(values.map(price => cents(price.amount)))];
  if (amounts.length !== 1 || !Number.isSafeInteger(amounts[0]) || amounts[0] <= 0 ||
      values.some(price => price.currency_id !== 'BRL')) {
    throw fail('Não foi possível identificar um preço padrão único em reais para este anúncio.');
  }
  return amounts[0];
}

function hasQuantityPricing(data) {
  return (data?.prices || []).some(price => {
    if (price?.type !== 'standard') return false;
    const conditions = price.conditions;
    if (conditions != null && (typeof conditions !== 'object' || Array.isArray(conditions))) return true;
    const restrictions = conditions?.context_restrictions;
    if (restrictions != null && (!Array.isArray(restrictions) ||
        restrictions.some(value => typeof value !== 'string'))) return true;
    return conditions?.min_purchase_unit != null || restrictions?.includes('user_type_business') === true;
  });
}

function createListingPriceHandlers({ pool, settings, request }) {
  const inFlight = new Set();

  async function read(req) {
    const itemId = String(req.params?.itemId || '').toUpperCase();
    const parentId = String(req.query?.parentId || req.body?.parentId || '');
    if (!/^MLB\d{1,30}$/.test(itemId) || !UUID.test(parentId)) {
      throw fail('Anúncio ou família inválidos.', 400);
    }
    const seller = String((await settings()).user_id || '');
    if (!/^\d{1,30}$/.test(seller)) throw fail('Conecte a conta do Mercado Livre.');
    const [linked] = await pool.query(`SELECT p.id,p.sku FROM mercado_livre_products ml
      JOIN products p ON p.id COLLATE utf8mb4_unicode_ci=ml.product_id COLLATE utf8mb4_unicode_ci
      WHERE ml.item_id=? AND (p.id=? OR p.parent_id=?)`, [itemId, parentId, parentId]);
    if (!linked.length) throw fail('Este anúncio não está vinculado à família selecionada.', 404);
    const item = await request(`/items/${itemId}?include_attributes=all`);
    if (String(item.seller_id) !== seller || String(item.id || '').toUpperCase() !== itemId) {
      throw fail('Anúncio não pertence à conta conectada.');
    }
    const [prices, salePrice, automation] = await Promise.all([
      request(`/items/${itemId}/prices`, { headers: { 'show-all-prices': 'true' } }),
      request(`/items/${itemId}/sale_price?context=channel_marketplace`),
      request(`/pricing-automation/items/${itemId}/automation`).catch(error => {
        if (isAutomationNotFound(error)) return null;
        throw error;
      }),
    ]);
    const priceCents = standardPrice(prices);
    const salePriceCents = cents(salePrice?.amount);
    if (salePrice?.currency_id !== 'BRL' || salePriceCents === null || salePriceCents <= 0) {
      throw fail('Não foi possível consultar o preço de venda atual em reais.');
    }
    if (item.variations != null && (!Array.isArray(item.variations) || item.variations.length > 100)) {
      throw fail('A lista de variações do anúncio é inválida.');
    }
    const variations = (item.variations || []).map(variation => {
      const id = String(variation?.id || '');
      const variationPriceCents = cents(variation?.price);
      if (!/^\d{1,30}$/.test(id) || !Number.isSafeInteger(Number(id)) ||
          variationPriceCents === null || variationPriceCents <= 0) {
        throw fail('Não foi possível conferir com segurança o ID e o preço de todas as variações.');
      }
      return { id, priceCents: variationPriceCents,
        label: (variation.attribute_combinations || []).map(attribute => attribute.value_name).join(' / ') };
    });
    const tags = Array.isArray(item.tags) ? item.tags : null;
    const channels = Array.isArray(item.channels) ? item.channels.map(String) : null;
    const userProductId = String(item.user_product_id ||
      (item.variations || []).find(variation => variation?.user_product_id)?.user_product_id || '');
    const automated = Boolean(automation) || Boolean(tags?.includes('dynamic_standard_price'));
    return { itemId, parentId, sellerId: seller, title: String(item.title || '').slice(0, 500),
      status: String(item.status || ''), categoryId: String(item.category_id || ''),
      listingTypeId: String(item.listing_type_id || ''), shippingMode: String(item.shipping?.mode || ''),
      logisticType: String(item.shipping?.logistic_type || ''), channels, tags,
      isUserProduct: Boolean(userProductId), userProductId,
      familyName: String(item.family_name || '').slice(0, 500), priceCents, salePriceCents, currency: 'BRL',
      quantityPricing: hasQuantityPricing(prices), automated,
      automationStatus: automation?.status ? String(automation.status) : '',
      automationKnown: tags !== null || automation !== null,
      promotion: salePrice.type === 'promotion' || Boolean(salePrice.metadata?.promotion_id) || salePriceCents !== priceCents,
      variations, affectedSkus: [...new Set(linked.map(product => String(product.sku || '').slice(0, 120)))],
    };
  }

  async function update(req) {
    const itemId = String(req.params?.itemId || '').toUpperCase();
    const body = req.body || {};
    if (!/^MLB\d{1,30}$/.test(itemId)) throw fail('Anúncio inválido.', 400);
    if (inFlight.has(itemId)) throw fail('Já existe uma atualização de preço em andamento para este anúncio.', 409);
    inFlight.add(itemId);
    try {
      if (body.confirm !== true) throw fail('Confirme explicitamente o envio do preço ERP.', 400);
      if (!Number.isSafeInteger(body.priceCents) || body.priceCents <= 0 || body.priceCents > 10 ** 12) {
        throw fail('Preço ERP inválido.', 400);
      }
      if (!Number.isSafeInteger(body.expectedPriceCents) || body.expectedPriceCents <= 0 ||
          body.expectedPriceCents > 10 ** 12) {
        throw fail('Preço remoto esperado inválido; consulte novamente.', 400);
      }
      if (body.confirmAllVariations !== undefined && typeof body.confirmAllVariations !== 'boolean') {
        throw fail('A confirmação para todas as variações é inválida.', 400);
      }

      const current = await read(req);
      if (!['active', 'paused'].includes(current.status)) {
        throw fail('Somente anúncio ativo ou pausado pode receber preço.', 409);
      }
      if (current.automated || !current.automationKnown) {
        throw fail('Preço protegido: a automação de preço está ativa ou não pôde ser excluída.', 409);
      }
      if (current.promotion) throw fail('Preço protegido: há uma promoção vigente no anúncio.', 409);
      if (current.quantityPricing) throw fail('Preço protegido: o anúncio tem preço por quantidade/B2B.', 409);
      if (!Array.isArray(current.channels) || current.channels.length !== 1 || current.channels[0] !== 'marketplace') {
        throw fail('A atualização por PUT /items exige anúncio somente no canal marketplace.', 409);
      }

      if (current.priceCents === body.priceCents &&
          current.variations.every(row => row.priceCents === body.priceCents)) {
        return { ok: true, itemId, priceCents: current.priceCents,
          affectedSkus: current.affectedSkus, alreadyCurrent: true };
      }
      if (current.priceCents !== body.expectedPriceCents) {
        throw fail('O preço remoto mudou desde a conferência. Consulte novamente.', 409);
      }

      let payload;
      if (current.variations.length) {
        if (body.confirmAllVariations !== true) {
          throw fail('Confirme que o mesmo preço será aplicado a todas as variações do anúncio.', 400);
        }
        if (current.variations.some(row => row.priceCents !== current.priceCents)) {
          throw fail('As variações têm preços diferentes; atualize-as individualmente após revisão.', 409);
        }
        payload = { variations: current.variations.map(row => ({ id: Number(row.id), price: body.priceCents / 100 })) };
      } else {
        payload = { price: body.priceCents / 100 };
      }

      try {
        await request(`/items/${itemId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } catch (error) {
        if (Number.isInteger(error.remoteStatus) && error.remoteStatus >= 400 && error.remoteStatus < 500 && error.remoteStatus !== 429) {
          throw fail('O Mercado Livre recusou a atualização de preço. Confira a publicação antes de tentar novamente.', 409);
        }
        throw fail('Resultado da atualização incerto. Consulte o preço remoto antes de repetir.', 502);
      }

      let verified;
      try { verified = await read(req); }
      catch { throw fail('Resultado da atualização incerto. Consulte o preço remoto antes de repetir.', 502); }
      if (verified.priceCents !== body.priceCents ||
          verified.variations.some(row => row.priceCents !== body.priceCents)) {
        throw fail('O Mercado Livre não confirmou o novo preço. Consulte o anúncio antes de repetir.', 502);
      }
      return { ok: true, itemId, priceCents: body.priceCents,
        affectedSkus: current.affectedSkus, alreadyCurrent: false };
    } finally {
      inFlight.delete(itemId);
    }
  }

  return { read, update };
}

module.exports = { createListingPriceHandlers, standardPrice, hasQuantityPricing, isAutomationNotFound };
