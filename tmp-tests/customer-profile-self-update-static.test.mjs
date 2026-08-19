import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const servers = ['vps_server.cjs', 'vps_server.js'].map((file) => [file, readFileSync(file, 'utf8')]);
const authService = readFileSync('services/vpsAuthService.ts', 'utf8');
const authContext = readFileSync('contexts/VpsAuthContext.tsx', 'utf8');

for (const [file, source] of servers) {
  const route = source.match(/fastify\.patch\('\/auth\/profile'[\s\S]*?fastify\.post\('\/auth\/password'/)?.[0] || '';
  assert(route, `${file}: authenticated customer profile route must exist`);
  assert.match(route, /getVpsBearerAuthContext\(request\)/, `${file}: profile update must use the bearer session`);
  assert.match(route, /WHERE id = \? LIMIT 1'[\s\S]*?\[auth\.customerId\]/, `${file}: profile update must load only the logged customer`);
  assert.match(route, /UPDATE customers[\s\S]*?WHERE id = \?`[\s\S]*?auth\.customerId/, `${file}: profile update must write only the logged customer`);
  assert.doesNotMatch(route, /body\.(?:id|customer_id)/, `${file}: profile ownership must not come from request body`);
  assert.match(route, /Este WhatsApp ja esta vinculado a outra conta/, `${file}: duplicate recovery phones must be rejected`);
  assert.match(route, /Mantenha pelo menos email ou WhatsApp/, `${file}: at least one recovery contact must remain`);
  assert.doesNotMatch(route, /customer_type|cpf_cnpj|admin_notes|is_active/, `${file}: self-service route must not mutate protected fields`);
}

assert.match(authService, /async updateProfile\(data: Partial<Customer>\)[\s\S]*?requestAuth\('\/auth\/profile'[\s\S]*?method: 'PATCH'/, 'auth service must use the customer-owned profile endpoint');
assert.match(authContext, /const updated = await vpsAuthService\.updateProfile\(data\)/, 'profile context must use authenticated self-service update');
assert.doesNotMatch(authContext, /const updated = await customerService\.update\(customer\.id, data as any\)/, 'profile context must not use generic admin table mutation');

console.log('customer profile self-update static checks passed');
