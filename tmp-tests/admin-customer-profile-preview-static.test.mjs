import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = readFileSync('routes/index.tsx', 'utf8');
const details = readFileSync('pages/customers/CustomerDetailsPage.tsx', 'utf8');
const profile = readFileSync('pages/customer/CustomerProfilePage.tsx', 'utf8');
const history = readFileSync('components/customer/profile/PurchaseHistoryTab.tsx', 'utf8');

assert.match(
  routes,
  /AdminCustomerProfilePreviewPage/,
  'router must lazy-load the admin customer profile preview page',
);

assert.match(
  routes,
  /path:\s*["']\/admin\/customers\/:id\/preview["']/,
  'router must expose an admin-only customer preview route',
);

assert.match(
  details,
  /\/admin\/customers\/\$\{customer\.id\}\/preview/,
  'customer details page must expose a preview-as-customer shortcut',
);

assert.match(
  profile,
  /customerOverride\?:\s*Customer/,
  'customer profile must accept an admin-provided customer override',
);

assert.match(
  profile,
  /isAdminPreview\?:\s*boolean/,
  'customer profile must show an explicit admin preview mode',
);

assert.match(
  profile,
  /PurchaseHistoryTab\s+customerOverride=\{effectiveCustomer\}/,
  'customer profile must pass the selected preview customer into the history tab',
);

assert.match(
  history,
  /customerOverride\?:\s*Customer/,
  'purchase history tab must accept the selected preview customer',
);

assert.match(
  history,
  /const\s+effectiveCustomer\s*=\s*customerOverride\s*\|\|\s*customer/,
  'purchase history tab must load orders for the override customer during admin preview',
);

console.log('admin customer profile preview static checks passed');
