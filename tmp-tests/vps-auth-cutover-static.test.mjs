import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const server = readFileSync('vps_server.cjs', 'utf8');
const authContext = readFileSync('contexts/VpsAuthContext.tsx', 'utf8');
assert.equal(existsSync('services/vpsAuthService.ts'), true, 'services/vpsAuthService.ts must exist');
const authService = readFileSync('services/vpsAuthService.ts', 'utf8');
const protectedRoute = readFileSync('components/ProtectedRoute.tsx', 'utf8');
const adminLogin = readFileSync('pages/auth/AdminLoginPage.tsx', 'utf8');

for (const route of [
  "fastify.post('/auth/login'",
  "fastify.post('/auth/register'",
  "fastify.get('/auth/me'",
  "fastify.post('/auth/password'",
]) {
  assert.match(server, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `VPS server must expose ${route}`);
}

assert.match(server, /function signVpsAuthToken\(/, 'VPS server must sign first-party auth tokens');
assert.match(server, /function verifyVpsAuthToken\(/, 'VPS server must verify first-party auth tokens');
assert.match(server, /customer_auth/, 'VPS server must persist credentials outside Supabase');
assert.doesNotMatch(
  server.slice(server.indexOf('async function getVpsBearerAuthContext'), server.indexOf('async function isAdminBearerToken')),
  /legacy provider|supabase\.co|\/auth\/v1\/user|\/rest\/v1\/customers/i,
  'admin bearer validation must not call the retired provider after auth cutover',
);

assert.doesNotMatch(authContext, /getSupabaseClient|supabase\.auth|@supabase\/supabase-js/, 'auth context must not use the retired auth provider');
assert.match(authContext, /vpsAuthService\.getSession\(/, 'auth context should restore session from VPS auth');
assert.match(authContext, /vpsAuthService\.signInWithEmail\(/, 'email login should go through VPS auth');
assert.match(authContext, /vpsAuthService\.signInWithCpf\(/, 'CPF login should go through VPS auth');
assert.match(authContext, /vpsAuthService\.createAccount\(/, 'account creation should go through VPS auth');

assert.match(authService, /localStorage/, 'VPS auth service should persist the first-party session locally');
assert.match(authService, /Authorization: `Bearer \$\{session\.token\}`/, 'VPS auth service should send bearer token to /auth/me');
assert.match(authService, /VPS_DIRECT_BASE_URL/, 'VPS auth service should call auth endpoints directly instead of the admin proxy');
assert.doesNotMatch(
  authService,
  /fetch\(buildVpsUrl\('/,
  'VPS auth service must not send /auth/login through the admin /api/vps-proxy route',
);

assert.doesNotMatch(protectedRoute, /Supabase Authentication/, 'ProtectedRoute comments must reflect VPS auth');
assert.doesNotMatch(adminLogin, /services\/supabase|supabase\.auth|signInWithPassword/, 'admin login must not call the retired provider directly');

console.log('VPS auth cutover static checks passed');
