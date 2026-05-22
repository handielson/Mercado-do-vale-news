import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'tmp-tests/vps-seo-production-host-check.cjs';
const source = readFileSync(file, 'utf8');

assert.match(source, /http:\/\/76\.13\.232\.162/, 'script must default to the VPS public IP');
assert.match(source, /mercadodovale\.com\.br/, 'script must validate the production host header');
assert.match(source, /SEO_PRODUCTION_HOST_LIVE/, 'script must require an explicit live-read flag');
assert.match(source, /parseSitemapUrls/, 'script must parse sitemap URLs');
assert.match(source, /\/sitemap\.xml/, 'script must validate sitemap.xml');
assert.match(source, /\/produto\//, 'script must validate product SEO HTML');
assert.match(source, /expected_host/, 'script must report the expected production host');
assert.match(source, /redirect_ok/, 'script must report canonical redirect validation for the root host');
assert.match(source, /www\.mercadodovale\.com\.br/, 'script must know the canonical www production host');
assert.match(source, /canonical_host/, 'script must validate canonical host');
assert.match(source, /application\/ld\+json/, 'script must validate JSON-LD on product HTML');
assert.match(source, /og:type/, 'script must validate product Open Graph tags');
assert.match(source, /live_read:\s*false/, 'script must report no live read for skipped/dry-run paths');
assert.doesNotMatch(source, /method:\s*'POST'|method:\s*"POST"/, 'script must never use POST');
assert.doesNotMatch(source, /token|Authorization|SYNC|SECRET/, 'script must not use secrets or auth headers');

console.log('vps SEO production host static checks ok');
