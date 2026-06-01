import { readFileSync } from 'node:fs';

const source = readFileSync('services/blingService.ts', 'utf8');
const importBody = source;

if (!importBody.includes('await vpsApiService.updateProduct(id, fields)')) {
  throw new Error('Bling import update helper must write products through vpsApiService.updateProduct.');
}

if (!importBody.includes('await vpsApiService.createProduct(rowWithId)')) {
  throw new Error('Bling import insert helper must write products through vpsApiService.createProduct.');
}

if (/supabase\s*\.\s*from\s*\(\s*['"]products['"]\s*\)/.test(importBody)) {
  throw new Error('Bling import still writes products through Supabase.');
}

console.log('bling import products VPS guard passed');
