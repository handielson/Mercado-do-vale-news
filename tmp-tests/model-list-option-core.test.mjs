import assert from 'node:assert/strict';

import {
  findEquivalentOption,
  isCreatableAiOption,
  normalizeOptionText,
  parseCapacityValue,
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
assert.throws(
  () => parseCapacityValue('Grande'),
  /capacidade numerica/i,
);

console.log('model list option core tests passed');
