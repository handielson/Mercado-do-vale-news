import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tools/audit-legacy-deploy-removal-readiness.mjs', 'utf8');

assert.match(source, /mercadodovale\.com\.br/, 'readiness audit must inspect apex domain');
assert.match(source, /www\.mercadodovale\.com\.br/, 'readiness audit must inspect www domain');
assert.match(source, /76\.13\.232\.162/, 'readiness audit must check the VPS IP');
assert.match(source, /76\.76\.21\.21/, 'readiness audit must recognize the legacy platform apex IP');
assert.match(source, /resolveCname/, 'readiness audit must inspect CNAME records');
assert.match(source, /Promise\.race/, 'readiness audit must timeout DNS checks instead of hanging the checklist');
assert.match(source, /Promise\.all/, 'readiness audit must run DNS checks in parallel');
assert.match(source, /dns_timeout/, 'readiness audit must label DNS timeout failures clearly');
assert.match(source, /process\.exit\(0\)/, 'readiness audit must exit after printing JSON so pending DNS handles cannot hang');
assert.match(source, /legacy_crons_disabled/, 'readiness audit must report legacy cron state');
assert.match(source, /cors_allows_legacy_fallback/, 'readiness audit must report CORS fallback state');
assert.match(source, /callbacks OAuth Bling e Shopee/, 'readiness audit must keep OAuth callbacks in the external checklist');
assert.match(source, /webhooks Bling, Shopee e Mercado Pago/, 'readiness audit must keep webhook cutover in the external checklist');
assert.match(source, /external_panel_confirmation/, 'readiness audit must print the read-only external panel confirmation plan');
assert.match(source, /manual_panel_read_only/, 'external panel checks must be explicitly read-only');
assert.match(source, /https:\/\/www\.mercadodovale\.com\.br\/api\/auth\/callback\/bling/, 'Bling OAuth callback must point to the VPS public host');
assert.match(source, /https:\/\/www\.mercadodovale\.com\.br\/api\/bling-webhook/, 'Bling webhook must point to the VPS public host');
assert.match(source, /https:\/\/www\.mercadodovale\.com\.br\/api\/shopee\?action=callback/, 'Shopee OAuth callback must point to the VPS public host');
assert.match(source, /https:\/\/www\.mercadodovale\.com\.br\/api\/shopee-webhook/, 'Shopee webhook must point to the VPS public host');
assert.match(source, /https:\/\/www\.mercadodovale\.com\.br\/api\/mercadopago-webhook/, 'Mercado Pago webhook must point to the VPS public host');
assert.doesNotMatch(source, /vercel\.app.*expected_urls|expected_urls[\s\S]*vercel\.app/, 'expected external URLs must not point to Vercel');

console.log('legacy deploy removal readiness static checks ok');
