import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/model-color-images.ts', 'utf8');
const upsertBody = source.match(/async function upsert\(input: ModelColorImagesInput\): Promise<ModelColorImages> \{([\s\S]*?)\n\}/)?.[1] || '';
const getBody = source.match(/async function get\(modelId: string, colorId: string\): Promise<ModelColorImages \| null> \{([\s\S]*?)\n\}/)?.[1] || '';

assert.doesNotMatch(
  upsertBody,
  /\.upsert\(/,
  'model-color image save must not depend on a Supabase unique constraint for company_id/model_id/color_id'
);

assert.match(
  upsertBody,
  /\.select\('id'\)[\s\S]*\.eq\('company_id', companyId\)[\s\S]*\.eq\('model_id', input\.model_id\)[\s\S]*\.eq\('color_id', input\.color_id\)/,
  'model-color image save must look up the existing row before deciding between update and insert'
);

assert.match(
  upsertBody,
  /existingId[\s\S]*\.update\(payload\)[\s\S]*\.insert\(payload\)/,
  'model-color image save must update existing rows and insert only when none exists'
);

assert.match(
  getBody,
  /\.order\('updated_at', \{ ascending: false \}\)[\s\S]*\.limit\(1\)[\s\S]*\.maybeSingle\(\)/,
  'model-color image reads must tolerate legacy duplicate rows by reading the newest row'
);

console.log('model-color image upsert static checks passed');
