import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'services/model-color-images.ts',
  'services/modelColorImages.ts',
  'services/modelImageCache.ts',
  'services/catalogService.ts',
  'services/catalogSectionsService.ts',
];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /from\('model_color_images'\)/, `${file} must not read/write model_color_images via Supabase`);
}

const primaryService = fs.readFileSync('services/model-color-images.ts', 'utf8');
assert.match(primaryService, /vpsClient\.get<TableDataResponse<ModelColorImageRow>>\(/, 'primary service must read model_color_images from VPS table-data');
assert.match(primaryService, /\/table-data\/model_color_images\?limit=\$\{pageSize\}&offset=\$\{offset\}/, 'primary service must page model_color_images through table-data');
assert.match(primaryService, /vpsClient\.post<ModelColorImageRow>\('\/table-data\/model_color_images'/, 'primary service must create model_color_images through VPS');
assert.match(primaryService, /vpsClient\.patch<ModelColorImageRow>\(\s*`\/table-data\/model_color_images\/\$\{encodeURIComponent\(existingId\)\}\?pk=id`/, 'primary service must update model_color_images through VPS');
assert.match(primaryService, /vpsClient\.delete\(`\/table-data\/model_color_images\/\$\{encodeURIComponent\(row\.id\)\}\?pk=id`\)/, 'primary service must delete model_color_images through VPS');

const legacyService = fs.readFileSync('services/modelColorImages.ts', 'utf8');
assert.match(legacyService, /from '\.\/model-color-images'/, 'legacy modelColorImages service should delegate to the VPS primary service');

console.log('model_color_images VPS static guard OK');
