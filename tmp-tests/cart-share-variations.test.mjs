import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as esbuild from '../node_modules/esbuild/lib/main.js';

const outdir = './tmp-tests/.bundle-cart-share';
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const siblingRows = [
  { specs: { color: 'Amarelo', storage: '128GB', material: 'Silicone' } },
  { specs: { color: 'Azul Claro', storage: '256GB', material: 'Silicone' } },
];

await esbuild.build({
  entryPoints: ['./utils/cartShareUtils.ts'],
  outfile: `${outdir}/cartShareUtils.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  plugins: [{
    name: 'mock-app-services',
    setup(build) {
      build.onResolve({ filter: /^@\/services\/supabase$/ }, () => ({ path: 'supabase', namespace: 'mock' }));
      build.onResolve({ filter: /^@\/services\/installmentCalculator$/ }, () => ({ path: 'installments', namespace: 'mock' }));
      build.onLoad({ filter: /^supabase$/, namespace: 'mock' }, () => ({
        loader: 'js',
        contents: `
          const rows = ${JSON.stringify(siblingRows)};
          export const supabase = {
            from() {
              const chain = {
                select() { return chain; },
                eq() { return chain; },
                gt() { return Promise.resolve({ data: rows }); },
              };
              return chain;
            }
          };
        `,
      }));
      build.onLoad({ filter: /^installments$/, namespace: 'mock' }, () => ({
        loader: 'js',
        contents: `
          export async function calculateInstallments(total) {
            return [
              { installments: 1, value: total, total },
              { installments: 12, value: Math.round(total / 12), total },
            ];
          }
          export function formatPrice(cents) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
          }
        `,
      }));
    },
  }],
});

const { generateBudgetText } = await import(pathToFileURL(`${process.cwd()}/${outdir}/cartShareUtils.mjs`).href);

const text = await generateBudgetText([{
  product: {
    id: 'selected',
    name: 'Capa Case Silicone Aveludada para Mi 13 Lite',
    slug: 'capa-case-silicone-aveludada-para-mi-13-lite-amarelo',
    model_id: 'mi-13-lite-case',
    specs: { color: 'Amarelo', storage: '128GB', material: 'Silicone' },
  },
  unit_price: 2890,
  quantity: 1,
}]);

assert.match(text, /Cores disponíveis: Amarelo, Azul Claro/);
assert.match(text, /Memórias disponíveis: 128GB, 256GB/);
assert.match(text, /Materiais disponíveis: Silicone/);
assert.match(text, /https:\/\/mercadodovale\.com\.br\/produto\/capa-case-silicone-aveludada-para-mi-13-lite-amarelo/);

console.log('cart share variations test passed');
