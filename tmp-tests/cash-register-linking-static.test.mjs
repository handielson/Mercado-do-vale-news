import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pixPage = read('pages/admin/financial/StandalonePixPage.tsx');
const debtPage = read('pages/admin/financial/CustomerCreditLedgerPage.tsx');
const deliveryTab = read('components/customer/profile/DeliveryWorkerTab.tsx');
const saleService = read('services/saleService.ts');

for (const [label, source] of [['Pix avulso', pixPage], ['Crediario', debtPage], ['Entregadores', deliveryTab]]) {
    assert.match(source, /useCashSession\(\)/, `${label} deve consultar o caixa atual`);
    assert.match(source, /cash_session_id:\s*cashSession\?\.id \|\| null/, `${label} deve enviar cash_session_id`);
}
assert.match(saleService, /refund_cash_session_id:\s*refundCashSessionId/, 'cancelamento/estorno deve apontar para o caixa atual');

for (const serverName of ['vps_server.js', 'vps_server.cjs']) {
    const server = read(serverName);
    assert.match(server, /eventType: updatedRow\.status === 'refunded' \? 'sale_refund' : 'sale_cancellation'/, `${serverName} deve auditar cancelamento e estorno`);
}

console.log('cash register linking static checks passed');
