import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const tab = readFileSync('components/customer/profile/DeliveryWorkerTab.tsx', 'utf8');
const service = readFileSync('services/customerDeliveryService.ts', 'utf8');
const servers = ['vps_server.js', 'vps_server.cjs'].map((file) => [file, readFileSync(file, 'utf8')]);
const submitPaymentBlock = tab.slice(tab.indexOf('const submitPayment = async () => {'), tab.indexOf('const submitOffset = async () => {'));

assert.doesNotMatch(
  submitPaymentBlock,
  /amount\s*<=\s*0\s*\|\|\s*amount\s*>\s*payable/,
  'DeliveryWorkerTab must allow payments above the current delivery balance so the backend can create worker debt for the remainder'
);

assert.match(
  tab,
  /if\s*\(\s*amount\s*<=\s*0\s*\)\s*return\s+toast\.error\('Valor de pagamento invalido'\)/,
  'DeliveryWorkerTab must still reject non-positive payment values'
);

assert.match(
  service,
  /overpayment_debt_id\?:\s*string\s*\|\s*null/,
  'customer delivery payment service response must expose the created overpayment debt id'
);

for (const [file, server] of servers) {
  assert.match(
    server,
    /const\s+payableAmount\s*=\s*Math\.max\(0,\s*earned\s*-\s*settled\)/,
    `${file} delivery payment route must calculate the available delivery balance before settling`
  );

  assert.match(
    server,
    /const\s+settlementAmount\s*=\s*Math\.min\(amount,\s*payableAmount\)/,
    `${file} delivery payment route must cap the delivery settlement to the actual balance`
  );

  assert.match(
    server,
    /const\s+overpaymentAmount\s*=\s*Math\.max\(0,\s*amount\s*-\s*settlementAmount\)/,
    `${file} delivery payment route must calculate the overpayment remainder`
  );

  assert.match(
    server,
    /INSERT INTO customer_debts\s*\(id,\s*customer_id,\s*sale_id,\s*valor_total,\s*saldo_devedor,\s*descricao,\s*data_vencimento,\s*status\)[\s\S]*overpaymentAmount[\s\S]*overpaymentAmount[\s\S]*'pending'/,
    `${file} delivery payment route must create a customer debt for the overpayment remainder`
  );

  assert.match(
    server,
    /connection\.beginTransaction\(\)[\s\S]*customer_delivery_settlements[\s\S]*customer_debts[\s\S]*connection\.commit\(\)/,
    `${file} delivery settlement and overpayment debt creation must be atomic`
  );
}
console.log('delivery worker overpayment debt static checks passed');
