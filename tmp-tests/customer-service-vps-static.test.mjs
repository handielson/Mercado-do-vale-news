import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/customers.ts', 'utf8');

assert.doesNotMatch(
  source,
  /from ['"]\.\/supabase['"]|supabase\.from\('customers'\)/,
  'customerService must not use Supabase operational customers table directly',
);

assert.match(
  source,
  /import \{ vpsClient \} from ['"]\.\/vpsClient['"]/,
  'customerService must use vpsClient',
);

assert.match(
  source,
  /\/table-data\/customers\?limit=\$\{pageSize\}&offset=\$\{offset\}/,
  'customerService list/count helpers should read customers through paged VPS table-data',
);

assert.match(
  source,
  /vpsClient\.post<Customer>\('\/table-data\/customers'/,
  'customerService create should write customers through VPS table-data',
);

assert.match(
  source,
  /function serializeCustomerPayload[\s\S]*JSON\.stringify\(payload\[key\]\)[\s\S]*\.\.\.serializeCustomerPayload\(input\)/,
  'customerService should serialize JSON fields before writing through generic table-data',
);

assert.match(
  source,
  /vpsClient\.patch<Customer>\(\s*`\/table-data\/customers\/\$\{encodeURIComponent\(id\)\}\?pk=id`/,
  'customerService update should patch customers through VPS table-data using id pk',
);

assert.match(
  source,
  /vpsClient\.delete\(`\/table-data\/customers\/\$\{encodeURIComponent\(id\)\}\?pk=id`\)/,
  'customerService delete should delete customers through VPS table-data using id pk',
);

console.log('customer service VPS static checks passed');
