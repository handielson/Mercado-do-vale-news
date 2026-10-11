import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildPrint3dRecipeDraft, validatePrint3dRecipeDraft } from '../utils/print3dRecipeDraft.mjs';
import { calculatePrint3dCost } from '../utils/print3dCost.mjs';
import { resolvePrint3dPlateFiles } from '../utils/print3dPlatePlan.mjs';

export function plateFixture() {
  const filaments = [{ id:'petg', name:'PETG', color:'Branco', consumedGrams:60, spoolGrams:1000, spoolCostCents:10000 }];
  const rates = { printerWatts:100, energyCentsPerKwh:100, machineCentsPerHour:100, laborCentsPerHour:2000 };
  const params = { pieces:10, printMinutes:360, laborMinutes:0, filaments, supplies:[], ...rates };
  return buildPrint3dRecipeDraft({ productId:'11111111-1111-4111-8111-111111111111', productName:'Mini Esqueleto - MINI0001-01', sku:'MINI0001-01', revision:'r1',
    printerName:'A1', printerProfile:'A1 PETG 0.2mm', materialIncludesSupportsAndPurge:true, inputSource:'manual', materialGrams:60,
    ...params, rates, cost:calculatePrint3dCost(params),
    plates:[10,20,30].map((grams, i) => ({ id:`plate-${i+1}`, name:`Placa ${i+1}`, notes:'', printMinutes:grams * 6, filaments:[{ id:'petg', consumedGrams:grams }], files:[] })),
  });
}
test('3 placas completam 10 produtos, não 30; soma tempo/filamentos e preserva revisão', () => {
  const draft = plateFixture();
  assert.equal(draft.piecesPerBatch, 10);
  assert.equal(draft.costSnapshot.batchCents, 1260);
  assert.equal(draft.costSnapshot.unitCents, 126);
  assert.deepEqual(validatePrint3dRecipeDraft(draft), draft);
  const legacy = structuredClone(draft); delete legacy.plates;
  assert.deepEqual(validatePrint3dRecipeDraft(legacy), legacy);
});
test('rejeita placa duplicada, consumos divergentes e tempo divergente', () => {
  const draft = plateFixture();
  draft.plates[1].id = draft.plates[0].id;
  assert.throws(() => validatePrint3dRecipeDraft(draft), /repetido/);
  draft.plates[1].id = 'plate-2'; draft.plates[1].filaments[0].consumedGrams = 19;
  assert.throws(() => validatePrint3dRecipeDraft(draft), /totais/);
  draft.plates[1].filaments[0].consumedGrams = 20; draft.plates[0].printMinutes = 61;
  assert.throws(() => validatePrint3dRecipeDraft(draft), /totais/);
});
test('ativação exige todos os arquivos imprimíveis vinculados por conteúdo, não nome', () => {
  const draft = plateFixture();
  assert.throws(() => resolvePrint3dPlateFiles(draft, [], { requirePrintable:true }), /Placa 1/);
  const files = draft.plates.map((plate, i) => {
    const ref = { kind:'project', sha256:createHash('sha256').update(`plate${i}`).digest('hex'), byte_size:10, original_name:`plate${i}.3mf` };
    plate.files.push(ref);
    return { ...ref, id:`f${i}`, printer_profile:null };
  });
  assert.equal(resolvePrint3dPlateFiles(draft, files, { requirePrintable:true }).length, 3);
  assert.throws(() => resolvePrint3dPlateFiles(draft, files.slice(1)), /ausente/);
  const wrong = files.map(f => ({ ...f, sha256:'0'.repeat(64) }));
  assert.throws(() => resolvePrint3dPlateFiles(draft, wrong), /divergente/);
});
