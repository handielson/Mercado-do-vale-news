import { readFileSync } from 'node:fs';

const source = readFileSync('services/dataSyncService.ts', 'utf8');

if (!source.includes('await vpsApiService.updateProduct(system_id, payload)')) {
  throw new Error('DataSyncService must update spreadsheet products through vpsApiService.updateProduct.');
}

if (!source.includes('await vpsApiService.createProduct(payload)')) {
  throw new Error('DataSyncService must insert spreadsheet products through vpsApiService.createProduct.');
}

if (/supabase\s*\.\s*from\s*\(\s*['"]products['"]\s*\)/.test(source)) {
  throw new Error('DataSyncService still writes products through Supabase.');
}

console.log('data sync products VPS guard passed');
