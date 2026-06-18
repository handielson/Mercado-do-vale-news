import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const customerService = readFileSync('services/customers.ts', 'utf8');
const customerList = readFileSync('pages/customers/CustomerListPage.tsx', 'utf8');
const formatter = readFileSync('utils/customerFormUtils.ts', 'utf8');

assert.match(
  formatter,
  /export const capitalizeName = \(name: string\): string => \{[\s\S]*\.toLowerCase\(\)[\s\S]*word\.charAt\(0\)\.toUpperCase\(\)/,
  'shared customer name formatter must normalize casing independently of input source',
);

assert.match(
  customerService,
  /import \{ capitalizeName \} from '\.\.\/utils\/customerFormUtils';/,
  'customer service must use the shared customer name formatter',
);

assert.match(
  customerService,
  /function normalizeCustomer\(row: Customer\): Customer \{[\s\S]*name: capitalizeName\(String\(row\.name \|\| ''\)\)/,
  'customer rows loaded from VPS must expose normalized names',
);

assert.match(
  customerService,
  /function serializeCustomerPayload[\s\S]*if \('name' in payload\) \{[\s\S]*payload\.name = capitalizeName\(String\(payload\.name \|\| ''\)\)/,
  'customer create and update payloads must persist normalized names',
);

assert.match(
  customerList,
  /\{customer\.name\}/,
  'customer list may render customer.name directly because service normalization is central',
);

console.log('customer name normalization static checks passed');