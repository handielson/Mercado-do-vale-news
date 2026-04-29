import assert from 'node:assert/strict';
import { fetchAllModelRows } from '../services/modelPagination.ts';

function createSupabaseMock(totalRows: number) {
  const calls: Array<{ from: number; to: number }> = [];
  const filters: Array<{ column: string; value: string }> = [];

  return {
    calls,
    filters,
    from(table: string) {
      assert.equal(table, 'models');

      const query = {
        select(columns: string) {
          assert.equal(columns, '*');
          return query;
        },
        eq(column: string, value: string) {
          filters.push({ column, value });
          return query;
        },
        order(column: string) {
          assert.equal(column, 'name');
          return query;
        },
        async range(from: number, to: number) {
          calls.push({ from, to });

          const pageSize = to - from + 1;
          const remaining = Math.max(totalRows - from, 0);
          const count = Math.min(pageSize, remaining);

          return {
            data: Array.from({ length: count }, (_, index) => ({
              id: `model-${from + index}`,
              name: `Modelo ${from + index}`,
            })),
            error: null,
          };
        },
      };

      return query;
    },
  };
}

const supabase = createSupabaseMock(2505);
const rows = await fetchAllModelRows(supabase, {
  companyId: 'company-1',
  pageSize: 1000,
});

assert.equal(rows.length, 2505);
assert.deepEqual(supabase.calls, [
  { from: 0, to: 999 },
  { from: 1000, to: 1999 },
  { from: 2000, to: 2999 },
]);
assert.deepEqual(supabase.filters, [
  { column: 'company_id', value: 'company-1' },
  { column: 'company_id', value: 'company-1' },
  { column: 'company_id', value: 'company-1' },
]);

const brandSupabase = createSupabaseMock(2);
await fetchAllModelRows(brandSupabase, {
  companyId: 'company-1',
  brandId: 'brand-1',
  pageSize: 1000,
});

assert.deepEqual(brandSupabase.filters, [
  { column: 'company_id', value: 'company-1' },
  { column: 'brand_id', value: 'brand-1' },
]);

console.log('model pagination ok');
