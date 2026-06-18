import assert from 'node:assert/strict';

import {
  findEquivalentOption,
  isCreatableAiOption,
  normalizeOptionText,
} from '../components/settings/modelListOptionCore.js';

assert.equal(
  normalizeOptionText('  Gorilla   Glass 5 '),
  'gorilla glass 5',
  'normalizes casing and repeated whitespace',
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
  'Desconhecido',
  'Consulte',
  'N/A',
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

console.log('model list option core tests passed');
