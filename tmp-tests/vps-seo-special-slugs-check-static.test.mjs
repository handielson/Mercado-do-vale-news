import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'tmp-tests/vps-seo-special-slugs-check.cjs';
const source = readFileSync(file, 'utf8');

assert.match(source, /http:\/\/76\.13\.232\.162\/sitemap\.xml/, 'script must default to the VPS staging sitemap by IP');
assert.match(source, /staging\.mercadodovale\.com\.br/, 'script must send the staging Host header');
assert.match(source, /SEO_SPECIAL_SLUGS_LIVE/, 'script must require an explicit live-read flag');
assert.match(source, /parseSitemapUrls/, 'script must parse sitemap URLs');
assert.match(source, /selectSpecialProductUrls/, 'script must select representative special product URLs');
assert.match(source, /\/produto\//, 'script must only inspect product URLs');
assert.match(source, /application\/ld\+json/, 'script must validate JSON-LD presence in product HTML');
assert.match(source, /rel="canonical"/, 'script must validate canonical tags');
assert.match(source, /og:type/, 'script must validate product Open Graph tags');
assert.match(source, /sanitizeSeoSpecialSlugResult/, 'script must sanitize inspected URLs and HTML details');
assert.match(source, /live_read:\s*false/, 'script must report no live read for skipped/dry-run paths');
assert.doesNotMatch(source, /method:\s*'POST'|method:\s*"POST"/, 'script must never use POST');
assert.doesNotMatch(source, /token|Authorization|SYNC|SECRET/, 'script must not use secrets or auth headers');

console.log('vps SEO special slugs static checks ok');
