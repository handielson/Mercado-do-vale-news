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
  return !GENERIC_AI_OPTIONS.has(normalizeOptionText(value));
}
