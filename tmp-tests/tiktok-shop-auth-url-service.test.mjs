import assert from 'node:assert/strict';
import { buildTikTokShopSellerAuthUrl, normalizeTikTokShopMarket } from '../services/tiktokShopAuthUrlService.js';

assert.equal(normalizeTikTokShopMarket('us'), 'US');
assert.equal(normalizeTikTokShopMarket('br'), 'ROW');
assert.equal(normalizeTikTokShopMarket(''), 'ROW');

assert.equal(
  buildTikTokShopSellerAuthUrl({ serviceId: 'svc_123', state: 'abc', market: 'US' }),
  'https://services.us.tiktokshop.com/open/authorize?service_id=svc_123&state=abc',
);

assert.equal(
  buildTikTokShopSellerAuthUrl({ serviceId: 'svc_123', market: 'ROW' }),
  'https://services.tiktokshop.com/open/authorize?service_id=svc_123',
);

assert.equal(buildTikTokShopSellerAuthUrl({ serviceId: '' }), '');

console.log('TikTok Shop auth URL service checks ok');
