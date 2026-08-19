import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import googleAuth from '../services/customerGoogleAuthServer.cjs';

const secret = 'test-secret';
const now = 1_800_000_000;
const signed = googleAuth.signGoogleState({ nonce: 'nonce-1', next: '/carrinho', exp: now + 60 }, secret);
assert.deepEqual(googleAuth.verifyGoogleState(signed, secret, now), {
  nonce: 'nonce-1',
  next: '/carrinho',
  exp: now + 60,
});
assert.equal(googleAuth.verifyGoogleState(`${signed}x`, secret, now), null);
assert.equal(googleAuth.verifyGoogleState(signed, 'wrong-secret', now), null);
assert.equal(googleAuth.verifyGoogleState(signed, secret, now + 61), null);
assert.equal(googleAuth.safeGoogleNextPath('//malicious.example'), '/');
assert.equal(googleAuth.safeGoogleNextPath('https://malicious.example'), '/');
assert.equal(googleAuth.safeGoogleNextPath('/perfil?tab=contato'), '/perfil?tab=contato');
assert.equal(googleAuth.getGoogleLoginConfig({}).configured, false);
assert.equal(googleAuth.getGoogleLoginConfig({
  GOOGLE_LOGIN_CLIENT_ID: 'client-id',
  GOOGLE_LOGIN_CLIENT_SECRET: 'client-secret',
  GOOGLE_LOGIN_REDIRECT_URI: 'https://api.example.com/auth/google/callback',
}).configured, true);

const [context, service, callback, login, deploy, cjs, js] = await Promise.all([
  readFile(new URL('../contexts/VpsAuthContext.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../services/vpsAuthService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../pages/auth/AuthCallbackPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../pages/auth/ClienteLoginPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../deploy-vps-server-only.cjs', import.meta.url), 'utf8'),
  readFile(new URL('../vps_server.cjs', import.meta.url), 'utf8'),
  readFile(new URL('../vps_server.js', import.meta.url), 'utf8'),
]);

assert.match(context, /vpsAuthService\.startGoogleSignIn/);
assert.doesNotMatch(context, /Login com Google esta temporariamente indisponivel/);
assert.match(service, /completeGoogleSignIn/);
assert.match(callback, /Confirmando login com Google/);
assert.match(callback, /window\.history\.replaceState/);
assert.match(login, /google_error/);
assert.match(deploy, /customerGoogleAuthServer\.cjs/);
assert.match(deploy, /Google customer login configuration ready/);
for (const source of [cjs, js]) {
  assert.match(source, /registerCustomerGoogleAuthRoutes/);
  assert.match(source, /hasField\('cpf_cnpj'\)/);
  assert.match(source, /SET name = \?, cpf_cnpj = \?, phone = \?/);
  assert.match(source, /Este CPF\/CNPJ ja esta vinculado a outra conta/);
  assert.match(source, /UPDATE customer_auth\s+SET cpf_cnpj = \?/);
}

const server = await readFile(new URL('../services/customerGoogleAuthServer.cjs', import.meta.url), 'utf8');
assert.match(server, /code_challenge_method', 'S256'/);
assert.match(server, /HttpOnly; Secure; SameSite=Lax/);
assert.match(server, /identity\.aud !== config\.clientId/);
assert.match(server, /email_verified/);
assert.match(server, /LOWER\(ca\.email\)/);
assert.match(server, /LOWER\(email\) = \? LIMIT 2/);
assert.match(server, /normalizeAuthCustomerType\(customer\.customer_type\) === 'ADMIN'/);
assert.match(server, /admin_login_required/);
assert.match(server, /auth\/google\/start'[\s\S]*?rateLimit: \{ max: 30/);
assert.doesNotMatch(server, /supabase/i);

console.log('customer-google-auth.test.mjs: ok');
