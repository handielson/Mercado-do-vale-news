import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const profile = readFileSync('pages/customer/CustomerProfilePage.tsx', 'utf8');

assert.match(profile, /import \{ FinancialTab \}/, 'customer profile must import FinancialTab');
assert.match(profile, /import \{ DeliveryWorkerTab \}/, 'customer profile must import DeliveryWorkerTab');
assert.match(profile, /type TabType = [^;]*'finance'[^;]*'deliveries'/, 'customer profile tab type must include finance and deliveries');
assert.match(profile, /label: 'Financeiro'/, 'customer profile sidebar must include Financeiro tab');
assert.match(profile, /label: 'Entregas'/, 'customer profile sidebar must include Entregas tab');
assert.match(profile, /activeTab === 'finance' && <FinancialTab customer=\{effectiveCustomer\}/, 'finance tab must render FinancialTab');
assert.match(profile, /activeTab === 'deliveries' && <DeliveryWorkerTab customer=\{effectiveCustomer\}/, 'deliveries tab must render DeliveryWorkerTab');
assert.match(profile, /canManageDeliveries/, 'deliveries tab must keep permission guard for delivery-worker admin preview');

assert.equal(existsSync('components/customer/profile/FinancialTab.tsx'), true, 'FinancialTab component must exist');
assert.equal(existsSync('components/customer/profile/DeliveryWorkerTab.tsx'), true, 'DeliveryWorkerTab component must exist');
assert.equal(existsSync('services/customerDeliveryService.ts'), true, 'customer delivery service must exist');

const financial = readFileSync('components/customer/profile/FinancialTab.tsx', 'utf8');
assert.match(financial, /listCustomerDebts/, 'FinancialTab must load customer debts');
assert.match(financial, /createCustomerDebtMercadoPagoIntent/, 'FinancialTab must preserve Mercado Pago payment generation');

const delivery = readFileSync('components/customer/profile/DeliveryWorkerTab.tsx', 'utf8');
assert.match(delivery, /getCustomerDeliveryLedger/, 'DeliveryWorkerTab must load delivery ledger');
assert.match(delivery, /Entregas em aberto/, 'DeliveryWorkerTab must show open deliveries');

console.log('customer profile finance and deliveries regression passed');
