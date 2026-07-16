import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /async function syncCustomerGoogleContactRecord\(customer, source = 'system'\)/, `${file} must centralize customer contact sync`);
  assert.match(source, /name === 'customers' && rows\[0\][\s\S]*syncCustomerGoogleContactRecord\(rows\[0\], 'table-data-create'\)/, `${file} must sync newly created customers`);
  assert.match(source, /name === 'customers' && updatedRow[\s\S]*syncCustomerGoogleContactRecord\(updatedRow, 'table-data-update'\)/, `${file} must sync customer updates`);
  assert.match(source, /syncCustomerGoogleContactRecord\(customer, 'site-register'\)/, `${file} must sync customer registrations from the public site`);
  assert.match(source, /fastify\.post\('\/google-contacts\/sync', \{ preHandler: requireSyncKey \}/, `${file} must expose a protected central sync route`);
  assert.match(source, /action: existing\?\.resourceName \? 'updated' : 'created'/, `${file} must update existing contacts instead of duplicating them`);
  assert.match(source, /query', ''[\s\S]*pageSize', '1'/, `${file} must warm the Google contact search cache before matching`);
  assert.match(source, /existing\?\.metadata \? \{ metadata: existing\.metadata \}/, `${file} must send contact source metadata required by updateContact`);
  assert.match(source, /getGoogleContactPhoneMatchKeys[\s\S]*digits\.length === 12[\s\S]*digits\.length === 13/, `${file} must match Brazilian phones with or without the ninth digit`);
}

console.log('Google Contacts customer sync static checks passed');
