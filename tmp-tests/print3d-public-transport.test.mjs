import assert from 'node:assert/strict';

const transport = await import('../services/vpsTransport.js');

for (const [method, path] of [
  ['GET', '/storefronts/loja_3d/products?limit=2000'],
  ['GET', '/storefronts/loja_3d/settings'],
  ['POST', '/storefronts/loja_3d/quote'],
  ['POST', '/storefronts/loja_3d/shipping/quote'],
  ['POST', '/storefronts/loja_3d/deadline-requests'],
]) {
  assert.equal(transport.isPublicVpsPath(path, method), true, `${method} ${path} must use the public API directly`);
  assert.match(transport.buildVpsUrl(path, {
    env: { MODE: 'production', VITE_ALLOW_DIRECT_PUBLIC_VPS: '1' },
    runtimeHostname: 'www.3dmv.com.br',
    method,
  }), /^https:\/\/api\.xiaomipetrolina\.com\.br\//);
}

assert.equal(transport.isPublicVpsPath('/products/batch', 'POST'), false);
assert.equal(transport.isPublicVpsPath('/admin/print3d/production', 'GET'), false);

console.log('3DMV public transport checks passed');
