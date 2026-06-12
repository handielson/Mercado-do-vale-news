import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/pdv/CustomerSection.tsx', 'utf8');

assert.match(
  source,
  /openCustomerHistory/,
  'PDV selected customer card must have a real customer history action',
);

assert.match(
  source,
  /\/admin\/customers\/\$\{selectedCustomer\.id\}/,
  'PDV history action must open the admin customer page for the selected customer',
);

assert.doesNotMatch(
  source,
  /Funcionalidade em desenvolvimento/,
  'PDV selected customer history must not show the development placeholder',
);

console.log('PDV customer history link static checks passed');
