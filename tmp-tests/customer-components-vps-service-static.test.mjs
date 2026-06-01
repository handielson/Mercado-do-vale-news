import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pdvSource = readFileSync('components/pdv/CustomerSection.tsx', 'utf8');
const freightSource = readFileSync('components/shipping/FreightCalculator.tsx', 'utf8');
const customerServiceSource = readFileSync('services/customers.ts', 'utf8');

for (const [label, source] of [
  ['PDV CustomerSection', pdvSource],
  ['FreightCalculator', freightSource],
]) {
  assert.doesNotMatch(
    source,
    /services\/supabase|from\(['"]customers['"]\)/,
    `${label} must not query customers directly through Supabase`,
  );
  assert.match(
    source,
    /customerService/,
    `${label} should use customerService for customer lookup`,
  );
}

assert.match(
  customerServiceSource,
  /\[customer\.name,\s*customer\.cpf_cnpj,\s*customer\.phone,\s*customer\.email\]/,
  'customerService search should include phone so PDV/freight keep their previous lookup behavior',
);

console.log('customer component VPS service static checks passed');
