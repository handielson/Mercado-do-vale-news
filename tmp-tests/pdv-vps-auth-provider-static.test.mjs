import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of [
  'pages/pdv/PDVPage.tsx',
  'components/pdv/CashOpeningModal.tsx',
]) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /useVpsAuth as useAuth/, `${file} must use the active VpsAuthProvider hook`);
  assert.doesNotMatch(source, /contexts\/AuthContext/, `${file} must not use the inactive AuthProvider context`);
}

console.log('PDV active VPS auth provider static checks ok');
