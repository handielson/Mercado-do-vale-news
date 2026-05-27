import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('components/pdv/CustomerSection.tsx', 'utf8');

assert.match(
  source,
  /handleSelectCustomer\(created,\s*\{\s*showToast:\s*false\s*\}\);/s,
  'Quick customer creation must select the new customer without also showing the generic selected-customer toast.'
);

assert.match(
  source,
  /const handleSelectCustomer = \(customer: Customer,\s*options: \{ showToast\?: boolean \} = \{\}\) =>/s,
  'Customer selection helper must accept a showToast option.'
);

assert.match(
  source,
  /if \(options\.showToast !== false\) \{\s*toast\.success\(`Cliente \$\{customer\.name\} selecionado`\);\s*\}/s,
  'Generic selected-customer toast must be suppressible for flows that already show a final success message.'
);

console.log('ok - PDV quick customer creation shows a single success toast');
