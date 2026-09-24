import test from 'node:test';
import assert from 'node:assert/strict';
import { lastTwelveMonths, revenueView } from '../services/accountantRevenueView.ts';
import core from '../services/accountantPortalCore.cjs';

const report = {
  period:{from:'2025-10-01',to:'2026-09-24'},
  documents:[
    {model:'55',status:'authorized',issuedAt:'2026-09-10',totalCents:10000},
    {model:'65',status:'authorized',issuedAt:'2026-09-11',totalCents:5000},
    {model:'55',status:'cancelled',issuedAt:'2026-09-12',totalCents:9000},
  ],
  sales:[
    {fiscalState:'invoiced',operationalState:'completed',authorizedModels:['55','65'],occurredAt:'2026-08-10',totalCents:14000},
    {fiscalState:'no_invoice_confirmed',operationalState:'completed',occurredAt:'2026-09-10',totalCents:2000},
    {fiscalState:'reconciliation_pending',operationalState:'completed',occurredAt:'2026-09-10',totalCents:3000},
    {fiscalState:'cancelled',operationalState:'cancelled',occurredAt:'2026-09-10',totalCents:9000},
  ],
};
test('12 meses por calendário local, inclusive virada de ano e ano bissexto',()=>{
  assert.deepEqual(lastTwelveMonths(new Date('2026-09-24T12:00:00Z')),{from:'2025-10-01',to:'2026-09-24'});
  assert.deepEqual(lastTwelveMonths(new Date('2026-01-01T01:00:00Z')),{from:'2025-01-01',to:'2025-12-31'});
  assert.deepEqual(lastTwelveMonths(new Date('2024-02-29T12:00:00Z')),{from:'2023-03-01',to:'2024-02-29'});
});
test('fiscal soma documentos autorizados por emissão, sem duplicar vendas e sem cancelados',()=>{
  const view=revenueView(report,'fiscal');
  assert.equal(view.totalCents,15000);assert.equal(view.count,2);assert.equal(view.months.length,12);
  assert.equal(view.months.find(row=>row.month==='2026-08').totalCents,0);
  assert.equal(view.months.find(row=>row.month==='2026-09').totalCents,15000);
  assert.equal(revenueView(report,'nfe').totalCents,10000);
  assert.equal(revenueView(report,'nfce').totalCents,5000);
  assert.equal(revenueView(report,'nfce').sales.length,1);
});
test('todas usa vendas concluídas; sem nota e pendentes permanecem separados',()=>{
  assert.equal(revenueView(report,'all').totalCents,19000);
  assert.equal(revenueView(report,'no_invoice').totalCents,2000);
  assert.equal(revenueView(report,'pending').totalCents,3000);
  assert.equal(revenueView(report,'no_invoice').documents.length,0);
});
test('período livre no relatório mantém limite seguro da importação',()=>{
  assert.equal(core.validPeriod('2020-01-01','2026-09-24',Infinity),true);
  assert.equal(core.validPeriod('2020-01-01','2026-09-24'),false);
  assert.equal(core.validPeriod('2026-02-30','2026-09-24',Infinity),false);
  assert.equal(core.validPeriod('2026-09-25','2026-09-24',Infinity),false);
});
