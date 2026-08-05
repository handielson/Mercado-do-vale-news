import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.get\('\/api\/seo-produto'/, `${file} must expose /api/seo-produto on Fastify`);
  assert.match(source, /function\s+stripSeoHtml\(/, `${file} must strip HTML from product descriptions`);
  assert.match(source, /function\s+escapeSeoHtml\(/, `${file} must escape values injected into HTML attributes`);
  assert.match(source, /function\s+buildSeoBaseUrl\(/, `${file} must derive canonical URLs from forwarded headers`);
  assert.match(source, /function\s+normalizeSeoImages\(/, `${file} must normalize JSON/string image arrays`);
  assert.match(source, /async function\s+loadSeoProductBySlug\(/, `${file} must load the product directly from MySQL`);
  assert.match(source, /WHERE slug = \?[\s\S]*WHERE id = \?/, `${file} must support slug lookup with UUID fallback`);
  const uuidMatcherBody = source.match(/function isUuidLike\(value\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(uuidMatcherBody, `${file} must expose the UUID matcher used by SEO lookup`);
  const isUuidLike = new Function('value', uuidMatcherBody);
  assert.equal(isUuidLike('efbf25ff-c705-4034-8d37-766be5a8c0fa'), true, `${file} must recognize real product UUIDs`);
  assert.equal(isUuidLike('poco-x8-pro'), false, `${file} must not treat slugs as UUIDs`);
  assert.match(source, /meta property="og:type" content="product"/, `${file} must inject product Open Graph tags`);
  assert.match(source, /<link rel="canonical" href="\$\{url\}" \/>/, `${file} must inject a canonical product URL`);
  assert.match(source, /application\/ld\+json/, `${file} must inject Schema.org JSON-LD`);
  assert.match(source, /Number\(value \|\| 0\) \/ 100/, `${file} must convert stored cent prices to BRL decimal prices`);
  assert.match(source, /removeExistingSeoHeadTags/, `${file} must remove existing home canonical and social meta tags before injection`);
  assert.match(source, /property=\["'\]og:/, `${file} must explicitly remove old Open Graph tags`);
  assert.match(source, /name=\["'\]twitter:/, `${file} must explicitly remove old Twitter card tags`);
  assert.match(source, /rel=\["'\]canonical/, `${file} must explicitly remove old canonical tags`);
  assert.match(source, /s-maxage=60, stale-while-revalidate=300/, `${file} must preserve product SEO cache policy`);
  assert.match(source, /if \(!product\)[\s\S]*\.code\(410\)/, `${file} must return 410 for products that no longer exist`);
  assert.match(source, /name="robots" content="noindex, follow"/, `${file} must mark gone product HTML as noindex`);
  assert.match(source, /href="\/produtos"/, `${file} must guide visitors from gone products to the current catalog`);
  assert.match(source, /buildCopyableDebug\('seo-produto'/, `${file} must return copyable debug details on failures`);
}

console.log('vps seo-produto Fastify static checks ok');
