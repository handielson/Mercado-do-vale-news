import { readFileSync } from 'node:fs';

const source = readFileSync('services/dataSyncService.ts', 'utf8');

if (!source.includes("import { modelService } from './models';")) {
  throw new Error('DataSyncService must import modelService for VPS model lookups.');
}

if (!source.includes('modelService.list()')) {
  throw new Error('DataSyncService must load models through modelService.list().');
}

if (/supabase\s*\.\s*from\s*\(\s*['"]models['"]\s*\)/.test(source)) {
  throw new Error('DataSyncService still reads models through Supabase.');
}

console.log('data sync models VPS guard passed');
