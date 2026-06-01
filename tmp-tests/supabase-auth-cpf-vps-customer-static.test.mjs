import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authSource = readFileSync('contexts/VpsAuthContext.tsx', 'utf8');
const customerServiceSource = readFileSync('services/customers.ts', 'utf8');

assert.match(
  authSource,
  /import\s+\{\s*customerService\s*\}\s+from\s+'..\/services\/customers'/,
  'VpsAuthContext should import customerService for customer lookups',
);

for (const functionName of ['checkCPF']) {
  const functionStart = authSource.indexOf(`const ${functionName} = async`);
  assert.notEqual(functionStart, -1, `${functionName} should exist`);
  const nextFunctionStart = authSource.indexOf('\n    // ', functionStart + 1);
  const functionBody = authSource.slice(
    functionStart,
    nextFunctionStart === -1 ? authSource.length : nextFunctionStart,
  );

  assert.doesNotMatch(
    functionBody,
    /\.from\('customers'\)/,
    `${functionName} must not read customers directly from Supabase`,
  );
  assert.match(
    functionBody,
    /customerService\.getByCpfCnpj\(/,
    `${functionName} should read customers through the VPS customer service`,
  );
}

assert.match(
  authSource,
  /vpsAuthService\.signInWithCpf\(cpf, password\)/,
  'signInWithCpf should authenticate through VPS auth',
);

assert.match(
  customerServiceSource,
  /onlyDigits\(customer\.cpf_cnpj\)\s*===\s*onlyDigits\(cpfCnpj\)/,
  'customerService.getByCpfCnpj should match CPF/CNPJ with or without mask',
);

console.log('VPS auth CPF customer static checks passed');
