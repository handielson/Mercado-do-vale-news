import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.get\('\/api\/sitemap'/, `${file} must expose /api/sitemap on Fastify`);
  assert.match(source, /function\s+escapeSitemapXml\(/, `${file} must escape XML values in sitemap`);
  assert.match(source, /function\s+isLocalSitemapHost\(/, `${file} must only allow http sitemap URLs for local hosts`);
  assert.match(source, /function\s+buildSitemapBaseUrl\(/, `${file} must derive sitemap base URL from forwarded headers`);
  assert.match(source, /rawProtocol === 'http' && isLocalSitemapHost\(host\) \? 'http' : 'https'/, `${file} must force https canonical sitemap URLs outside localhost`);
  assert.match(source, /FROM products[\s\S]*slug IS NOT NULL[\s\S]*exclude_from_seo/, `${file} must load only sitemap-safe products`);
  assert.match(source, /application\/xml; charset=utf-8|text\/xml; charset=utf-8/, `${file} must return XML content type`);
  assert.match(source, /s-maxage=3600, stale-while-revalidate=86400/, `${file} must preserve sitemap cache policy`);
  assert.match(source, /buildCopyableDebug\('sitemap'/, `${file} must return copyable debug details on sitemap failures`);
}

console.log('vps sitemap Fastify static checks ok');
