import assert from 'node:assert/strict';
import { fetchAllSEOProducts } from '../pages/admin/settings/seoDashboardData.js';

function createSupabaseMock(totalRows) {
  const calls = [];

  return {
    calls,
    from(table) {
      assert.equal(table, 'products');
      const query = {
        select(columns) {
          assert.equal(columns, 'id, name, slug, meta_title, meta_description, status, description');
          return query;
        },
        order(column, options) {
          assert.equal(column, 'created_at');
          assert.deepEqual(options, { ascending: false });
          return query;
        },
        async range(from, to) {
          calls.push({ from, to });
          const pageSize = to - from + 1;
          const remaining = Math.max(totalRows - from, 0);
          const count = Math.min(pageSize, remaining);
          return {
            data: Array.from({ length: count }, (_, index) => ({
              id: `product-${from + index}`,
              name: `Produto ${from + index}`,
              slug: `produto-${from + index}`,
              meta_title: 'Titulo',
              meta_description: 'Descricao',
              status: 'active',
              description: 'Descricao longa',
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
const products = await fetchAllSEOProducts(supabase, 1000);

assert.equal(products.length, 2505);
assert.deepEqual(supabase.calls, [
  { from: 0, to: 999 },
  { from: 1000, to: 1999 },
  { from: 2000, to: 2999 },
]);
