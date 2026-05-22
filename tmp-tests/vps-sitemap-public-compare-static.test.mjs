import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-sitemap-public-compare.cjs', 'utf8');

assert.match(source, /https:\/\/mercadodovale\.com\.br\/sitemap\.xml/, 'comparator must read the current production sitemap');
assert.match(source, /http:\/\/76\.13\.232\.162\/sitemap\.xml/, 'comparator must read the VPS staging sitemap by IP');
assert.match(source, /Host: VPS_HOST/, 'comparator must send staging Host header to Nginx');
assert.match(source, /<loc>\(\[\^<\]\+\)<\\\/loc>/, 'comparator must parse sitemap loc entries');
assert.match(source, /count_delta/, 'comparator must report URL count delta');
assert.doesNotMatch(source, /Authorization|CRON_SECRET|SUPABASE|BLING|SHOPEE|MERCADO_PAGO/, 'comparator must not use secrets or private tokens');

console.log('vps-sitemap-public-compare-static ok');
