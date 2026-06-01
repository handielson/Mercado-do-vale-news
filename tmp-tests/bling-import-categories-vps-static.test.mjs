import { readFileSync } from 'node:fs';

const source = readFileSync('services/blingService.ts', 'utf8');
const importBody = source;

if (!importBody.includes('const categoryById = new Map(allVpsCategories.map')) {
  throw new Error('Bling import must validate categories from categoryService.list().');
}

if (!importBody.includes('const catData = categoryById.get(categoryId)')) {
  throw new Error('Bling import must read category margins from the VPS category map.');
}

if (/supabase\s*\.\s*from\s*\(\s*['"]categories['"]\s*\)/.test(importBody)) {
  throw new Error('Bling import still reads or writes categories through Supabase.');
}

console.log('bling import categories VPS guard passed');
