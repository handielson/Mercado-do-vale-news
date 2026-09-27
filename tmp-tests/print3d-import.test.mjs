import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePrint3dSummary } from '../utils/print3dImport.mjs';

test('importa somente material e tempo totais da impressão', () => {
  assert.deepEqual(
    parsePrint3dSummary('{"material_gramas":180.5,"tempo_impressao_minutos":360}'),
    { materialGrams: 180.5, printMinutes: 360 },
  );
});

test('rejeita unidades ambíguas e campos extras', () => {
  assert.throws(() => parsePrint3dSummary('{"material_gramas":"180 g","tempo_impressao_minutos":360}'), /material_gramas/);
  assert.throws(() => parsePrint3dSummary('{"material_gramas":180,"tempo_impressao_minutos":360,"filamento":"PLA"}'), /apenas/);
  assert.throws(() => parsePrint3dSummary('{"material_gramas":180}'), /apenas/);
  assert.throws(() => parsePrint3dSummary('{"material_gramas":180,"tempo_impressao_minutos":0}'), /tempo_impressao_minutos/);
});
