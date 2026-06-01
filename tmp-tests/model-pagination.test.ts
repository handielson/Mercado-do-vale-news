import assert from 'node:assert/strict';
import { fetchAllModelRows } from '../services/modelPagination.ts';

function createVpsMock(rows: any[]) {
  const calls: string[] = [];

  return {
    calls,
    async get(path: string) {
      calls.push(path);
      return rows;
    },
  };
}

const vps = createVpsMock([
  { id: 'model-1', name: 'Modelo 1' },
  { id: 'model-2', name: 'Modelo 2' },
]);
const rows = await fetchAllModelRows(vps, {
  companyId: 'company-1',
});

assert.equal(rows.length, 2);
assert.deepEqual(vps.calls, ['/models?company_id=company-1']);

const brandVps = createVpsMock([]);
await fetchAllModelRows(brandVps, {
  companyId: 'company-1',
  brandId: 'brand-1',
});

assert.deepEqual(brandVps.calls, ['/models?company_id=company-1&brand_id=brand-1']);

const source = await import('node:fs').then(({ readFileSync }) => readFileSync('services/modelPagination.ts', 'utf8'));
assert(!source.includes(".from('models')"), 'model pagination must not read models directly from Supabase');

console.log('model pagination ok');
