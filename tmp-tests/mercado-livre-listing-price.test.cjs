const test = require('node:test');
const assert = require('node:assert/strict');
const { createListingPriceHandlers, standardPrice, hasQuantityPricing, isAutomationNotFound } = require('../services/mercadoLivreListingPrice.cjs');
const parentId = 'ba0dd37d-5959-4d8b-9808-90024f619bcb';
const req = (extra = {}) => ({ params: { itemId: 'MLB123' }, query: { parentId }, body: {
  parentId, priceCents: 2685, expectedPriceCents: 2500, confirm: true, ...extra,
} });
function fixture({ variations = [], automation = null, promotion = false, linked = true, seller = '7',
  ignore = false, initial = 2500, tags = [], channels = ['marketplace'],
  userProductId = null, familyName = '', quantityPricing = false, automationError = null } = {}) {
  let amount = initial;
  let currentVariations = variations;
  const writes = [];
  const handlers = createListingPriceHandlers({
    settings: async () => ({ user_id: '7' }),
    pool: { query: async () => [linked ? [{ id: 'child', sku: 'OIS063B' }] : []] },
    request: async (path, options) => {
      if (options?.method === 'PUT') {
        const body = JSON.parse(options.body);
        writes.push(body);
        if (!ignore) {
          if (Number.isFinite(body.price)) amount = Math.round(body.price * 100);
          if (Array.isArray(body.variations)) {
            currentVariations = body.variations;
            if (body.variations.length) amount = Math.round(Number(body.variations[0].price) * 100);
          }
        }
        return {};
      }
      if (path.includes('/automation')) {
        if (automationError) throw automationError;
        return automation;
      }
      if (path.includes('/sale_price')) return { amount: promotion ? 20 : amount / 100, currency_id: 'BRL' };
      if (path.endsWith('/prices')) return { prices: [{ type: 'standard', amount: amount / 100, currency_id: 'BRL',
        conditions: quantityPricing ? { min_purchase_unit: 2, context_restrictions: ['channel_marketplace', 'user_type_business'] }
          : { context_restrictions: [] } }] };
      return { id: 'MLB123', seller_id: seller, status: 'active', title: 'Suporte', variations: currentVariations,
        tags, channels, user_product_id: userProductId, family_name: familyName,
        category_id: 'MLB58500', listing_type_id: 'gold_special', shipping: { mode: 'me2', logistic_type: 'drop_off' } };
    },
  });
  return { handlers, writes };
}
test('updates only price and confirms persisted remote standard price', async () => {
  const { handlers, writes } = fixture();
  const current = await handlers.read(req());
  assert.equal(current.priceCents, 2500);
  assert.equal(current.categoryId, 'MLB58500');
  assert.equal(current.listingTypeId, 'gold_special');
  assert.equal(current.shippingMode, 'me2');
  assert.equal(current.logisticType, 'drop_off');
  assert.equal((await handlers.update(req())).priceCents, 2685);
  assert.deepEqual(writes, [{ price: 26.85 }]);
});
test('legacy variation update requires consent and preserves every variation ID', async () => {
  const { handlers, writes } = fixture({ variations: [{ id: 1, price: 25 }, { id: 2, price: 25 }] });
  await assert.rejects(() => handlers.update(req()), /todas as variações/);
  assert.equal(writes.length, 0);
  await handlers.update(req({ confirmAllVariations: true }));
  assert.deepEqual(writes[0], { variations: [{ id: 1, price: 26.85 }, { id: 2, price: 26.85 }] });
});
test('blocks automated prices, stale prices, foreign seller and unlinked family before writes', async () => {
  for (const config of [{ automation: { status: 'ACTIVE' } }, { initial: 3000 }, { seller: '8' }, { linked: false }]) {
    const { handlers, writes } = fixture(config);
    await assert.rejects(() => handlers.update(req()));
    assert.equal(writes.length, 0);
  }
});
test('promotion is always blocked and ignored remote update is never reported as success', async () => {
  const promotional = fixture({ promotion: true });
  await assert.rejects(() => promotional.handlers.update(req()), /promoção/);
  assert.equal(promotional.writes.length, 0);
  const ignored = fixture({ ignore: true });
  await assert.rejects(() => ignored.handlers.update(req()), /não confirmou/);
});
test('invalid integer cents cannot reach the remote API', async () => {
  const { handlers, writes } = fixture();
  for (const priceCents of [0, -1, 10.5, '2685', null]) await assert.rejects(() => handlers.update(req({ priceCents })), /válido/);
  assert.equal(writes.length, 0);
});

