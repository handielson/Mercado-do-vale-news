import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('pages/admin/settings/SEODashboardPage.tsx'), 'utf8');

const start = source.indexOf('const handleGenerateMissingSlugs = async () => {');
const end = source.indexOf('const handleGenerateMissingMetaTags = async () => {');
assert(start >= 0 && end > start, 'Could not isolate handleGenerateMissingSlugs block');

const block = source.slice(start, end);

assert(
  !/\.from\('products'\)[\s\S]{0,300}\.select\('id'\)/.test(block),
  'SEO slug generation should not read products from Supabase to check slug uniqueness',
);

assert(
  /new Set\(/.test(block) && /usedSlugs/.test(block),
  'SEO slug generation should derive used slugs from the VPS-loaded products state',
);

assert(
  /supabase\.from\('products'\)\.update\(\{\s*slug: slugToUse\s*\}\)/.test(block),
  'SEO slug generation should keep the existing Supabase slug write until the write path is migrated',
);

console.log('SEO dashboard slug uniqueness reads from VPS-loaded state');
