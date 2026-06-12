import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readProjectFile(path) {
  try {
    return readFileSync(new URL(path, import.meta.url), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

const vps = readProjectFile('../vps_server.js');
const pdv = readProjectFile('../pages/pdv/PDVPage.tsx');
const profile = readProjectFile('../pages/customer/CustomerProfilePage.tsx');
const adminCustomerDetails = readProjectFile('../pages/customers/CustomerDetailsPage.tsx');
const deliveryPage = readProjectFile('../pages/delivery/DeliveryOperationPage.tsx');
const deliveryService = readProjectFile('../services/customerDeliveryService.ts');
const customerTypes = readProjectFile('../types/customer.ts');
const customerService = readProjectFile('../services/customers.ts');
const customerForm = readProjectFile('../components/customers/CustomerBasicInfoSection.tsx');
const deliveryTab = readProjectFile('../components/customer/profile/DeliveryWorkerTab.tsx');

assert.match(vps, /CREATE TABLE IF NOT EXISTS customer_delivery_profiles/, 'VPS must create customer delivery profile table');
assert.match(vps, /CREATE TABLE IF NOT EXISTS customer_delivery_jobs/, 'VPS must create delivery operation table');
assert.match(vps, /CREATE TABLE IF NOT EXISTS customer_delivery_proofs/, 'VPS must create delivery proof photo table');
assert.match(vps, /buyer_customer_id/, 'Delivery proof must be linked to the buyer customer');
assert.match(vps, /delivery_person_customer_id/, 'Delivery proof must be linked to the delivery customer');
assert.match(vps, /CREATE TABLE IF NOT EXISTS customer_delivery_ledger/, 'VPS must create delivery ledger table');
assert.match(vps, /CREATE TABLE IF NOT EXISTS customer_delivery_settlements/, 'VPS must create delivery settlement table');
assert.match(vps, /addColumnIfMissing\('customers', 'is_delivery_worker'/, 'VPS must add explicit delivery worker flag to customers');
assert.match(vps, /admin_completion_reason/, 'VPS must store admin completion reason for delivery jobs');
assert.match(vps, /completed_by_admin_at/, 'VPS must store admin completion timestamp for delivery jobs');
assert.match(vps, /fastify\.get\('\/delivery\/jobs\/:token'/, 'VPS must expose a tokenized delivery operation');
assert.match(vps, /fastify\.post\('\/delivery\/jobs\/:token\/pix-intent'/, 'VPS must generate Pix for delivery operation');
assert.match(vps, /metadata\.flow === 'delivery_job'|flow: 'delivery_job'/, 'Mercado Pago webhook must support delivery job payments');
assert.match(vps, /fastify\.post\('\/delivery\/jobs\/:token\/payment-status'/, 'VPS must expose delivery payment status refresh endpoint');
assert.match(vps, /fastify\.post\('\/delivery\/jobs\/:token\/proof'/, 'VPS must accept delivery proof photo');
assert.match(vps, /fastify\.post\('\/delivery\/jobs\/:token\/complete'/, 'VPS must complete successful delivery');
assert.match(vps, /fastify\.post\('\/delivery\/jobs\/:token\/admin-complete'/, 'VPS must expose admin forced delivery completion endpoint');
assert.match(vps, /fastify\.get\('\/customers\/:customerId\/delivery-ledger'/, 'VPS must list customer delivery ledger');
assert.match(vps, /fastify\.get\('\/customers\/:customerId\/delivery-jobs'/, 'VPS must list delivery jobs for admin review');
assert.match(vps, /fastify\.post\('\/customers\/:customerId\/delivery-payments'/, 'VPS must register delivery payments');
assert.match(vps, /fastify\.post\('\/customers\/:customerId\/delivery-offsets'/, 'VPS must offset delivery balance against debts');
assert.match(vps, /createCustomerDeliveryJobForSale/, 'Sale creation must create pending delivery jobs');
assert.match(vps, /completeCustomerDeliveryJob/, 'Delivery completion must create ledger entries');
assert.match(pdv, /delivery_person_customer_id/, 'PDV must send linked delivery customer id');
assert.match(pdv, /is_delivery_worker: true/, 'PDV must only list customers explicitly enabled as delivery workers');
assert.match(customerTypes, /is_delivery_worker\?: boolean/, 'Customer types must expose delivery worker flag');
assert.match(customerService, /is_delivery_worker: deliveryWorker === true/, 'Customer service must normalize delivery worker flag');
assert.match(customerService, /filters\?\.is_delivery_worker/, 'Customer service must filter by delivery worker flag');
assert.match(customerForm, /Este cliente tambem faz entregas/, 'Customer form must expose delivery worker toggle');
assert.match(profile, /DeliveryWorkerTab/, 'Customer profile must render delivery worker tab');
assert.match(profile, /tabFromQuery === 'deliveries'/, 'Customer profile must support ?tab=deliveries');
assert.match(profile, /label: 'Entregas'/, 'Customer profile must show Entregas tab');
assert.match(profile, /canViewDeliveries|canManageDeliveries/, 'Customer profile must gate delivery tab by delivery worker flag');
assert.match(profile, /mode="viewer"|<DeliveryWorkerTab customer={effectiveCustomer}/, 'Customer profile delivery tab must be view-only');
assert.match(adminCustomerDetails, /mode="admin"/, 'Admin customer details must render editable delivery tab only in admin view');
assert.match(deliveryService, /getCustomerDeliveryLedger/, 'frontend must load delivery ledger');
assert.match(deliveryService, /getCustomerDeliveryJobs/, 'frontend must load delivery jobs for admin review');
assert.match(deliveryService, /adminCompleteDeliveryJob/, 'frontend must support admin forced delivery completion');
assert.match(deliveryService, /registerCustomerDeliveryPayment/, 'frontend must register delivery payments');
assert.match(deliveryService, /offsetCustomerDeliveryBalance/, 'frontend must offset balance against debts');
assert.match(deliveryTab, /Motivo da baixa administrativa/, 'Admin delivery tab must require a reason before forced completion');
assert.match(deliveryTab, /Baixar como entregue/, 'Admin delivery tab must expose forced completion action');
assert.match(deliveryPage, /compressImage/, 'Delivery operation page must compress proof photos before upload');
assert.match(deliveryPage, /buildDeliveryProofFileName/, 'Delivery operation page must rename proof photo with order number before upload');
assert.match(deliveryPage, /Consultar pagamento/, 'Delivery operation page must expose manual payment status refresh');
assert.match(deliveryPage, /setInterval\([^)]*10000|10_000/, 'Delivery operation page must poll pending payment every 10 seconds');
assert.match(deliveryPage, /Abrir rota/, 'Delivery operation page must show a route hyperlink');
assert.match(deliveryPage, /Falar no WhatsApp/, 'Delivery operation page must let delivery person contact buyer by WhatsApp');
assert.match(deliveryPage, /getDeliveryErrorMessage/, 'Delivery operation page must translate operational errors for the delivery person');
assert.match(deliveryPage, /errorMessage/, 'Delivery operation page must render detailed error feedback');
assert.match(deliveryPage, /Ligar para cliente/, 'Delivery operation page must let delivery person call buyer');
assert.match(deliveryPage, /\/synology\/upload\?folder=imagens/, 'Delivery proof upload must use Synology image storage');
assert.match(deliveryPage, /Entrega realizada com sucesso/, 'Delivery operation page must expose the completion action');

console.log('customer delivery ledger static checks passed');
