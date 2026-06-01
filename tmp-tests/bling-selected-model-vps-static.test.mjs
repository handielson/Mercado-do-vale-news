import { readFileSync } from 'node:fs';

const source = readFileSync('services/blingService.ts', 'utf8');

if (!source.includes('await modelService.getById(modelId)')) {
  throw new Error('blingService must load the selected import model through modelService.getById.');
}

if (!source.includes('await brandService.getById(modelData.brand_id)')) {
  throw new Error('blingService must resolve the selected model brand through brandService.getById.');
}

if (/supabase\s*\.\s*from\s*\(\s*['"]models['"]\s*\)\s*[\s\S]{0,180}select\('name, description, brand_id, brands\(name\)'/.test(source)) {
  throw new Error('blingService still reads the selected model through Supabase.');
}

console.log('bling selected model VPS guard passed');
