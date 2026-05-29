import assert from 'node:assert/strict';
import { resolveShopeeAuthOrigin } from './shopeeAuthUrlService.js';

assert.equal(
  resolveShopeeAuthOrigin({
    host: 'localhost:5173',
    forwardedProto: 'http',
  }),
  'https://www.mercadodovale.com.br',
);

assert.equal(
  resolveShopeeAuthOrigin({
    host: 'www.mercadodovale.com.br',
    forwardedProto: 'https',
  }),
  'https://www.mercadodovale.com.br',
);

assert.equal(
  resolveShopeeAuthOrigin({
    host: 'mercadodovale.com.br',
    forwardedProto: 'https',
  }),
  'https://www.mercadodovale.com.br',
);

assert.equal(
  resolveShopeeAuthOrigin({
    host: 'legacy-platform.example',
    forwardedProto: 'https',
  }),
  'https://www.mercadodovale.com.br',
);

assert.equal(
  resolveShopeeAuthOrigin({
    host: 'anything.example.com',
    forwardedProto: 'https',
    envOrigin: 'https://painel.mercadodovale.com.br',
  }),
  'https://painel.mercadodovale.com.br',
);

console.log('shopeeAuthUrlService.test.mjs: ok');
