import fs from 'node:fs';
import assert from 'node:assert/strict';

const serverFiles = ['vps_server.cjs', 'vps_server.js', 'server.js'];

for (const file of serverFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS customer_auth_password_resets/, `${file} must create password reset table`);
  assert.match(source, /fastify\.post\('\/auth\/password-reset\/request'/, `${file} must expose password reset request route`);
  assert.match(source, /fastify\.post\('\/auth\/password-reset\/confirm'/, `${file} must expose password reset confirm route`);
  assert.match(source, /function\s+hashAuthResetToken\s*\(/, `${file} must hash reset tokens before storing`);
  assert.match(source, /crypto\.randomBytes\(32\)\.toString\('base64url'\)/, `${file} must generate high-entropy reset tokens`);
  assert.match(source, /sendTransactionalEmail\(/, `${file} must attempt transactional email delivery`);
  assert.match(source, /SMTP_HOST|SMTP_USER|SMTP_PASS|SMTP_FROM/, `${file} must read SMTP configuration`);
  assert.doesNotMatch(source, /SELECT \* FROM customer_auth_password_resets/, `${file} must avoid broad reset token selects`);
}

const authService = fs.readFileSync('services/vpsAuthService.ts', 'utf8');
assert.match(authService, /requestPasswordReset\(email: string\)/, 'frontend service must request password reset');
assert.match(authService, /confirmPasswordReset\(token: string, password: string\)/, 'frontend service must confirm password reset by token');
assert.match(authService, /\/auth\/password-reset\/request/, 'frontend service must call reset request route');
assert.match(authService, /\/auth\/password-reset\/confirm/, 'frontend service must call reset confirm route');

const context = fs.readFileSync('contexts/VpsAuthContext.tsx', 'utf8');
assert.match(context, /vpsAuthService\.requestPasswordReset\(email\)/, 'VpsAuthContext resetPassword must call VPS reset route');
assert.doesNotMatch(context, /Recuperacao de senha indisponivel/, 'VpsAuthContext must not report reset as unavailable');

const resetPage = fs.readFileSync('pages/auth/RedefinirSenhaPage.tsx', 'utf8');
assert.match(resetPage, /useSearchParams/, 'reset page must read token from query string');
assert.match(resetPage, /updatePassword\(password,\s*resetToken\)/, 'reset page must pass token when changing password');

const envExample = fs.readFileSync('.env.vps.example', 'utf8');
for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'APP_PUBLIC_URL']) {
  assert.match(envExample, new RegExp(`${key}=`), `.env.vps.example must document ${key}`);
}

const checklist = fs.readFileSync('migração_VPS.md', 'utf8');
assert.match(checklist, /recuperacao de senha por e-mail/i, 'migration checklist must mention password recovery');
assert.match(checklist, /SMTP/i, 'migration checklist must mention SMTP');

console.log('VPS auth password reset static checks passed');
