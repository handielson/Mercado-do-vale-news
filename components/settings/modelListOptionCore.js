const GENERIC_AI_OPTIONS = new Set([
  '',
  'nao informado',
  'desconhecido',
  'consulte',
  'n/a',
  'null',
  'undefined',
]);

export function normalizeOptionText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function findEquivalentOption(value, options = []) {
  const normalizedValue = normalizeOptionText(value);

  return (
    options.find(
      (option) =>
        normalizeOptionText(option.label ?? option.value) === normalizedValue,
    ) || null
  );
}

export function isCreatableAiOption(value) {
  const genericCandidate = normalizeOptionText(value)
    .replace(/[.,!?;:\u2026]+$/u, '')
    .trimEnd();

  return !GENERIC_AI_OPTIONS.has(genericCandidate);
}

export function parseCapacityValue(label) {
  const normalized = String(label ?? '').trim();
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(tb|gb)?/i);

  if (!match) {
    throw new Error('Informe uma capacidade numerica valida.');
  }

  const numericValue = Number(match[1].replace(',', '.'));
  const unit = match[2]?.toLowerCase();
  return unit === 'tb' ? numericValue * 1024 : numericValue;
}
