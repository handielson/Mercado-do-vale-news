import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePrint3dCost } from '../utils/print3dCost.mjs';

const input = {
  pieces: 3,
  printMinutes: 360,
  printerWatts: 120,
  energyCentsPerKwh: 90,
  machineCentsPerHour: 500,
  laborMinutes: 25,
  laborCentsPerHour: 1200,
  filaments: [{ consumedGrams: 180, spoolGrams: 1000, spoolCostCents: 10000 }],
  supplies: [{ quantity: 3, unitCostCents: 20 }],
};

test('custo completo da impressão é calculado por lote e por peça', () => {
  const cost = calculatePrint3dCost(input);
  assert.deepEqual(
    [cost.filamentCents, cost.energyCents, cost.machineCents, cost.laborCents, cost.suppliesCents],
    [1800, 65, 3000, 500, 60],
  );
  assert.equal(cost.batchCents, 5425);
  assert.equal(cost.unitCents, 1809);
});

test('filamentos de cores diferentes somam seus próprios custos', () => {
  const cost = calculatePrint3dCost({
    ...input,
    filaments: [
      { consumedGrams: 100, spoolGrams: 1000, spoolCostCents: 10000 },
      { consumedGrams: 80, spoolGrams: 1000, spoolCostCents: 15000 },
    ],
  });
  assert.equal(cost.filamentCents, 2200);
  assert.equal(cost.batchCents, 5825);
});

test('não inventa preço quando faltam custos ou quantidade de peças', () => {
  assert.throws(() => calculatePrint3dCost({ ...input, pieces: 0 }), /pieces/);
  assert.throws(() => calculatePrint3dCost({ ...input, energyCentsPerKwh: undefined }), /energyCentsPerKwh/);
  assert.throws(() => calculatePrint3dCost({ ...input, filaments: [{ ...input.filaments[0], spoolGrams: 0 }] }), /spoolGrams/);
  assert.throws(() => calculatePrint3dCost({ ...input, supplies: [{ quantity: 1, unitCostCents: 0.5 }] }), /unitCostCents/);
});
