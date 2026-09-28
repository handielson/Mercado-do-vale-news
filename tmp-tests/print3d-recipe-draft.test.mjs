import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPrint3dRecipeDraft, validatePrint3dRecipeDraft } from '../utils/print3dRecipeDraft.mjs';
import { calculatePrint3dCost } from '../utils/print3dCost.mjs';

const valid = () => ({
  productId: '11111111-1111-4111-8111-111111111111', productName: 'Chaveiro azul',
  sku: 'CHAVEIRO-01', revision: 'r1', materialGrams: 20, printMinutes: 120, pieces: 2, laborMinutes: 10,
  inputSource: 'manual', printerName: 'Bambu Lab A1', printerProfile: 'PLA 0,4 mm',
  materialIncludesSupportsAndPurge: true, productionNotes: 'Conferir encaixe.',
  filaments: [{ id: 'pla-azul', name: 'PLA', color: 'Azul', consumedGrams: 20, spoolGrams: 1000, spoolCostCents: 9000 }],
  supplies: [{ id: 'argola', name: 'Argola', quantity: 2, unitCostCents: 30 }],
  cost: { filamentCents: 180, energyCents: 40, machineCents: 100, laborCents: 50, suppliesCents: 60, batchCents: 430, unitCents: 215 },
  rates: { printerWatts: 200, energyCentsPerKwh: 100, machineCentsPerHour: 50, laborCentsPerHour: 300 },
});

test('exporta rascunho com pasta por SKU/revisão e custos históricos em centavos', () => {
  const draft = buildPrint3dRecipeDraft(valid());
  assert.equal(draft.suggestedPrivateFolder, 'producao-3d/produtos/CHAVEIRO-01/revisoes/r1');
  assert.equal(draft.productId, valid().productId);
  assert.deepEqual(draft.printSummary, { material_gramas: 20, tempo_impressao_minutos: 120, source: 'manual' });
  assert.deepEqual(draft.productionDetails, { printer:'Bambu Lab A1',profile:'PLA 0,4 mm',material_includes_supports_and_purge:true,notes:'Conferir encaixe.' });
  assert.equal(draft.costSnapshot.batchCents, 430);
  assert.equal(draft.rateSnapshot.printerWatts, 200);
  assert.equal(draft.status, 'rascunho');
});

test('impede travessia de caminho, divergência de material e custo inconsistente', () => {
  assert.throws(() => buildPrint3dRecipeDraft({ ...valid(), sku: '../outro' }), /SKU/);
  assert.throws(() => buildPrint3dRecipeDraft({ ...valid(), filaments: [{ ...valid().filaments[0], consumedGrams: 19 }] }), /soma dos filamentos/);
  assert.throws(() => buildPrint3dRecipeDraft({ ...valid(), cost: { ...valid().cost, batchCents: 411 } }), /memória de cálculo/);
  assert.throws(() => buildPrint3dRecipeDraft({ ...valid(), printerName:'' }), /Impressora/);
  assert.throws(() => buildPrint3dRecipeDraft({ ...valid(), materialIncludesSupportsAndPurge:null }), /suportes e purga/);
});

test('ficha preserva embalagem e alíquota ao validar novamente', () => {
  const input = valid();
  input.rates.taxPercent = 10;
  input.supplies.push({ id: 'packaging-per-piece', name: 'Embalagem por peça', quantity: 2, unitCostCents: 100 });
  input.cost = calculatePrint3dCost({ ...input, ...input.rates });
  const draft = buildPrint3dRecipeDraft(input);
  assert.equal(draft.costSnapshot.batchCents, 630);
  assert.equal(draft.rateSnapshot.taxPercent, 10);
  assert.deepEqual(validatePrint3dRecipeDraft(draft), draft);
  assert.throws(() => validatePrint3dRecipeDraft({ ...draft, rateSnapshot: { ...draft.rateSnapshot, taxPercent: 100 } }));
});
test('ficha preserva unidade do insumo e recusa ID duplicado', () => {
  const input=valid();
  input.supplies[0].unitLabel='un';
  const draft=buildPrint3dRecipeDraft(input);
  assert.equal(draft.supplies[0].unitLabel,'un');
  assert.deepEqual(validatePrint3dRecipeDraft(draft),draft);
  assert.throws(()=>buildPrint3dRecipeDraft({...input,supplies:[...input.supplies,input.supplies[0]]}),/mesmo insumo/);
});
