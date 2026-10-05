const test = require('node:test');
const assert = require('node:assert/strict');
const { createListingPriceHandlers } = require('../services/mercadoLivreListingPrice.cjs');
const parentId = 'ba0dd37d-5959-4d8b-9808-90024f619bcb';
const req = (extra = {}) => ({ params: { itemId: 'MLB123' }, query: { parentId }, body: {
  parentId, priceCents: 2685, expectedPriceCents: 2500, ...extra,
} });
function fixture({ variations = [], automation = null, promotion = false, linked = true, seller = '7', ignore = false, initial = 2500 } = {}) {
  let amount = initial;
  const writes = [];
  const handlers = createListingPriceHandlers({
    settings: async () => ({ user_id: '7' }),
    pool: { query: async () => [linked ? [{ id: 'child', sku: 'OIS063B' }] : []] },
    request: async (path, options) => {
      if (options?.method === 'PUT') { writes.push(JSON.parse(options.body)); if (!ignore) amount = 2685; return {}; }
      if (path.includes('/automation')) return automation;
      if (path.includes('/sale_price')) return { amount: promotion ? 20 : amount / 100, currency_id: 'BRL' };
      if (path.endsWith('/prices')) return { prices: [{ type: 'standard', amount: amount / 100, currency_id: 'BRL', conditions: { context_restrictions: [] } }] };
      return { id: 'MLB123', seller_id: seller, status: 'active', title: 'Suporte', variations,
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
  const { handlers, writes } = fixture({ variations: [{ id: 1 }, { id: 2 }] });
  await assert.rejects(() => handlers.update(req()), /todas as opções/);
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
test('promotion requires consent and ignored remote update is never reported as success', async () => {
  const promotional = fixture({ promotion: true });
  await assert.rejects(() => promotional.handlers.update(req()), /promoção/);
  assert.equal(promotional.writes.length, 0);
  await promotional.handlers.update(req({ confirmPromotionEffect: true }));
  const ignored = fixture({ ignore: true });
  await assert.rejects(() => ignored.handlers.update(req()), /não confirmou/);
});
test('invalid integer cents cannot reach the remote API', async () => {
  const { handlers, writes } = fixture();
  for (const priceCents of [0, -1, 10.5, '2685', null]) await assert.rejects(() => handlers.update(req({ priceCents })), /válido/);
  assert.equal(writes.length, 0);
});
