import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [service, server] = await Promise.all([
  readFile(new URL('../services/products.ts', import.meta.url), 'utf8'),
  readFile(new URL('../vps_server.cjs', import.meta.url), 'utf8'),
]);

assert.match(service, /is_parent: input\.is_parent \? 1 : 0,/);
assert.match(server, /p\.parent_id \|\| null, optionalBool\(p\.is_parent\) \?\? 0,/);
assert.match(server, /is_parent=IF\(\? IS NULL, is_parent, VALUES\(is_parent\)\),/);
assert.match(server, /p\.keywords \|\| null,\s+optionalBool\(p\.is_parent\),/);

console.log('product is_parent default static checks: OK');
