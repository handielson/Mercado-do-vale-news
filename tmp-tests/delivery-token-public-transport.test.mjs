import assert from 'node:assert/strict';

const transport = await import('../services/vpsTransport.js');

const publicCases = [
  ['GET', '/delivery/jobs/token-123'],
  ['HEAD', '/delivery/jobs/token-123'],
  ['GET', '/delivery/tracking/tracking-token-123'],
  ['POST', '/delivery/jobs/token-123/pix-intent'],
  ['POST', '/delivery/jobs/token-123/payment-status'],
  ['POST', '/delivery/jobs/token-123/start-route'],
  ['POST', '/delivery/jobs/token-123/proof'],
  ['POST', '/delivery/jobs/token-123/complete'],
];

for (const [method, path] of publicCases) {
  assert.equal(transport.isPublicVpsPath(path, method), true, `${method} ${path} must use the token-scoped public transport`);
}

const protectedCases = [
  ['GET', '/delivery/jobs'],
  ['GET', '/delivery/jobs/from-sale/sale-123'],
  ['GET', '/delivery/jobs/token-123/logs'],
  ['POST', '/delivery/jobs/token-123/admin-complete'],
  ['POST', '/delivery/jobs/token-123/unknown'],
];

for (const [method, path] of protectedCases) {
  assert.equal(transport.isPublicVpsPath(path, method), false, `${method} ${path} must remain protected`);
}

const paymentStatusUrl = transport.buildVpsUrl('/delivery/jobs/token-123/payment-status', {
  env: { MODE: 'production' },
  runtimeHostname: 'mercadodovale.com.br',
  method: 'POST',
});

assert.equal(
  paymentStatusUrl,
  'https://api.xiaomipetrolina.com.br/delivery/jobs/token-123/payment-status',
  'delivery token actions must bypass the admin-authenticated site proxy',
);

console.log('Delivery token public transport checks passed');
