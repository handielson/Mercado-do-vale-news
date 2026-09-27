/**
 * Estimate a print run from a confirmed production recipe. All prices are
 * integer cents. Time and material are totals for the complete print run.
 * This function has no stock, order or pricing side effects.
 */
function nonNegative(value, field, { integer = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) {
    throw new TypeError(`${field} deve ser um número ${integer ? 'inteiro ' : ''}não negativo.`);
  }
  return value;
}

function requiredPositive(value, field, options) {
  const result = nonNegative(value, field, options);
  if (result === 0) throw new RangeError(`${field} deve ser maior que zero.`);
  return result;
}

function cents(value, field) {
  return nonNegative(value, field, { integer: true });
}

function roundCents(value) {
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded)) throw new RangeError('Custo calculado excede o limite seguro.');
  return rounded;
}

export function calculatePrint3dCost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Informe a ficha da impressão.');
  }
  const pieces = requiredPositive(input.pieces, 'pieces', { integer: true });
  const printMinutes = nonNegative(input.printMinutes, 'printMinutes');
  const printerWatts = nonNegative(input.printerWatts, 'printerWatts');
  const energyCentsPerKwh = cents(input.energyCentsPerKwh, 'energyCentsPerKwh');
  const machineCentsPerHour = cents(input.machineCentsPerHour, 'machineCentsPerHour');
  const laborMinutes = nonNegative(input.laborMinutes, 'laborMinutes');
  const laborCentsPerHour = cents(input.laborCentsPerHour, 'laborCentsPerHour');

  if (!Array.isArray(input.filaments) || input.filaments.length === 0) {
    throw new TypeError('Informe pelo menos um filamento.');
  }
  const filamentLines = input.filaments.map((filament, index) => {
    const consumedGrams = nonNegative(filament?.consumedGrams, `filaments[${index}].consumedGrams`);
    const spoolGrams = requiredPositive(filament?.spoolGrams, `filaments[${index}].spoolGrams`);
    const spoolCostCents = cents(filament?.spoolCostCents, `filaments[${index}].spoolCostCents`);
    return {
      consumedGrams,
      costCents: roundCents(consumedGrams * spoolCostCents / spoolGrams),
    };
  });

  const supplies = input.supplies ?? [];
  if (!Array.isArray(supplies)) throw new TypeError('supplies deve ser uma lista.');
  const supplyLines = supplies.map((supply, index) => {
    const quantity = nonNegative(supply?.quantity, `supplies[${index}].quantity`);
    const unitCostCents = cents(supply?.unitCostCents, `supplies[${index}].unitCostCents`);
    return { quantity, costCents: roundCents(quantity * unitCostCents) };
  });

  const filamentCents = filamentLines.reduce((sum, line) => sum + line.costCents, 0);
  const energyCents = roundCents(printerWatts * printMinutes * energyCentsPerKwh / 60000);
  const machineCents = roundCents(printMinutes * machineCentsPerHour / 60);
  const laborCents = roundCents(laborMinutes * laborCentsPerHour / 60);
  const suppliesCents = supplyLines.reduce((sum, line) => sum + line.costCents, 0);
  const batchCents = filamentCents + energyCents + machineCents + laborCents + suppliesCents;
  if (!Number.isSafeInteger(batchCents)) throw new RangeError('Custo calculado excede o limite seguro.');

  return {
    pieces,
    printMinutes,
    filamentLines,
    supplyLines,
    filamentCents,
    energyCents,
    machineCents,
    laborCents,
    suppliesCents,
    batchCents,
    unitCents: Math.ceil(batchCents / pieces),
  };
}
