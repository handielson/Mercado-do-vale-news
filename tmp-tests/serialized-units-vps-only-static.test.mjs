import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminPage = fs.readFileSync(path.join(root, 'pages/admin/inventory/SerializedUnitsPage.tsx'), 'utf8');
const publicPage = fs.readFileSync(path.join(root, 'pages/store/OrderTrackingPage.tsx'), 'utf8');
const unitService = fs.readFileSync(path.join(root, 'services/units.ts'), 'utf8');
const vpsApiService = fs.readFileSync(path.join(root, 'services/vpsApiService.ts'), 'utf8');
const vpsServer = fs.readFileSync(path.join(root, 'vps_server.cjs'), 'utf8');
const auditor = fs.readFileSync(path.join(root, 'tools/audit-supabase-operational-dependencies.mjs'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(adminPage.includes('unitService.listAll'), 'admin serialized units page should list units through unitService');
assert(!adminPage.includes(".from('units')"), 'admin serialized units page must not read units from Supabase');
assert(!adminPage.includes('async function getCompanyId'), 'admin serialized units page should not keep a local Supabase company lookup');

assert(publicPage.includes('unitService.listByIds'), 'public order tracking should fetch released serialized units through unitService');
assert(!publicPage.includes("from('units')"), 'public order tracking must not read units from Supabase');

assert(unitService.includes('async listAll'), 'unitService should expose listAll for admin serialized units');
assert(unitService.includes('async listByIds'), 'unitService should expose listByIds for public order tracking');
assert(vpsApiService.includes('async getUnits('), 'vpsApiService should expose generic getUnits filters');
assert(vpsServer.includes('ids') && vpsServer.includes('LEFT JOIN products p ON p.id = u.product_id'), 'VPS /units endpoint should support id filtering and product hydration');
assert(!auditor.includes("'units',"), 'units should leave the temporary inventory allowlist');

console.log('serialized units VPS-only static checks passed');
