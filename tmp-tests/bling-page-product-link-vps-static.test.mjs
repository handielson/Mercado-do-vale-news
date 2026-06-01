import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/settings/BlingPage.tsx', 'utf8');

if (!source.includes("vpsApiService.updateProduct(productId, { bling_id: match.id })")) {
  throw new Error('BlingPage reimportProduct must link bling_id through vpsApiService.updateProduct.');
}

const reimportProductBody = source.match(/async function reimportProduct[\s\S]*?function /)?.[0] || '';
if (/supabase\s*\.\s*from\s*\(\s*['"]products['"]\s*\)/.test(reimportProductBody)) {
  throw new Error('BlingPage reimportProduct still writes products through Supabase.');
}

console.log('bling page product link VPS guard passed');
