import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/promotionService.ts', 'utf8');

assert.doesNotMatch(
  service,
  /from ['"]\.\/supabase['"]|\.from\('promotions'\)/,
  'promotionService must not use Supabase table calls for promotions after VPS migration',
);

assert.match(
  service,
  /\/table-data\/promotions\?limit=\$\{pageSize\}&offset=\$\{offset\}/,
  'promotion reads should use explicit paged VPS table-data',
);

assert.match(
  service,
  /vpsClient\.patch<Promotion>\(`\/table-data\/promotions\/\$\{id\}`/,
  'promotion updates should use VPS table-data',
);

console.log('promotions VPS static checks passed');
