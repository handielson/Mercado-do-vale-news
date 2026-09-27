/**
 * Contract exported by the print program. Both figures describe the complete
 * print run; the number of sellable pieces is entered separately in the panel.
 */
export function parsePrint3dSummary(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new TypeError('Selecione um arquivo JSON da impressão.');
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new TypeError('O arquivo não contém um JSON válido.');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('O JSON deve conter um objeto com material e tempo.');
  }

  const expected = ['material_gramas', 'tempo_impressao_minutos'];
  const keys = Object.keys(data);
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    throw new TypeError('O JSON deve conter apenas material_gramas e tempo_impressao_minutos.');
  }

  for (const key of expected) {
    if (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || data[key] <= 0) {
      throw new TypeError(`${key} deve ser um número maior que zero.`);
    }
  }

  return {
    materialGrams: data.material_gramas,
    printMinutes: data.tempo_impressao_minutos,
  };
}
