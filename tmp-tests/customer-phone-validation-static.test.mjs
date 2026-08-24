import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = (path) => fs.readFileSync(path, 'utf8');

const utilitySource = read('utils/cpfCnpjValidation.ts');
const transpiled = ts.transpileModule(utilitySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const utilityModule = { exports: {} };
vm.runInNewContext(transpiled, {
  module: utilityModule,
  exports: utilityModule.exports,
  require,
});

const { normalizeBrazilianPhone, formatPhone } = utilityModule.exports;
assert.equal(normalizeBrazilianPhone('(13) 99212-7111'), '13992127111');
assert.equal(normalizeBrazilianPhone('+55 13 99212-7111'), '13992127111');
assert.equal(normalizeBrazilianPhone('139992127111'), '', '12 local digits must be rejected');
assert.equal(formatPhone('+55 13 99212-7111'), '(13) 99212-7111');
assert.equal(formatPhone('139992127111'), '139992127111', 'invalid input must not be silently truncated');

const pdv = read('components/pdv/CustomerSection.tsx');
const adminForm = read('pages/customers/CustomerFormPage.tsx');
const profile = read('components/customer/profile/PersonalInfoTab.tsx');
const customerService = read('services/customers.ts');
for (const [label, source] of [['PDV', pdv], ['admin', adminForm], ['profile', profile]]) {
  assert.match(source, /normalizeBrazilianPhone\(/, `${label} must reject an invalid phone before saving`);
}
assert.match(customerService, /if \(rawPhone && !normalizedPhone\)/);
assert.match(customerService, /payload\.phone = normalizedPhone \|\| null/);

for (const serverPath of ['vps_server.js', 'vps_server.cjs']) {
  const server = read(serverPath);
  assert.match(server, /function normalizeCustomerPhoneForStorage\(value\)/);
  assert.match(server, /name === 'customers'.*hasOwnProperty\.call\(insertBody, 'phone'\)/s);
  assert.match(server, /name === 'customers'.*hasOwnProperty\.call\(body, 'phone'\)/s);
  assert.match(server, /return reply\.code\(400\)\.send\(\{ error: 'Informe um telefone valido com DDD' \}\)/);
  assert.match(server, /function normalizeDeliveryWhatsAppNumber\(value\) \{\s*return normalizeAuthWhatsApp\(value\);\s*\}/);
  assert.match(server, /rawPhoneDigits \? 'invalid_phone' : 'missing_phone'/);
}

console.log('customer phone validation regression: ok');
