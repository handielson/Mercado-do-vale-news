import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deliverySection = readFileSync('components/pdv/DeliverySection.tsx', 'utf8');
const pdvPage = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');

assert.match(
  deliverySection,
  /grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4/,
  'Delivery options must render as three responsive mini cards.',
);

assert.match(
  deliverySection,
  /data-pdv-delivery-card="store_pickup"[\s\S]*data-pdv-delivery-card="store_delivery"[\s\S]*data-pdv-delivery-card="hybrid_delivery"/,
  'Delivery mini cards must expose the three delivery modes.',
);

assert.match(
  deliverySection,
  /deliveryCardClass\('store_delivery', 'border-emerald-300 bg-emerald-50'\)/,
  'Selected store delivery card must have a compact selected visual state.',
);

assert.match(
  pdvPage,
  /data-pdv-commercial-options[\s\S]*grid grid-cols-1 xl:grid-cols-2 gap-4/,
  'Coupon and referral must be grouped side by side as commercial option mini cards.',
);

assert.match(
  pdvPage,
  /data-pdv-option-card="coupon"[\s\S]*data-pdv-option-card="referral"/,
  'Coupon and referral cards must be identifiable and grouped together.',
);

console.log('ok - PDV uses compact delivery, coupon and referral option cards');
