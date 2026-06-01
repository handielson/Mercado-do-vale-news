import fs from 'node:fs';
import assert from 'node:assert/strict';

const serverFiles = ['vps_server.cjs', 'vps_server.js', 'server.js'];

for (const file of serverFiles) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(
    source,
    /function\s+buildPasswordResetEmail\s*\(/,
    `${file} must keep the password reset email in a named transactional template`
  );
  assert.match(
    source,
    /function\s+buildPasswordChangedEmail\s*\(/,
    `${file} must define a password changed notification template`
  );
  assert.match(
    source,
    /buildPasswordResetEmail\(\{\s*customer,\s*resetLink,\s*expiresMinutes\s*\}\)/,
    `${file} must use the named password reset email template`
  );
  assert.match(
    source,
    /buildPasswordChangedEmail\(\{\s*customer\s*\}\)/,
    `${file} must use the named password changed email template`
  );
  assert.match(
    source,
    /subject:\s*'Senha alterada - Mercado do Vale'/,
    `${file} must send a password changed notification with the expected subject`
  );
}

const envExample = fs.readFileSync('.env.vps.example', 'utf8');
assert.match(
  envExample,
  /SMTP transacional usado pela recuperacao de senha e avisos de seguranca\./,
  '.env.vps.example must document that SMTP also sends security notices'
);

const checklist = fs.readFileSync('migração_VPS.md', 'utf8');
assert.match(
  checklist,
  /aviso de senha alterada/i,
  'migration checklist must mention the password changed email'
);

console.log('VPS auth transactional email template static checks passed');
