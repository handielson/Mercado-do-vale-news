import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /const blingFinanceListCache = new Map\(\);/, `${file} must keep finance list cache on the VPS`);
  assert.match(source, /function getBlingFinanceCacheKey\(query\)/, `${file} must build a deterministic finance cache key`);
  assert.match(source, /function clearBlingFinanceListCache\(\)/, `${file} must expose finance cache invalidation`);

  const financeBlockStart = source.indexOf("if (resource === 'finance')");
  assert.ok(financeBlockStart >= 0, `${file} must have the Bling finance resource`);
  const financeBlock = source.slice(financeBlockStart, source.indexOf("if (resource === 'nf-detail')", financeBlockStart));

  assert.match(financeBlock, /const forceRefresh = String\(query\?\.forceRefresh \|\| ''\) === '1';/, `${file} must honor explicit finance cache refresh`);
  assert.match(financeBlock, /const cacheKey = getBlingFinanceCacheKey\(query\);/, `${file} must cache list responses by normalized query`);
  assert.match(financeBlock, /blingFinanceListCache\.get\(cacheKey\)/, `${file} must read cached finance list responses`);
  assert.match(financeBlock, /source: 'vps-cache'/, `${file} must mark cached finance responses`);
  assert.match(financeBlock, /blingFinanceListCache\.set\(cacheKey,\s*\{[\s\S]*body: body\.json \|\| \{ data: \[\] \}/, `${file} must store successful finance list responses`);

  const mutationMatches = financeBlock.match(/clearBlingFinanceListCache\(\);/g) || [];
  assert.ok(mutationMatches.length >= 4, `${file} must clear finance cache after create, update, baixar and cancelar`);
}

console.log('bling finance VPS cache static checks ok');
