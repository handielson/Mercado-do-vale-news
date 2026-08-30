import assert from 'node:assert/strict';
import {
  getStatusProductImage,
  buildStatusPayload,
} from '../services/whatsappStatusCampaignHelper.js';

console.log('Testing WhatsApp Status Background Resolution (With Price vs Without Price)...');

// Scenario 1: Product has both marketing_background_url and marketing_background_no_price_url
const productWithBoth = {
  id: 'prod-1',
  name: 'iPhone 15 128GB',
  price_retail: 4500,
  image_url: 'https://cdn.example.com/gallery-white-bg.png',
  marketing_background_url: 'https://cdn.example.com/story-with-price.png',
  marketing_background_no_price_url: 'https://cdn.example.com/story-no-price.png',
  images: ['https://cdn.example.com/gallery-white-bg.png'],
};

// When includePrice = true: should select marketing_background_url (story with price)
const imgWithPrice = getStatusProductImage(productWithBoth, true);
assert.equal(imgWithPrice, 'https://cdn.example.com/story-with-price.png', 'Should use story with price');

// When includePrice = false: should select marketing_background_no_price_url (story without price)
const imgNoPrice = getStatusProductImage(productWithBoth, false);
assert.equal(imgNoPrice, 'https://cdn.example.com/story-no-price.png', 'Should use story without price');

// Scenario 2: Product only has marketing_background_url (legacy, not yet generated no-price)
const productLegacy = {
  id: 'prod-2',
  name: 'iPhone 14 128GB',
  price_retail: 3500,
  image_url: 'https://cdn.example.com/gallery-white-bg.png',
  marketing_background_url: 'https://cdn.example.com/story-with-price.png',
  images: ['https://cdn.example.com/gallery-white-bg.png'],
};

// When includePrice = false and no marketing_background_no_price_url: fallback to gallery image
const imgLegacyNoPrice = getStatusProductImage(productLegacy, false);
assert.equal(imgLegacyNoPrice, 'https://cdn.example.com/gallery-white-bg.png', 'Should fallback to gallery image when no-price artwork is absent');

// Scenario 3: buildStatusPayload with and without price
const payloadWithPrice = buildStatusPayload({ product: productWithBoth, caption: 'Oferta', includePrice: true });
assert.equal(payloadWithPrice.content, 'https://cdn.example.com/story-with-price.png');

const payloadNoPrice = buildStatusPayload({ product: productWithBoth, caption: 'Oferta', includePrice: false });
assert.equal(payloadNoPrice.content, 'https://cdn.example.com/story-no-price.png');

console.log('✅ All WhatsApp Status background resolution tests passed!');
