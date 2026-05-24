import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tools/audit-legacy-deploy-removal-readiness.mjs', 'utf8');

assert.match(source, /mercadodovale\.com\.br/, 'readiness audit must inspect apex domain');
assert.match(source, /www\.mercadodovale\.com\.br/, 'readiness audit must inspect www domain');
assert.match(source, /76\.13\.232\.162/, 'readiness audit must check the VPS IP');
assert.match(source, /76\.76\.21\.21/, 'readiness audit must recognize the legacy platform apex IP');
assert.match(source, /resolveCname/, 'readiness audit must inspect CNAME records');
assert.match(source, /legacy_crons_disabled/, 'readiness audit must report legacy cron state');
assert.match(source, /cors_allows_legacy_fallback/, 'readiness audit must report CORS fallback state');
assert.match(source, /callbacks OAuth Bling e Shopee/, 'readiness audit must keep OAuth callbacks in the external checklist');
assert.match(source, /webhooks Bling, Shopee e Mercado Pago/, 'readiness audit must keep webhook cutover in the external checklist');

console.log('legacy deploy removal readiness static checks ok');
