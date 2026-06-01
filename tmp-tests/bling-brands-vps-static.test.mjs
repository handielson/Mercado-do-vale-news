import { readFileSync } from 'node:fs';

const source = readFileSync('services/blingService.ts', 'utf8');

if (!source.includes("import { brandService } from './brands';")) {
  throw new Error('blingService must use brandService for brand resolution.');
}

if (!source.includes('brandService.list()') || !source.includes('brandService.create(')) {
  throw new Error('blingService brand resolution must read/create brands through brandService.');
}

if (/supabase\s*\.\s*from\s*\(\s*['"]brands['"]\s*\)/.test(source)) {
  throw new Error('blingService still reads or writes brands through Supabase.');
}

console.log('bling brands VPS guard passed');
