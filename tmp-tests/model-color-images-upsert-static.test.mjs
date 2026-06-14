import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/model-color-images.ts', 'utf8');
const upsertBody = source.match(/async function upsert\(input: ModelColorImagesInput\): Promise<ModelColorImages> \{([\s\S]*?)\n\}/)?.[1] || '';

assert.match(
  upsertBody,
  /const existing = await get\(input\.model_id, input\.color_id\)/,
  'model-color image save must look up the existing VPS row before deciding between update and insert',
);

assert.match(
  upsertBody,
  /vpsClient\.patch<ModelColorImageRow>\(\s*`\/table-data\/model_color_images\/\$\{encodeURIComponent\(existingId\)\}\?pk=id`[\s\S]*payload/,
  'model-color image save must update existing rows through VPS table-data',
);

assert.match(
  upsertBody,
  /vpsClient\.post<ModelColorImageRow>\('\/table-data\/model_color_images'/,
  'model-color image save must insert new rows through VPS table-data',
);

assert.doesNotMatch(
  upsertBody,
  /new Date\(\)\.toISOString\(\)|created_at|updated_at/,
  'model-color image save must let MySQL defaults manage created_at/updated_at instead of sending ISO timestamps',
);

console.log('model-color image upsert VPS static checks passed');
