import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/models.ts', 'utf8');
const server = readFileSync('vps_server.js', 'utf8');

assert.match(
  service,
  /vpsClient\.get<Model\[\]>\('\/models'\)/,
  'list() must load models through the VPS endpoint instead of a frontend Supabase query',
);

assert.match(
  service,
  /vpsClient\.get<Model\[\]>\(withBrandQuery\(brandId\)\)/,
  'listByBrand() must load brand-filtered models through the VPS endpoint',
);

assert.match(
  server,
  /const MODEL_PAGE_SIZE = 1000/,
  'VPS model endpoint must keep paginated Supabase REST reads to avoid row caps',
);

assert.match(
  server,
  /for \(let offset = 0; ; offset \+= MODEL_PAGE_SIZE\)[\s\S]*limit=\$\{MODEL_PAGE_SIZE\}[\s\S]*offset=\$\{offset\}/,
  'VPS model endpoint must request pages until the final partial page',
);

assert.doesNotMatch(
  service,
  /fetchAllModelRows|\.from\('models'\)/,
  'frontend model service must not contain direct model table pagination/query code',
);

console.log('models service VPS pagination static test ok');
