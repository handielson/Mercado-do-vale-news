import assert from 'node:assert/strict';
import { buildBlingReconcilePlan } from '../api/_lib/bling-reconcile-core.js';

const plan = buildBlingReconcilePlan({
  localProducts: [
    {
      id: 'local-1',
      sku: 'KD-901',
      name: 'Fone KD-901 Antigo',
      stock_quantity: 7,
      bling_id: 16304328031,
    },
    {
      id: 'local-2',
      sku: 'MSR-713',
      name: 'Cooler MSR-713',
      stock_quantity: 1,
      bling_id: 16369753060,
    },
    {
      id: 'local-3',
      sku: 'SEM-BLING',
      name: 'Produto Local',
      stock_quantity: 5,
      bling_id: null,
    },
  ],
  remoteProducts: [
    {
      id: 16304328031,
      codigo: 'KD-901',
      nome: 'Fone de Ouvido KD-901 Novo',
    },
    {
      id: 16369753060,
      codigo: 'MSR-713',
      nome: 'Cooler MSR-713',
    },
    {
      id: 999999,
      codigo: 'IGNORAR',
      nome: 'Produto Sem Vínculo',
    },
  ],
  remoteStocks: [
    {
      produto: { id: 16304328031 },
      saldoFisicoTotal: 8,
    },
    {
      produto: { id: 16369753060 },
      saldoFisicoTotal: 0,
    },
    {
      produto: { id: 999999 },
      saldoFisicoTotal: 99,
    },
  ],
});

assert.deepEqual(
  plan.stockChanges.map(change => ({
    productId: change.productId,
    sku: change.sku,
    blingId: change.blingId,
    nextStock: change.nextStock,
  })),
  [
    {
      productId: 'local-1',
      sku: 'KD-901',
      blingId: 16304328031,
      nextStock: 8,
    },
    {
      productId: 'local-2',
      sku: 'MSR-713',
      blingId: 16369753060,
      nextStock: 0,
    },
  ],
  'the reconcile plan must include every mapped product whose stock diverged from Bling',
);

assert.deepEqual(
  plan.nameChanges.map(change => ({
    productId: change.productId,
    sku: change.sku,
    blingId: change.blingId,
    nextName: change.nextName,
  })),
  [
    {
      productId: 'local-1',
      sku: 'KD-901',
      blingId: 16304328031,
      nextName: 'Fone de Ouvido KD-901 Novo',
    },
  ],
  'the reconcile plan must update names only for mapped products whose title changed in Bling',
);

assert.equal(plan.totals.localMappedProducts, 2, 'only local products linked by bling_id should be considered mapped');
assert.equal(plan.totals.remoteProducts, 3, 'remote product totals should stay observable for diagnostics');
assert.equal(plan.totals.remoteStocks, 3, 'remote stock totals should stay observable for diagnostics');

console.log('bling reconcile core ok');
