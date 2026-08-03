import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const purchaseTab = readFileSync('components/customer/profile/PurchaseHistoryTab.tsx', 'utf8');
const saleService = readFileSync('services/saleService.ts', 'utf8');
const customerList = readFileSync('pages/customers/CustomerListPage.tsx', 'utf8');
const welcomeMessage = readFileSync('services/welcomeMessageService.ts', 'utf8');
const authService = readFileSync('services/vpsAuthService.ts', 'utf8');

assert.match(
  saleService,
  /getCustomerPurchaseHistory[\s\S]*\/customer\/purchases/,
  'customer purchase history must use the bearer-scoped customer endpoint',
);
assert.match(
  purchaseTab,
  /getCustomerPurchaseHistory\(effectiveCustomer\.id\)/,
  'customer portal must load PDV sales and online orders through the customer endpoint',
);
assert.doesNotMatch(
  purchaseTab,
  /getSales\(\{ customer_id: effectiveCustomer\.id \}\)|getOrders\(\{ customer_id: effectiveCustomer\.id \}\)/,
  'customer portal must not call admin-only table-data loaders',
);

assert.match(welcomeMessage, /digits\.slice\(0, 6\)/, 'welcome message must show the six-digit temporary password');
assert.match(authService, /email\?: string/, 'admin login provisioning must support customers without email');
assert.match(
  customerList,
  /await vpsAuthService\.createCustomerLogin\([\s\S]*password[\s\S]*whatsappWindow\.location\.href = url/,
  'manual welcome message must provision the exact password before opening WhatsApp',
);

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const server = readFileSync(file, 'utf8');
  assert.match(
    server,
    /notifyCustomerRegisteredWhatsApp[\s\S]*temporaryPassword[\s\S]*slice\(0, 6\)[\s\S]*INSERT INTO customer_auth/,
    `${file} must persist the same six-digit password used by the admin registration message`,
  );
  assert.match(
    server,
    /if \(!customerId \|\| !cpfCnpj \|\| password\.length < 6\)/,
    `${file} must allow provisioning a CPF login when the customer has no email`,
  );
  assert.doesNotMatch(
    server,
    /senha_temporaria:[^\n]*slice\(0, 5\)/,
    `${file} must not send the obsolete five-digit temporary password`,
  );
}

console.log('customer portal purchases and login static checks passed');
