const assert = require('node:assert/strict');
const { registerShoppingListRoutes } = require('../core/shopping-list-routes.cjs');

const routes = [];
const fastify = {
  get(path, options) { routes.push({ method: 'GET', path, options }); },
  post(path, options) { routes.push({ method: 'POST', path, options }); },
};
const guard = () => {};
registerShoppingListRoutes({ fastify, pool: {}, preHandler: guard });

const expected = [
  'GET /shopping-list/items',
  'GET /shopping-list/items/:id',
  'POST /shopping-list/sync-daily-sales',
  'POST /shopping-list/daily-sales',
  'POST /shopping-list/items/registered',
  'POST /shopping-list/items/loose',
  'POST /shopping-list/items/:id/quotes',
  'POST /shopping-list/items/:id/purchase',
  'POST /shopping-list/items/:id/cancel',
  'GET /shopping-list/quotes',
  'GET /shopping-list/purchases',
];

assert.deepEqual(routes.map((route) => `${route.method} ${route.path}`), expected);
assert.ok(routes.every((route) => route.options.preHandler === guard));
console.log('shopping-list-routes.test.cjs: ok');
