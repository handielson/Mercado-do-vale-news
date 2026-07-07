import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = {
  index: readFileSync('index.html', 'utf8'),
  productPage: readFileSync('pages/store/PublicProductPage.tsx', 'utf8'),
  server: readFileSync('server.js', 'utf8'),
  vpsJs: readFileSync('vps_server.js', 'utf8'),
  vpsCjs: readFileSync('vps_server.cjs', 'utf8'),
};

assert.match(files.index, /<link rel="canonical" href="https:\/\/www\.mercadodovale\.com\.br\/" \/>/);
assert.doesNotMatch(files.index, /https:\/\/mercadodovale\.com\.br\//);

assert.match(files.productPage, /https:\/\/www\.mercadodovale\.com\.br\/produto\/\$\{product\.slug \|\| product\.id\}/);
assert.doesNotMatch(files.productPage, /https:\/\/mercadodovale\.com\.br\/produto/);

for (const [name, source] of Object.entries({ server: files.server, vpsJs: files.vpsJs, vpsCjs: files.vpsCjs })) {
  assert.match(source, /CANONICAL_SITE_ORIGIN\s*=\s*'https:\/\/www\.mercadodovale\.com\.br'/, `${name} must define the canonical production origin`);
  assert.match(source, /normalizePublicSeoBaseUrl/, `${name} must normalize public SEO base URLs`);
  assert.match(source, /host\.toLowerCase\(\) === 'mercadodovale\.com\.br'/, `${name} must normalize apex production host to www`);
}

console.log('seo canonical www static checks ok');
