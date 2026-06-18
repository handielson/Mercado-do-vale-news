import assert from 'node:assert/strict';

import {
  findEquivalentOption,
  isCreatableAiOption,
  normalizeOptionText,
  parseCapacityValue,
  resolveMissingListChoices,
} from '../components/settings/modelListOptionCore.js';

assert.equal(
  normalizeOptionText('  Gorilla   Glass 5 '),
  'gorilla glass 5',
  'normalizes casing and repeated whitespace',
);

assert.equal(
  normalizeOptionText('Wi-Fi 6 (802.11ax)'),
  'wi-fi 6 (802.11ax)',
  'preserves technical punctuation',
);

assert.equal(
  normalizeOptionText('Gorilla Glass 3+'),
  'gorilla glass 3+',
  'preserves technical suffixes',
);

const existingOptions = [
  { id: 'victus', label: 'Gorilla Glass Victus' },
  { id: 'ceramica', label: 'Proteção Cerâmica' },
];

assert.equal(
  findEquivalentOption('  protecao   CERAMICA ', existingOptions),
  existingOptions[1],
  'returns the existing option when casing, accents, and whitespace differ',
);

assert.equal(
  findEquivalentOption('Gorilla Glass 5', existingOptions),
  null,
  'returns null when no existing option is equivalent',
);

for (const value of [
  '',
  'Nao informado',
  'Não informado.',
  'Desconhecido',
  'Consulte',
  'Consulte...',
  'N/A',
  'N/A.',
  'null',
  'undefined',
]) {
  assert.equal(
    isCreatableAiOption(value),
    false,
    `rejects generic AI option value: ${JSON.stringify(value)}`,
  );
}

assert.equal(
  isCreatableAiOption('Gorilla Glass Victus 3'),
  true,
  'accepts a specific list option returned by AI',
);

assert.equal(parseCapacityValue('12 GB'), 12);
assert.equal(parseCapacityValue('1 TB'), 1024);
assert.equal(parseCapacityValue('12GB'), 12);
assert.throws(
  () => parseCapacityValue('Grande'),
  /capacidade numerica/i,
);
assert.throws(
  () => parseCapacityValue('12 bananas'),
  /capacidade numerica/i,
);
assert.throws(
  () => parseCapacityValue('abc 12 TB'),
  /capacidade numerica/i,
);

{
  const screenField = { id: 'screen', key: 'screen', label: 'Tela', field_type: 'select' };
  const resistanceField = { id: 'resistance', key: 'resistance', label: 'Resistencia', field_type: 'select' };
  const networkField = { id: 'network', key: 'network', label: 'Rede', field_type: 'select' };
  const createCalls = [];
  const persistenceError = new Error('falha ao persistir rede');

  const result = await resolveMissingListChoices({
    missingChoices: [
      { fieldKey: 'screen', fieldLabel: 'Tela', value: 'Gorilla Glass 7i', options: [] },
      { fieldKey: 'resistance', fieldLabel: 'Resistencia', value: 'Nao informado.', options: [] },
      { fieldKey: 'network', fieldLabel: 'Rede', value: '6G', options: [] },
    ],
    fields: [screenField, resistanceField, networkField],
    choiceOptions: {
      screen: [],
      resistance: [],
      network: [],
    },
    createOption: async ({ field, options, value }) => {
      createCalls.push({ fieldKey: field.key, options, value });
      if (field.key === 'network') throw persistenceError;
      return {
        field: { ...field, options: [value] },
        option: { value, label: value },
      };
    },
  });

  assert.deepEqual(result.resolvedValues, { screen: 'Gorilla Glass 7i' });
  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].fieldKey, 'screen');
  assert.equal(result.created[0].persisted.option.label, 'Gorilla Glass 7i');
  assert.deepEqual(result.rejected, [
    { fieldKey: 'resistance', fieldLabel: 'Resistencia', value: 'Nao informado.', options: [] },
  ]);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].choice.fieldKey, 'network');
  assert.equal(result.failed[0].error, persistenceError, 'preserves the original persistence error');
  assert.deepEqual(
    createCalls.map((call) => call.fieldKey),
    ['screen', 'network'],
    'rejected generic values never reach persistence',
  );
}

{
  let createCalls = 0;
  const existing = { value: 'victus-id', label: 'Gorilla Glass Victus' };
  const result = await resolveMissingListChoices({
    missingChoices: [
      { fieldKey: 'screen', fieldLabel: 'Tela', value: '  gorilla glass VICTUS ', options: [] },
    ],
    fields: [{ id: 'screen', key: 'screen', label: 'Tela', field_type: 'table_relation' }],
    choiceOptions: { screen: [existing] },
    createOption: async () => {
      createCalls += 1;
      throw new Error('must not create an equivalent option');
    },
  });

  assert.deepEqual(result.resolvedValues, { screen: 'victus-id' });
  assert.equal(result.created.length, 0);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.failed.length, 0);
  assert.equal(createCalls, 0);
}

{
  const receivedFieldOptions = [];
  await resolveMissingListChoices({
    missingChoices: [
      { fieldKey: 'protection', fieldLabel: 'Protecao', value: 'Victus 2', options: [] },
      { fieldKey: 'protection', fieldLabel: 'Protecao', value: 'Armor', options: [] },
    ],
    fields: [{
      id: 'protection',
      key: 'protection',
      label: 'Protecao',
      field_type: 'select',
      options: [],
    }],
    choiceOptions: { protection: [] },
    createOption: async ({ field, value }) => {
      receivedFieldOptions.push([...(field.options || [])]);
      const updatedField = {
        ...field,
        options: [...(field.options || []), value],
      };
      return {
        field: updatedField,
        option: { value, label: value },
      };
    },
  });

  assert.deepEqual(
    receivedFieldOptions,
    [[], ['Victus 2']],
    'multiple creations for one field must use the field returned by the previous save',
  );
}

{
  const field = {
    id: 'protection',
    key: 'protection',
    label: 'Protecao',
    field_type: 'select',
    options: ['IP67'],
  };
  const createdValues = [];
  const originalValues = ['IP67', 'IP70', 'IP69'];
  const result = await resolveMissingListChoices({
    missingChoices: [
      {
        fieldKey: 'protection',
        fieldLabel: 'Protecao',
        value: 'IP70',
        options: ['IP67'],
        originalValues,
        arrayIndex: 1,
      },
      {
        fieldKey: 'protection',
        fieldLabel: 'Protecao',
        value: 'IP69',
        options: ['IP67'],
        originalValues,
        arrayIndex: 2,
      },
    ],
    fields: [field],
    choiceOptions: {
      protection: [{ value: 'ip67-id', label: 'IP67' }],
    },
    createOption: async ({ field: currentField, value }) => {
      createdValues.push(value);
      const updatedField = {
        ...currentField,
        options: [...(currentField.options || []), value],
      };
      return {
        field: updatedField,
        option: { value: `${value.toLowerCase()}-id`, label: value },
      };
    },
  });

  assert.deepEqual(createdValues, ['IP70', 'IP69']);
  assert.deepEqual(
    result.resolvedValues,
    { protection: ['ip67-id', 'ip70-id', 'ip69-id'] },
    'mixed arrays must preserve normalized existing values and insert each created value by index',
  );
  assert.equal(result.created.length, 2);
}

console.log('model list option core tests passed');
