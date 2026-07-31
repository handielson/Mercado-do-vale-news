import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/blingService.ts', 'utf8');
const page = readFileSync('pages/admin/settings/BlingPage.tsx', 'utf8');
const serverJs = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');

assert.match(service, /resolveBlingImportSelection\(selectedProducts, availableProducts\)/);
assert.match(service, /localIdByBlingId\.get\(blingParentId\)/);
assert.match(service, /row\.is_parent = structuralParent/);
assert.match(service, /for \(let offset = 0; offset < 50000; offset \+= existingPageSize\)/);
assert.match(page, /toggleBlingSelectionGroup\(prev, id, blingProducts\)/);
assert.match(page, /resolveBlingImportSelection\(selectedProducts, blingProducts\)/);

for (const source of [serverJs, serverCjs]) {
  assert.match(source, /WHERE p\.bling_id=\? AND \(p\.company_id <=> \? OR p\.company_id IS NULL\)/);
  assert.match(source, /SELECT COUNT\(\*\) FROM units u WHERE u\.product_id = p\.id/);
  assert.match(source, /p\.id = existingByBling\[0\]\.id/);
  assert.match(source, /is_parent=IF\(VALUES\(is_parent\) IS NULL, is_parent, VALUES\(is_parent\)\)/);
}
assert.equal(serverJs, serverCjs, 'vps_server.js and vps_server.cjs must stay synchronized');

console.log('bling parent and duplicate guard static tests passed');
