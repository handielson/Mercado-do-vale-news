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
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)\s*(tb|gb)?$/i);

  if (!match) {
    throw new Error('Informe uma capacidade numerica valida.');
  }

  const numericValue = Number(match[1].replace(',', '.'));
  const unit = match[2]?.toLowerCase();
  return unit === 'tb' ? numericValue * 1024 : numericValue;
}

export async function resolveMissingListChoices({
  missingChoices = [],
  fields = [],
  choiceOptions = {},
  createOption,
}) {
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const optionsByKey = Object.fromEntries(
    Object.entries(choiceOptions).map(([key, options]) => [key, [...options]]),
  );
  const result = {
    resolvedValues: {},
    created: [],
    rejected: [],
    failed: [],
  };
  const arrayValuesByField = new Map();

  const getArrayValues = (choice, options) => {
    if (!Array.isArray(choice.originalValues) || !Number.isInteger(choice.arrayIndex)) {
      return null;
    }

    if (!arrayValuesByField.has(choice.fieldKey)) {
      arrayValuesByField.set(
        choice.fieldKey,
        choice.originalValues.map((value) => findEquivalentOption(value, options)?.value),
      );
    }

    return arrayValuesByField.get(choice.fieldKey);
  };

  for (const choice of missingChoices) {
    const field = fieldsByKey.get(choice.fieldKey);
    const options = optionsByKey[choice.fieldKey] || [];
    const arrayValues = getArrayValues(choice, options);
    const equivalent = findEquivalentOption(choice.value, options);

    if (equivalent) {
      if (arrayValues) {
        arrayValues[choice.arrayIndex] = equivalent.value;
      } else {
        result.resolvedValues[choice.fieldKey] = equivalent.value;
      }
      continue;
    }

    if (!isCreatableAiOption(choice.value)) {
      result.rejected.push(choice);
      continue;
    }

    if (!field) {
      result.failed.push({
        choice,
        error: new Error(`Campo ${choice.fieldLabel || choice.fieldKey} nao encontrado.`),
      });
      continue;
    }

    try {
      const persisted = await createOption({
        field,
        options,
        value: choice.value,
        choice,
      });
      fieldsByKey.set(choice.fieldKey, persisted.field);
      optionsByKey[choice.fieldKey] = [...options, persisted.option];
      if (arrayValues) {
        arrayValues[choice.arrayIndex] = persisted.option.value;
      } else {
        result.resolvedValues[choice.fieldKey] = persisted.option.value;
      }
      result.created.push({
        fieldKey: choice.fieldKey,
        choice,
        persisted,
      });
    } catch (error) {
      result.failed.push({ choice, error });
    }
  }

  arrayValuesByField.forEach((values, fieldKey) => {
    if (values.every((value) => value !== undefined)) {
      result.resolvedValues[fieldKey] = values;
    }
  });

  return result;
}
