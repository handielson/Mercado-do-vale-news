import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPrint3dRecipeDraft } from '../utils/print3dRecipeDraft.mjs';

const valid = () => ({
  productId: '11111111-1111-4111-8111-111111111111', productName: 'Chaveiro azul',
  sku: 'CHAVEIRO-01', revision: 'r1', materialGrams: 20, printMinutes: 120, pieces: 2, laborMinutes: 10,
  filaments: [{ id: 'pla-azul', name: 'PLA', color: 'Azul', consumedGrams: 20, spoolGrams: 1000, spoolCostCents: 9000 }],
  supplies: [{ id: 'argola', name: 'Argola', quantity: 2, unitCostCents: 30 }],
  cost: { filamentCents: 180, energyCents: 40, machineCents: 100, laborCents: 50, suppliesCents: 60, batchCents: 430, unitCents: 215 },
  rates: { printerWatts: 200, energyCentsPerKwh: 100, machineCentsPerHour: 50, laborCentsPerHour: 300 },
});

test('exporta rascunho com pasta por SKU/revisão e custos históricos em centavos', () => {
  const draft = buildPrint3dRecipeDraft(valid());
  assert.equal(draft.suggestedPrivateFolder, 'producao-3d/produtos/CHAVEIRO-01/revisoes/r1');
  assert.equal(draft.productId, valid().productId);
  assert.deepEqual(draft.printSummary, { material_gramas: 20, tempo_impressao_minutos: 120 });
  assert.equal(draft.costSnapshot.batchCents, 430);
  assert.equal(draft.rateSnapshot.printerWatts, 200);
  assert.equal(draft.status, 'rascunho');
});

test('impede travessia de caminho, divergência de material e custo inconsistente', () => {
  assert.throws(() => buildPrint3dRecipeDraft({ ...valid(), sku: '../outro' }), /SKU/);
  assert.throws(() => buildPrint3dRecipeDraft({ ...valid(), filaments: [{ ...valid().filaments[0], consumedGrams: 19 }] }), /soma dos filamentos/);
  assert.throws(() => buildPrint3dRecipeDraft({ ...valid(), cost: { ...valid().cost, batchCents: 411 } }), /memória de cálculo/);
});
