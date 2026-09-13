import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /const name = normalizeAuthCustomerName\(body\.name\)/,
    `${file}: site registration must normalize the submitted customer name`,
  );
  assert.match(
    source,
    /UPDATE customers[\s\S]*?SET user_id = COALESCE\(user_id, id\), name = \?, email =[\s\S]*?\[name, email \|\| null, phone \|\| null, customer\.id\]/,
    `${file}: site registration must replace a pre-existing weak name with the name submitted by the customer`,
  );
}

const registerPage = readFileSync('pages/auth/ClienteRegisterPage.tsx', 'utf8');
assert.match(registerPage, /name: formData\.name\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)/);
assert.match(registerPage, /name="name"[\s\S]*?autoComplete="name"/);

console.log('customer-site-registration-name-static.test.mjs: ok');