test('blocks automation tag, mixed channels, quantity pricing and unverifiable variations', async () => {
  for (const config of [
    { tags: ['dynamic_standard_price'] },
    { channels: ['marketplace', 'mshops'] },
    { quantityPricing: true },
    { variations: [{ id: 1 }] },
  ]) {
    const { handlers, writes } = fixture(config);
    await assert.rejects(() => handlers.update(req()));
    assert.equal(writes.length, 0);
  }
});

test('updates only the confirmed PxV User Product sale condition through its item ID', async () => {
  const { handlers, writes } = fixture({ userProductId: 'MLBU123', familyName: 'Produto em duas cores' });
  const current = await handlers.read(req());
  assert.equal(current.isUserProduct, true);
  assert.equal(current.userProductId, 'MLBU123');
  assert.equal(current.familyName, 'Produto em duas cores');
  await handlers.update(req());
  assert.deepEqual(writes, [{ price: 26.85 }]);
});

test('only treats the documented automation_not_found response as no automation', async () => {
  assert.equal(isAutomationNotFound({ remoteStatus: 404,
    message: 'Mercado Livre API 404: {"error":"automation_not_found"}' }), true);
  assert.equal(isAutomationNotFound({ remoteStatus: 404,
    message: 'Mercado Livre API 404: {"error":"item_not_found"}' }), false);
  const { handlers, writes } = fixture({ automationError: Object.assign(
    new Error('Mercado Livre API 404: {"error":"item_not_found"}'), { remoteStatus: 404 }) });
  await assert.rejects(() => handlers.update(req()), /item_not_found/);
  assert.equal(writes.length, 0);
});

test('already-current target is idempotent after a lost response', async () => {
  const { handlers, writes } = fixture({ initial: 2685 });
  const result = await handlers.update(req({ priceCents: 2685, expectedPriceCents: 2500 }));
  assert.deepEqual(result, { ok: true, itemId: 'MLB123', priceCents: 2685,
    affectedSkus: ['OIS063B'], alreadyCurrent: true });
  assert.equal(writes.length, 0);
});

test('does not report an item-level price as current when a variation differs', async () => {
  const { handlers, writes } = fixture({ initial: 2685,
    variations: [{ id: 1, price: 26.85 }, { id: 2, price: 25 }] });
  await assert.rejects(() => handlers.update(req({ priceCents: 2685, expectedPriceCents: 2685,
    confirmAllVariations: true })), /variações têm preços diferentes/);
  assert.equal(writes.length, 0);
});

test('standard price rejects multiple contexts and B2B context', () => {
  for (const restrictions of [['channel_marketplace', 'channel_mshops'], ['user_type_business']]) {
    assert.throws(() => standardPrice({ prices: [{ type: 'standard', amount: 25,
      currency_id: 'BRL', conditions: { context_restrictions: restrictions } }] }), /preço padrão único/);
  }
  const malformed = { prices: [{ type: 'standard', amount: 25, currency_id: 'BRL',
    conditions: { context_restrictions: 'channel_marketplace' } }] };
  assert.throws(() => standardPrice(malformed), /preço padrão único/);
  assert.equal(hasQuantityPricing(malformed), true);
  assert.throws(() => standardPrice({ prices: [{ type: 'standard', amount: 25,
    currency_id: 'BRL', conditions: ['channel_marketplace'] }] }), /preço padrão único/);
});
