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
  assert.match(source, /sendAuthPasswordResetWhatsApp\(/, `${file} must support password reset by WhatsApp`);
  assert.match(source, /channel === 'whatsapp'/, `${file} must select the requested recovery channel`);
  assert.match(source, /Este WhatsApp ja esta vinculado a outra conta/, `${file} must prevent ambiguous recovery phones at registration`);
  assert.match(source, /LOWER\(c\.email\) = \?/, `${file} must also find corrected customer emails`);
  assert.match(source, /created_at >= DATE_SUB\(NOW\(\), INTERVAL 2 MINUTE\)/, `${file} must throttle repeated requests per account`);
  assert.match(source, /SET used_at = NOW\(\) WHERE customer_id = \? AND used_at IS NULL/, `${file} must invalidate older reset links`);
  assert.match(source, /SMTP_HOST|SMTP_USER|SMTP_PASS|SMTP_FROM/, `${file} must read SMTP configuration`);
  assert.match(source, /bindSocket\(socket\)[\s\S]*secureConnect/, `${file} must bind and await the upgraded STARTTLS socket`);
  assert.match(source, /SMTP_TIMEOUT_MS/, `${file} must time out stalled SMTP connections`);
  assert.match(source, /!\/\[\\r\\n\]\//, `${file} must reject line breaks in email addresses`);
  assert.doesNotMatch(source, /SELECT \* FROM customer_auth_password_resets/, `${file} must avoid broad reset token selects`);
}

const authService = fs.readFileSync('services/vpsAuthService.ts', 'utf8');
assert.match(authService, /requestPasswordReset\(identifier: string, channel: PasswordResetChannel/, 'frontend service must request password reset by selected channel');
assert.match(authService, /JSON\.stringify\(\{ channel, identifier \}\)/, 'frontend service must send channel and identifier');
assert.match(authService, /confirmPasswordReset\(token: string, password: string\)/, 'frontend service must confirm password reset by token');
assert.match(authService, /\/auth\/password-reset\/request/, 'frontend service must call reset request route');
assert.match(authService, /\/auth\/password-reset\/confirm/, 'frontend service must call reset confirm route');

const context = fs.readFileSync('contexts/VpsAuthContext.tsx', 'utf8');
assert.match(context, /vpsAuthService\.requestPasswordReset\(identifier, channel\)/, 'VpsAuthContext resetPassword must call VPS reset route with the channel');
assert.doesNotMatch(context, /Recuperacao de senha indisponivel/, 'VpsAuthContext must not report reset as unavailable');

const resetPage = fs.readFileSync('pages/auth/RedefinirSenhaPage.tsx', 'utf8');
assert.match(resetPage, /useSearchParams/, 'reset page must read token from query string');
assert.match(resetPage, /updatePassword\(password,\s*resetToken\)/, 'reset page must pass token when changing password');

const requestPage = fs.readFileSync('pages/auth/RecuperarSenhaPage.tsx', 'utf8');
assert.match(requestPage, /PasswordResetChannel/, 'request page must let the customer choose a recovery channel');
assert.match(requestPage, /Solicitação recebida/, 'request page must use an anti-enumeration success message');
assert.doesNotMatch(requestPage, /E-mail enviado!/, 'request page must not falsely claim email delivery');

const registerPage = fs.readFileSync('pages/auth/ClienteRegisterPage.tsx', 'utf8');
assert.match(registerPage, /pelo menos um e-mail ou WhatsApp/, 'registration must explain the contact requirement');
assert.match(registerPage, /phone: formData\.phone/, 'registration must send WhatsApp when supplied');

const envExample = fs.readFileSync('.env.vps.example', 'utf8');
for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'APP_PUBLIC_URL']) {
  assert.match(envExample, new RegExp(`${key}=`), `.env.vps.example must document ${key}`);
}

const checklist = fs.readFileSync('migração_VPS.md', 'utf8');
assert.match(checklist, /recuperacao de senha por e-mail/i, 'migration checklist must mention password recovery');
assert.match(checklist, /SMTP/i, 'migration checklist must mention SMTP');

console.log('VPS auth password reset static checks passed');
