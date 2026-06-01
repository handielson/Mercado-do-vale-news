import fs from 'node:fs';
import assert from 'node:assert/strict';

const serverFiles = ['vps_server.cjs', 'vps_server.js', 'server.js'];

for (const file of serverFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(
    source,
    /function\s+isAuthEmailConfirmationRequired\s*\(\)\s*{/,
    `${file} must expose isAuthEmailConfirmationRequired()`
  );
  assert.match(
    source,
    /process\.env\.VPS_AUTH_REQUIRE_EMAIL_CONFIRMATION/,
    `${file} must read VPS_AUTH_REQUIRE_EMAIL_CONFIRMATION`
  );
  assert.match(
    source,
    /return\s+normalized\s*===\s*'1'\s*\|\|\s*normalized\s*===\s*'true'\s*\|\|\s*normalized\s*===\s*'yes'/,
    `${file} must only enable confirmation for explicit truthy values`
  );
  assert.match(
    source,
    /emailConfirmationRequired:\s*isAuthEmailConfirmationRequired\(\)/,
    `${file} auth responses must expose the current flag state`
  );
}

const envExample = fs.readFileSync('.env.vps.example', 'utf8');
assert.match(
  envExample,
  /VPS_AUTH_REQUIRE_EMAIL_CONFIRMATION="false"/,
  '.env.vps.example must document the disabled default'
);

const checklist = fs.readFileSync('migração_VPS.md', 'utf8');
assert.match(
  checklist,
  /confirmacao de cadastro por e-mail.*flag `VPS_AUTH_REQUIRE_EMAIL_CONFIRMATION` desligada por padrao/i,
  'migration checklist must record the disabled email confirmation flag'
);
assert.match(
  checklist,
  /nao temos nenhum e-mail transacional criado hoje/i,
  'migration checklist must state that transactional emails do not exist yet'
);

console.log('VPS auth email confirmation flag static checks passed');
