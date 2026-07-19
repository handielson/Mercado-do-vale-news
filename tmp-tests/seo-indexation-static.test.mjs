import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync('index.html', 'utf8');
const robots = readFileSync('public/robots.txt', 'utf8');
const faviconHook = readFileSync('hooks/useFavicon.ts', 'utf8');
const productPage = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(index, /<link rel="canonical" href="https:\/\/www\.mercadodovale\.com\.br\/" \/>/);
assert.doesNotMatch(index, /https:\/\/mercadodovale\.com\.br\//);
assert.match(index, /"@type": "Organization"/);
assert.match(index, /"@type": "WebSite"/);
assert.match(robots, /Sitemap: https:\/\/www\.mercadodovale\.com\.br\/sitemap\.xml/);
assert.doesNotMatch(faviconHook, /document\.title\s*=/);
assert.match(productPage, /\.replace\(\/<h1\\b/);

const helmetBlock = productPage.match(/<Helmet>[\s\S]*?<\/Helmet>/)?.[0] || '';
assert.doesNotMatch(helmetBlock, /application\/ld\+json/);

console.log('SEO indexation static checks passed.');
