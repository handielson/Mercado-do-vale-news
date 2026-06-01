import { readFileSync } from 'node:fs';

const source = readFileSync('services/blingService.ts', 'utf8');

if (!source.includes('const model = await modelService.getById(modelId)')) {
  throw new Error('Bling model dimension push must load models through modelService.getById.');
}

if (!source.includes('const existingModel = await modelService.getById(modelId)')) {
  throw new Error('Bling model dimension pull must load existing template_values through modelService.getById.');
}

if (!source.includes('await modelService.update(modelId, {')) {
  throw new Error('Bling model dimension pull must update template_values through modelService.update.');
}

if (/supabase\s*\.\s*from\s*\(\s*['"]models['"]\s*\)/.test(source)) {
  throw new Error('blingService still reads or writes models through Supabase.');
}

console.log('bling model dimensions VPS guard passed');
